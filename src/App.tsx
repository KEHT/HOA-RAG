/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Header } from './components/Header';
import { DriveDocumentBrowser } from './components/DriveDocumentBrowser';
import { ChatInterface } from './components/ChatInterface';
import { SourceSnippetModal } from './components/SourceSnippetModal';
import { DocSummaryModal } from './components/DocSummaryModal';
import { FolderSelectorModal } from './components/FolderSelectorModal';
import { AISettingsModal } from './components/AISettingsModal';
import { DriveFile, DriveFolder, FolderBreadcrumb, ChatMessage, SourceCitation, AIConfig } from './types';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { saveLocalData, getLocalData, clearLocalData } from './lib/indexedDb';
import { Menu, X, Loader2 } from 'lucide-react';

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gemini',
  geminiModel: 'gemini-3.7-flash',
  customEndpoint: 'http://localhost:11434/v1',
  customModelName: 'llama3.3',
  customApiKey: '',
  temperature: 0.2,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hasDriveAccess, setHasDriveAccess] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // AI Config state with localStorage persistence
  const [aiConfig, setAIConfig] = useState<AIConfig>(() => {
    try {
      const saved = localStorage.getItem('hoa_ai_config');
      if (saved) {
        return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_AI_CONFIG;
  });
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);

  const handleSaveAIConfig = (newConfig: AIConfig) => {
    setAIConfig(newConfig);
    try {
      localStorage.setItem('hoa_ai_config', JSON.stringify(newConfig));
    } catch {
      // Ignore
    }
  };

  // Document state
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [customDocs, setCustomDocs] = useState<DriveFile[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isIndexingFolder, setIsIndexingFolder] = useState(false);
  const [indexingStatusText, setIndexingStatusText] = useState<string>('');
  const [isRefreshingDrive, setIsRefreshingDrive] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Folder scoping & discovery state
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [currentFolderName, setCurrentFolderName] = useState<string>('My Drive');
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<FolderBreadcrumb[]>([
    { id: 'root', name: 'My Drive' }
  ]);
  const [availableSubfolders, setAvailableSubfolders] = useState<DriveFolder[]>([]);
  const [matchingHOAFolders, setMatchingHOAFolders] = useState<DriveFolder[]>([]);
  const [folderModalNotice, setFolderModalNotice] = useState<string>('');
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Modals state
  const [activeSourceModal, setActiveSourceModal] = useState<SourceCitation | null>(null);
  const [summarizingDoc, setSummarizingDoc] = useState<DriveFile | null>(null);
  const [docSummaryData, setDocSummaryData] = useState<any>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  // Restore client persistent state from IndexedDB on initial mount
  useEffect(() => {
    async function restorePersistedState() {
      try {
        const [savedDriveFiles, savedCustomDocs, savedFolderMeta, savedMessages] = await Promise.all([
          getLocalData<DriveFile[]>('saved_drive_files'),
          getLocalData<DriveFile[]>('saved_custom_docs'),
          getLocalData<{ folderId: string; folderName: string; breadcrumbs: FolderBreadcrumb[] }>('saved_folder_meta'),
          getLocalData<ChatMessage[]>('saved_chat_messages'),
        ]);

        if (savedDriveFiles && savedDriveFiles.length > 0) {
          setDriveFiles(savedDriveFiles);
        }
        if (savedCustomDocs && savedCustomDocs.length > 0) {
          setCustomDocs(savedCustomDocs);
        }
        if (savedFolderMeta) {
          setCurrentFolderId(savedFolderMeta.folderId || 'root');
          setCurrentFolderName(savedFolderMeta.folderName || 'My Drive');
          if (savedFolderMeta.breadcrumbs) {
            setFolderBreadcrumbs(savedFolderMeta.breadcrumbs);
          }
        }
        if (savedMessages && savedMessages.length > 0) {
          setMessages(savedMessages);
        }

        // Auto-select all restored documents
        const allIds = [
          ...(savedDriveFiles || []).map(f => f.id),
          ...(savedCustomDocs || []).map(c => c.id)
        ];
        if (allIds.length > 0) {
          setSelectedDocIds(allIds);
        }
      } catch (err) {
        console.warn('Could not restore cached state from IndexedDB:', err);
      }
    }
    restorePersistedState();
  }, []);

  // Save changes to IndexedDB when documents, folders, or messages change
  useEffect(() => {
    if (driveFiles.length > 0) {
      saveLocalData('saved_drive_files', driveFiles);
    }
  }, [driveFiles]);

  useEffect(() => {
    if (customDocs.length > 0) {
      saveLocalData('saved_custom_docs', customDocs);
    }
  }, [customDocs]);

  useEffect(() => {
    if (messages.length > 0) {
      saveLocalData('saved_chat_messages', messages);
    }
  }, [messages]);

  useEffect(() => {
    saveLocalData('saved_folder_meta', {
      folderId: currentFolderId,
      folderName: currentFolderName,
      breadcrumbs: folderBreadcrumbs,
    });
  }, [currentFolderId, currentFolderName, folderBreadcrumbs]);

  /**
   * Parse all files in the selected folder and all its subfolders with incremental sync.
   * Reuses unchanged cached docs and prunes non-folder files.
   */
  const indexAndParseDriveFolder = useCallback(async (
    token: string, 
    targetFolderId: string, 
    targetFolderName: string,
    forceFullReindex: boolean = false
  ) => {
    setIsIndexingFolder(true);
    setIsLoadingDocs(true);
    setIndexingStatusText(`Scanning "${targetFolderName}" and traversing all subfolders...`);

    try {
      // Call backend to recursively scan, parse all new/modified files in subfolders, and prune out-of-scope indexes
      const res = await fetch('/api/drive/index-folder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          folderId: targetFolderId,
          folderName: targetFolderName,
          forceFullReindex,
          aiConfig,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to index folder and subfolders');
      }

      const data = await res.json();
      const parsedFiles: DriveFile[] = (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        iconLink: f.iconLink,
        webViewLink: f.webViewLink,
        snippet: f.snippet || (f.content ? f.content.slice(0, 240) + '...' : ''),
        content: f.content,
        summary: f.summary,
        folderId: f.folderId,
        folderName: f.folderName,
        folderPath: f.folderPath,
        isHOAKeywordMatch: f.isHOAKeywordMatch,
        isImageDoc: f.isImageDoc,
        isOfficeDoc: f.isOfficeDoc,
        isIndexed: true,
      }));

      // Update in-memory and persistent drive files
      setDriveFiles(parsedFiles);
      saveLocalData('saved_drive_files', parsedFiles);

      // Subfolders discovered
      const subfolders: DriveFolder[] = (data.subfolders || [])
        .filter((sf: any) => sf.id !== targetFolderId)
        .map((sf: any) => ({
          id: sf.id,
          name: sf.name,
          path: sf.path,
          parentId: sf.parentId,
          modifiedTime: sf.modifiedTime,
        }));
      setAvailableSubfolders(subfolders);

      // Auto-select all indexed files from this folder and its subfolders
      const allIndexedIds = [...parsedFiles.map(f => f.id), ...customDocs.map(c => c.id)];
      setSelectedDocIds(allIndexedIds);

      // Add informative assistant message to chat detailing incremental sync stats
      const subfolderSummary = data.totalSubfolders > 0
        ? ` across **${data.totalSubfolders} subfolder${data.totalSubfolders === 1 ? '' : 's'}**`
        : '';
      
      const cachedCount = data.cachedCount ?? 0;
      const newOrUpdatedCount = data.newOrUpdatedCount ?? parsedFiles.length;
      const removedCount = data.removedCount ?? 0;

      let syncDetailText = '';
      if (cachedCount > 0 && newOrUpdatedCount > 0) {
        syncDetailText = `\n\n⚡ *Incremental Sync:* ${cachedCount} unchanged files kept from persistent cache, ${newOrUpdatedCount} new/updated files parsed.`;
      } else if (cachedCount > 0 && newOrUpdatedCount === 0) {
        syncDetailText = `\n\n⚡ *Instant Cache:* All ${cachedCount} files loaded from persistent storage (no modifications detected).`;
      } else if (newOrUpdatedCount > 0) {
        syncDetailText = `\n\n⚡ *Initial Indexing:* Parsed ${newOrUpdatedCount} files into persistent memory.`;
      }

      if (removedCount > 0) {
        syncDetailText += ` (${removedCount} deleted file${removedCount === 1 ? '' : 's'} pruned).`;
      }

      const indexNoticeMsg: ChatMessage = {
        id: `msg-${Date.now()}-index-success`,
        role: 'model',
        content: `📁 **Folder & Subfolders Indexed:** Scoped exclusively to **"${targetFolderName}"**.\n\nIndexed **${parsedFiles.length} file${parsedFiles.length === 1 ? '' : 's'}**${subfolderSummary}.${syncDetailText}\n\n*Previous document indexes outside "${targetFolderName}" have been pruned.*`,
        timestamp: Date.now(),
        suggestedQuestions: parsedFiles.length > 0 ? [
          `Summarize the key governing rules in "${targetFolderName}"`,
          `What are the most recent meeting minutes or resolutions?`,
          `What are the financial assessments or budget figures in this folder?`
        ] : [
          `How do I add documents or select a different folder?`,
          `What file types are supported for indexing?`
        ]
      };

      setMessages(prev => [...prev, indexNoticeMsg]);
    } catch (err: any) {
      console.error('Error in indexAndParseDriveFolder:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-index-err`,
        role: 'model',
        content: `❌ **Failed to index folder:** ${err.message || 'Unknown error'}. Please check your Google Drive permissions and try again.`,
        timestamp: Date.now(),
        error: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsIndexingFolder(false);
      setIsLoadingDocs(false);
      setIsRefreshingDrive(false);
      setIndexingStatusText('');
    }
  }, [customDocs, aiConfig]);

  /**
   * Automatic "HOA" folder discovery workflow upon connecting to Google Drive
   */
  const handleDriveConnectedWorkflow = useCallback(async (token: string) => {
    setIsLoadingDocs(true);
    setIndexingStatusText('Checking Google Drive for "HOA" folder...');

    try {
      const res = await fetch('/api/drive/search-hoa-folders', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Could not search Google Drive folders');
      }

      const data = await res.json();
      const discoveredFolders: Array<{ id: string; name: string; modifiedTime?: string }> = data.folders || [];

      if (discoveredFolders.length === 1) {
        // EXACTLY 1 HOA FOLDER FOUND: Auto-select and index it
        const hoaFolder = discoveredFolders[0];
        setCurrentFolderId(hoaFolder.id);
        setCurrentFolderName(hoaFolder.name);
        setFolderBreadcrumbs([{ id: hoaFolder.id, name: hoaFolder.name }]);
        setMatchingHOAFolders([]);
        setFolderModalNotice('');
        
        await indexAndParseDriveFolder(token, hoaFolder.id, hoaFolder.name);
      } else if (discoveredFolders.length === 0) {
        // 0 HOA FOLDERS FOUND: Prompt user to select a folder before indexing
        setMatchingHOAFolders([]);
        setFolderModalNotice('No folder named "HOA" was found in your Google Drive. Please select or paste the link to your HOA document folder to begin indexing.');
        setIsFolderModalOpen(true);

        const promptMsg: ChatMessage = {
          id: `msg-${Date.now()}-no-hoa-folder`,
          role: 'model',
          content: `⚠️ **No "HOA" Folder Found:** We could not automatically locate a folder named **"HOA"** in your Google Drive.\n\nPlease select or paste the link to your community folder using the folder selector to begin indexing.`,
          timestamp: Date.now(),
          suggestedQuestions: [
            `How do I select or link a Google Drive folder?`,
            `Can I upload files directly instead?`
          ]
        };
        setMessages(prev => [...prev, promptMsg]);
      } else {
        // MULTIPLE HOA FOLDERS FOUND: Prompt user to choose which one
        const formattedFolders: DriveFolder[] = discoveredFolders.map(f => ({
          id: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
        }));
        setMatchingHOAFolders(formattedFolders);
        setFolderModalNotice(`Found ${discoveredFolders.length} folders named "HOA" in your Google Drive. Please choose which one to index.`);
        setIsFolderModalOpen(true);

        const multipleMsg: ChatMessage = {
          id: `msg-${Date.now()}-multiple-hoa`,
          role: 'model',
          content: `📁 **Multiple "HOA" Folders Found:** We found **${discoveredFolders.length} folders** named "HOA" in your Google Drive.\n\nPlease select the correct folder from the prompt to begin indexing.`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, multipleMsg]);
      }
    } catch (err: any) {
      console.warn('Error during HOA folder discovery:', err);
      // Fallback: Open folder selector modal
      setFolderModalNotice('Please select your HOA documents folder to begin indexing.');
      setIsFolderModalOpen(true);
    } finally {
      setIsLoadingDocs(false);
      setIndexingStatusText('');
    }
  }, [indexAndParseDriveFolder]);

  // Handle selecting a specific folder
  const handleSelectFolder = async (folderId: string, folderName: string, customBreadcrumbs?: FolderBreadcrumb[]) => {
    setCurrentFolderId(folderId);
    setCurrentFolderName(folderName);
    const crumbs = customBreadcrumbs || [{ id: folderId, name: folderName }];
    setFolderBreadcrumbs(crumbs);
    
    // Clear discovered HOA modal state
    setMatchingHOAFolders([]);
    setFolderModalNotice('');

    const token = getAccessToken();
    if (token) {
      await indexAndParseDriveFolder(token, folderId, folderName);
    }
  };

  // Handle navigating via breadcrumb
  const handleNavigateBreadcrumb = async (index: number) => {
    const target = folderBreadcrumbs[index];
    const newCrumbs = folderBreadcrumbs.slice(0, index + 1);
    await handleSelectFolder(target.id, target.name, newCrumbs);
  };

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setHasDriveAccess(true);
        // Trigger HOA folder discovery workflow
        handleDriveConnectedWorkflow(token);
      },
      () => {
        setUser(null);
        setHasDriveAccess(false);
      }
    );

    return () => unsubscribe();
  }, [handleDriveConnectedWorkflow]);

  // Handle Google Sign in
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasDriveAccess(true);
        await handleDriveConnectedWorkflow(result.accessToken);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Sign out
  const handleLogout = async () => {
    await logout();
    await clearLocalData();
    setUser(null);
    setHasDriveAccess(false);
    setDriveFiles([]);
    setCustomDocs([]);
    setCurrentFolderId('root');
    setCurrentFolderName('My Drive');
    setFolderBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
    setSelectedDocIds([]);
    setMatchingHOAFolders([]);
    setFolderModalNotice('');

    // Clear backend index
    fetch('/api/drive/clear-index', { method: 'POST' }).catch(() => {});
  };

  // Refresh / Re-index Google Drive folder (incremental)
  const handleRefreshDrive = async () => {
    const token = getAccessToken();
    if (token) {
      setIsRefreshingDrive(true);
      await indexAndParseDriveFolder(token, currentFolderId, currentFolderName);
    }
  };

  // Active files list (custom uploaded files + drive files)
  const activeFilesList = [...customDocs, ...driveFiles];

  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDocs = () => {
    setSelectedDocIds(activeFilesList.map(f => f.id));
  };

  const handleClearSelection = () => {
    setSelectedDocIds([]);
  };

  // Upload and Parse MS Office (.docx, .xlsx, .pptx), PDF, or JPG/PNG files
  const handleUploadFile = async (file: File) => {
    setIsUploadingFile(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/documents/parse-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: base64Data,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
          aiConfig,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to parse uploaded document');
      }

      const parsed = await res.json();

      const newDoc: DriveFile = {
        id: parsed.id || `upload-doc-${Date.now()}`,
        name: parsed.name || file.name,
        category: parsed.category || 'general',
        mimeType: file.type || 'application/octet-stream',
        modifiedTime: new Date().toISOString(),
        snippet: parsed.summary || parsed.snippet,
        isHOAKeywordMatch: true,
        isImageDoc: parsed.isImageDoc,
        isOfficeDoc: parsed.isOfficeDoc,
        content: parsed.content,
        summary: parsed.summary,
        keyHighlights: parsed.keyHighlights,
        importantDatesOrAmounts: parsed.importantDatesOrAmounts,
        folderPath: `Uploaded Files`,
      };

      const updatedCustom = [newDoc, ...customDocs];
      setCustomDocs(updatedCustom);
      saveLocalData('saved_custom_docs', updatedCustom);
      setSelectedDocIds(prev => [newDoc.id, ...prev]);

      const highlightsText = parsed.keyHighlights && parsed.keyHighlights.length > 0
        ? `\n\n**Key Highlights:**\n${parsed.keyHighlights.map((h: string) => `• ${h}`).join('\n')}`
        : '';
      const amountsText = parsed.importantDatesOrAmounts && parsed.importantDatesOrAmounts.length > 0
        ? `\n\n**Key Figures Extracted:**\n${parsed.importantDatesOrAmounts.map((a: string) => `• ${a}`).join('\n')}`
        : '';

      const notificationMsg: ChatMessage = {
        id: `msg-${Date.now()}-file-success`,
        role: 'model',
        content: `📄 **Document Parsed & Added to Index:** *${newDoc.name}*\n\n${parsed.summary || 'Content extracted and indexed for Q&A.'}${highlightsText}${amountsText}\n\n*You can now ask questions about this document or cross-reference it with other community records!*`,
        timestamp: Date.now(),
        suggestedQuestions: [
          `Summarize the key provisions in ${newDoc.name}`,
          `What dates, figures, or rules are mentioned in ${newDoc.name}?`,
          `Are there any compliance requirements in ${newDoc.name}?`
        ]
      };

      setMessages(prev => [...prev, notificationMsg]);
    } catch (err: any) {
      console.error('Error uploading/parsing file:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-file-err`,
        role: 'model',
        content: `❌ Could not parse file: ${err.message || 'File processing error'}. Please ensure the file format is supported and try again.`,
        timestamp: Date.now(),
        error: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Document Summary modal trigger
  const handleSummarizeDoc = async (doc: DriveFile) => {
    setSummarizingDoc(doc);
    setDocSummaryData(null);
    setIsLoadingSummary(true);

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/documents/summarize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          docId: doc.id,
          driveFile: !doc.id.startsWith('upload-') && !doc.isImageDoc ? doc : undefined,
          customDoc: doc.isImageDoc || doc.isOfficeDoc || doc.content ? {
            id: doc.id,
            name: doc.name,
            category: doc.category,
            content: doc.content || doc.snippet,
            summary: doc.summary,
            mimeType: doc.mimeType,
          } : undefined,
          aiConfig,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDocSummaryData(data.summary);
      }
    } catch (err) {
      console.error('Error generating summary:', err);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  // Send message to AI chatbot
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: queryText,
      timestamp: Date.now(),
    };

    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setIsChatLoading(true);

    try {
      const token = getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const apiHistory = updatedHistory
        .filter(m => m.role === 'user' || m.role === 'model')
        .slice(-8)
        .map(m => ({
          role: m.role as 'user' | 'model',
          content: m.content,
        }));

      const payload = {
        question: queryText,
        history: apiHistory,
        selectedDocIds,
        filterCategory,
        driveFilesToExtract: driveFiles.filter(f => selectedDocIds.includes(f.id)),
        customDocuments: customDocs.filter(c => selectedDocIds.includes(c.id)),
        aiConfig,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get response from HOA AI assistant');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'model',
        content: data.answer,
        sources: data.sources || [],
        suggestedQuestions: data.suggestedQuestions || [],
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'model',
        content: `I encountered an issue processing your request: **${error.message || 'Unknown error'}**.\n\nPlease check your AI model configuration or try rephrasing your question.`,
        timestamp: Date.now(),
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    saveLocalData('saved_chat_messages', []);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-[#0F172A] overflow-hidden font-sans">
      {/* Top Navigation Header */}
      <Header
        user={user}
        hasDriveAccess={hasDriveAccess}
        isLoggingIn={isLoggingIn}
        selectedDocsCount={selectedDocIds.length}
        totalDocsCount={activeFilesList.length}
        aiConfig={aiConfig}
        onOpenAISettings={() => setIsAISettingsOpen(true)}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onRefreshDrive={handleRefreshDrive}
        isRefreshingDrive={isRefreshingDrive}
      />

      {/* Indexing Progress Indicator Bar */}
      {isIndexingFolder && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs z-30 transition">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>{indexingStatusText || 'Indexing and parsing documents across folder tree...'}</span>
          </div>
          <span className="text-[10px] bg-blue-700 text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider">
            Traversing Subfolders
          </span>
        </div>
      )}

      {/* Mobile Top Navigation Tab Bar */}
      <div className="lg:hidden bg-white border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between z-20 shrink-0">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold border border-blue-200 cursor-pointer shadow-2xs"
        >
          {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>{mobileSidebarOpen ? 'Close Documents' : `HOA Documents (${selectedDocIds.length} active)`}</span>
        </button>
        <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider text-[10px]">
          {`Folder: ${currentFolderName}`}
        </span>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Document Browser Sidebar (Desktop + Mobile Slide-over) */}
        <div
          className={`fixed inset-y-0 left-0 z-40 lg:static lg:z-auto transition-transform duration-200 ease-in-out ${
            mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <DriveDocumentBrowser
            files={activeFilesList}
            selectedFileIds={selectedDocIds}
            isLoading={isLoadingDocs || isIndexingFolder}
            hasDriveAccess={hasDriveAccess}
            onToggleSelect={handleToggleSelectDoc}
            onSelectAll={handleSelectAllDocs}
            onClearSelection={handleClearSelection}
            onSummarizeDoc={handleSummarizeDoc}
            onConnectDrive={handleLogin}
            onUploadFile={handleUploadFile}
            isUploadingFile={isUploadingFile}
            currentFolderId={currentFolderId}
            currentFolderName={currentFolderName}
            folderBreadcrumbs={folderBreadcrumbs}
            availableSubfolders={availableSubfolders}
            onOpenFolderModal={() => {
              setMatchingHOAFolders([]);
              setFolderModalNotice('');
              setIsFolderModalOpen(true);
            }}
            onNavigateBreadcrumb={handleNavigateBreadcrumb}
            onScopeToFolder={handleSelectFolder}
            onReindexFolder={handleRefreshDrive}
          />
        </div>

        {/* Mobile backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-[#0F172A]/40 z-30 lg:hidden backdrop-blur-xs"
          />
        )}

        {/* AI Chatbot Area */}
        <ChatInterface
          messages={messages}
          isLoading={isChatLoading}
          selectedDocsCount={selectedDocIds.length}
          filterCategory={filterCategory}
          aiConfig={aiConfig}
          onSendMessage={handleSendMessage}
          onClearMessages={handleClearMessages}
          onSelectCategory={setFilterCategory}
          onViewSource={setActiveSourceModal}
          onUploadFile={handleUploadFile}
          isUploadingFile={isUploadingFile}
          onOpenAISettings={() => setIsAISettingsOpen(true)}
        />
      </div>

      {/* AI Model & Server Settings Modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        config={aiConfig}
        onSaveConfig={handleSaveAIConfig}
      />

      {/* Folder Selector Modal */}
      <FolderSelectorModal
        isOpen={isFolderModalOpen}
        onClose={() => {
          setIsFolderModalOpen(false);
          setMatchingHOAFolders([]);
          setFolderModalNotice('');
        }}
        currentFolderId={currentFolderId}
        currentFolderName={currentFolderName}
        onSelectFolder={handleSelectFolder}
        accessToken={getAccessToken()}
        matchingHOAFolders={matchingHOAFolders}
        noticeMessage={folderModalNotice}
      />

      {/* Source Excerpt Modal */}
      <SourceSnippetModal
        source={activeSourceModal}
        onClose={() => setActiveSourceModal(null)}
      />

      {/* Document Summary Modal */}
      <DocSummaryModal
        document={summarizingDoc}
        summary={docSummaryData}
        isLoading={isLoadingSummary}
        onClose={() => setSummarizingDoc(null)}
        onSelectQuery={handleSendMessage}
      />
    </div>
  );
}
