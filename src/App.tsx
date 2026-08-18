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
import { DriveFile, DriveFolder, FolderBreadcrumb, ChatMessage, SourceCitation } from './types';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/firebase';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hasDriveAccess, setHasDriveAccess] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Document state
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [sampleFiles, setSampleFiles] = useState<DriveFile[]>([]);
  const [customDocs, setCustomDocs] = useState<DriveFile[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isRefreshingDrive, setIsRefreshingDrive] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Folder scoping state
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [currentFolderName, setCurrentFolderName] = useState<string>('My Drive');
  const [folderBreadcrumbs, setFolderBreadcrumbs] = useState<FolderBreadcrumb[]>([
    { id: 'root', name: 'My Drive' }
  ]);
  const [availableSubfolders, setAvailableSubfolders] = useState<DriveFolder[]>([]);
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

  // Fetch sample documents from backend
  const loadSampleDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents/sample');
      if (res.ok) {
        const data = await res.json();
        const formatted: DriveFile[] = (data.documents || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          mimeType: d.mimeType,
          modifiedTime: d.modifiedTime,
          snippet: d.summary,
          isHOAKeywordMatch: true,
        }));
        setSampleFiles(formatted);
        // If in sample mode or initially no drive files, select sample docs by default
        setSelectedDocIds(prev => prev.length === 0 ? formatted.map(f => f.id) : prev);
      }
    } catch (err) {
      console.error('Error loading sample HOA documents:', err);
    }
  }, []);

  // Fetch Google Drive files strictly from a specific folder and recursively index all its contents
  const loadDriveFiles = useCallback(async (token: string, targetFolderId?: string, targetFolderName?: string) => {
    const folderToQuery = targetFolderId !== undefined ? targetFolderId : currentFolderId;
    setIsLoadingDocs(true);
    setDriveFiles([]); // Clear previous files immediately so old folder files do not linger
    try {
      // 1. Fetch files inside the targeted folder & recursively index all subfolders
      const res = await fetch(`/api/drive/files?folderId=${folderToQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const files: DriveFile[] = data.files || [];
        setDriveFiles(files);
        setAvailableSubfolders(data.subfolders || []);

        if (data.rootFolder && data.rootFolder.name && targetFolderName === undefined) {
          setCurrentFolderName(data.rootFolder.name);
        }

        // Automatically select all discovered files in this folder tree
        const allDiscoveredIds = files.map(f => f.id);
        setSelectedDocIds(allDiscoveredIds);
        return { files, subfolders: data.subfolders || [], totalFiles: data.totalIndexedFiles ?? files.length, totalSubfolders: data.totalIndexedSubfolders ?? 0 };
      } else {
        console.warn('Could not fetch Drive files:', res.statusText);
      }
    } catch (err) {
      console.error('Error in loadDriveFiles:', err);
    } finally {
      setIsLoadingDocs(false);
      setIsRefreshingDrive(false);
    }
    return null;
  }, [currentFolderId]);

  // Handle selecting a specific folder
  const handleSelectFolder = async (folderId: string, folderName: string, customBreadcrumbs?: FolderBreadcrumb[]) => {
    setCurrentFolderId(folderId);
    setCurrentFolderName(folderName);
    if (customBreadcrumbs) {
      setFolderBreadcrumbs(customBreadcrumbs);
    }
    const token = getAccessToken();
    let indexedStats: any = null;
    if (token) {
      indexedStats = await loadDriveFiles(token, folderId, folderName);
    }

    const fileCount = indexedStats ? indexedStats.totalFiles : 0;
    const subfolderCount = indexedStats ? indexedStats.totalSubfolders : 0;

    // Add informative assistant message confirming recursive indexing
    const folderMsg: ChatMessage = {
      id: `msg-${Date.now()}-folder-scope`,
      role: 'model',
      content: `📁 **Folder Scoped & Indexed:** Successfully indexed **${fileCount} document${fileCount === 1 ? '' : 's'}** across **${subfolderCount} subfolder${subfolderCount === 1 ? '' : 's'}** in **"${folderName}"**.\n\nAll documents in this folder are automatically selected and ready for questions. No files from outside this folder will be queried.`,
      timestamp: Date.now(),
      suggestedQuestions: [
        `What documents are in ${folderName}?`,
        `Summarize the key bylaws or rules in this folder`,
        `What are the financial figures in this folder?`
      ]
    };
    setMessages(prev => [...prev, folderMsg]);
  };

  // Handle navigating via breadcrumb
  const handleNavigateBreadcrumb = async (index: number) => {
    const target = folderBreadcrumbs[index];
    const newCrumbs = folderBreadcrumbs.slice(0, index + 1);
    await handleSelectFolder(target.id, target.name, newCrumbs);
  };

  // Handle drilling down into a subfolder
  const handleDrillIntoFolder = async (folder: DriveFolder) => {
    const newCrumbs = [...folderBreadcrumbs, { id: folder.id, name: folder.name }];
    await handleSelectFolder(folder.id, folder.name, newCrumbs);
  };

  // Handle reset to My Drive root
  const handleResetToRoot = async () => {
    await handleSelectFolder('root', 'My Drive', [{ id: 'root', name: 'My Drive' }]);
  };

  // Initialize auth listener
  useEffect(() => {
    loadSampleDocs();

    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setHasDriveAccess(true);
        loadDriveFiles(token, 'root', 'My Drive');
      },
      () => {
        setUser(null);
        setHasDriveAccess(false);
        // Default to sample mode if not logged in
        setIsSampleMode(true);
      }
    );

    return () => unsubscribe();
  }, [loadSampleDocs, loadDriveFiles]);

  // Handle Google Sign in
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setHasDriveAccess(true);
        setIsSampleMode(false);
        await loadDriveFiles(result.accessToken, 'root', 'My Drive');
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
    setUser(null);
    setHasDriveAccess(false);
    setDriveFiles([]);
    setIsSampleMode(true);
    setCurrentFolderId('root');
    setCurrentFolderName('My Drive');
    setFolderBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
    setSelectedDocIds(sampleFiles.map(f => f.id));
  };

  // Refresh Google Drive
  const handleRefreshDrive = async () => {
    const token = getAccessToken();
    if (token) {
      setIsRefreshingDrive(true);
      await loadDriveFiles(token, currentFolderId, currentFolderName);
    }
  };

  // Active files list strictly determined by current mode
  // In Google Drive mode, show strictly and only the files returned from the selected Drive folder tree
  const activeFilesList = isSampleMode 
    ? [...customDocs, ...sampleFiles]
    : [...customDocs.filter(c => c.isImageDoc), ...driveFiles];

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

  const handleSwitchMode = (toSample: boolean) => {
    setIsSampleMode(toSample);
    if (toSample) {
      setSelectedDocIds([...customDocs.map(c => c.id), ...sampleFiles.map(f => f.id)]);
    } else {
      setSelectedDocIds(driveFiles.map(f => f.id));
    }
  };

  // Upload and OCR Parse JPG / Image of Meeting or Financials
  const handleUploadImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      // Convert file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Extract pure base64 without prefix
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/documents/parse-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBufferBase64: base64Data,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to parse image with Gemini Vision');
      }

      const data = await res.json();
      const parsed = data.parsed;

      const newDoc: DriveFile = {
        id: `img-doc-${Date.now()}`,
        name: parsed.fileName || file.name,
        category: parsed.category || 'general',
        mimeType: file.type || 'image/jpeg',
        modifiedTime: new Date().toISOString(),
        snippet: parsed.summary,
        isHOAKeywordMatch: true,
        isImageDoc: true,
        content: parsed.content,
        summary: parsed.summary,
        keyHighlights: parsed.keyHighlights,
        importantDatesOrAmounts: parsed.importantDatesOrAmounts,
      };

      setCustomDocs(prev => [newDoc, ...prev]);
      setSelectedDocIds(prev => [newDoc.id, ...prev]);

      // Add a helpful assistant notification to the chat
      const highlightsText = parsed.keyHighlights && parsed.keyHighlights.length > 0
        ? `\n\n**Key Highlights:**\n${parsed.keyHighlights.map((h: string) => `• ${h}`).join('\n')}`
        : '';
      const amountsText = parsed.importantDatesOrAmounts && parsed.importantDatesOrAmounts.length > 0
        ? `\n\n**Key Dates & Figures Extracted:**\n${parsed.importantDatesOrAmounts.map((a: string) => `• ${a}`).join('\n')}`
        : '';

      const notificationMsg: ChatMessage = {
        id: `msg-${Date.now()}-img-success`,
        role: 'model',
        content: `📸 **Image Parsed & Indexed Successfully:** *${newDoc.name}*\n\n${parsed.summary || 'Content extracted and indexed for Q&A.'}${highlightsText}${amountsText}\n\n*You can now ask questions about this document or compare it against your community bylaws!*`,
        timestamp: Date.now(),
        suggestedQuestions: [
          `Summarize all motions or key decisions in ${newDoc.name}`,
          `What financial amounts or dates are mentioned in ${newDoc.name}?`,
          `Are there any bylaws violations referenced in this document?`
        ]
      };

      setMessages(prev => [...prev, notificationMsg]);
    } catch (err: any) {
      console.error('Error uploading/parsing image:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-img-err`,
        role: 'model',
        content: `❌ Could not parse image: ${err.message || 'Image processing error'}. Please ensure the picture is clear and try again.`,
        timestamp: Date.now(),
        error: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsUploadingImage(false);
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
          driveFile: !doc.id.startsWith('sample-') && !doc.isImageDoc ? doc : undefined,
          customDoc: doc.isImageDoc || doc.content ? {
            id: doc.id,
            name: doc.name,
            category: doc.category,
            content: doc.content || doc.snippet,
            summary: doc.summary,
            mimeType: doc.mimeType,
          } : undefined,
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

      // Convert history for API
      const apiHistory = updatedHistory
        .filter(m => m.role === 'user' || m.role === 'model')
        .slice(-8)
        .map(m => ({
          role: m.role as 'user' | 'model',
          content: m.content,
        }));

      // Gather drive files to extract if in Drive mode (excluding custom docs which are sent directly)
      const filesToExtract = !isSampleMode && hasDriveAccess
        ? driveFiles.filter(f => selectedDocIds.includes(f.id) && !customDocs.some(c => c.id === f.id))
        : [];

      // Gather custom docs that are selected
      const customDocsToSend = customDocs
        .filter(c => selectedDocIds.length === 0 || selectedDocIds.includes(c.id))
        .map(c => ({
          id: c.id,
          name: c.name,
          category: c.category,
          content: c.content || c.snippet || '',
          summary: c.summary || '',
          mimeType: c.mimeType,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: queryText,
          history: apiHistory.slice(0, -1), // exclude current question which is passed in question field
          selectedDocIds,
          useSampleLibrary: isSampleMode,
          filterCategory,
          driveFilesToExtract: filesToExtract,
          customDocuments: customDocsToSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMessage: ChatMessage = {
          id: `msg-${Date.now()}-model`,
          role: 'model',
          content: data.answer,
          timestamp: Date.now(),
          sources: data.sources || [],
          suggestedQuestions: data.suggestedQuestions || [],
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        const errData = await res.json().catch(() => ({}));
        const errorMessage: ChatMessage = {
          id: `msg-${Date.now()}-error`,
          role: 'model',
          content: `I encountered an issue processing your question: ${errData.error || 'Server error'}. Please verify your document selection and try again.`,
          timestamp: Date.now(),
          error: true,
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error`,
        role: 'model',
        content: `Connection error: Could not reach the HOA Document Assistant server. Please check your network connection.`,
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
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-[#1E293B] font-sans overflow-hidden">
      {/* Top Application Header */}
      <Header
        user={user}
        hasDriveAccess={hasDriveAccess}
        isLoggingIn={isLoggingIn}
        selectedDocsCount={selectedDocIds.length}
        totalDocsCount={activeFilesList.length}
        isSampleMode={isSampleMode}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onRefreshDrive={handleRefreshDrive}
        isRefreshingDrive={isRefreshingDrive}
      />

      {/* Mobile Sidebar Toggle Button */}
      <div className="lg:hidden bg-white border-b border-[#E2E8F0] px-4 py-2.5 flex items-center justify-between z-20 flex-shrink-0">
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold border border-blue-200 cursor-pointer shadow-2xs"
        >
          {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          <span>{mobileSidebarOpen ? 'Close Documents' : `HOA Documents (${selectedDocIds.length} active)`}</span>
        </button>
        <span className="text-xs text-[#64748B] font-semibold uppercase tracking-wider text-[10px]">
          {isSampleMode ? 'Sample Mode' : 'Drive Mode'}
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
            isLoading={isLoadingDocs}
            hasDriveAccess={hasDriveAccess}
            isSampleMode={isSampleMode}
            onToggleSelect={handleToggleSelectDoc}
            onSelectAll={handleSelectAllDocs}
            onClearSelection={handleClearSelection}
            onSummarizeDoc={handleSummarizeDoc}
            onSwitchMode={handleSwitchMode}
            onConnectDrive={handleLogin}
            onUploadImage={handleUploadImage}
            isUploadingImage={isUploadingImage}
            currentFolderId={currentFolderId}
            currentFolderName={currentFolderName}
            folderBreadcrumbs={folderBreadcrumbs}
            availableSubfolders={availableSubfolders}
            onOpenFolderModal={() => setIsFolderModalOpen(true)}
            onNavigateBreadcrumb={handleNavigateBreadcrumb}
            onDrillIntoFolder={handleDrillIntoFolder}
            onScopeToFolder={handleSelectFolder}
            onResetToRoot={handleResetToRoot}
            isFolderScoped={currentFolderId !== 'root'}
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
          onSendMessage={handleSendMessage}
          onClearMessages={handleClearMessages}
          onSelectCategory={setFilterCategory}
          onViewSource={setActiveSourceModal}
          onUploadImage={handleUploadImage}
          isUploadingImage={isUploadingImage}
        />
      </div>

      {/* Folder Selector Modal */}
      <FolderSelectorModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        currentFolderId={currentFolderId}
        currentFolderName={currentFolderName}
        onSelectFolder={handleSelectFolder}
        accessToken={getAccessToken()}
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
