import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  fetchDriveFilesList, 
  extractDocumentContent, 
  fetchDriveFolderInfo, 
  fetchDriveFoldersList, 
  indexAndParseFolder,
  searchHOAFolders,
  getActiveIndexedDocs,
  getActiveFolderMeta,
  clearActiveFolderIndex,
  categorizeHOADocument,
  ParsedDoc 
} from './server/driveParser';
import { 
  parseWordDocument, 
  parseExcelSpreadsheet, 
  parsePowerPointPresentation, 
  parsePdfBuffer 
} from './server/officeParser';
import { 
  askHOAChatbot, 
  generateDocumentSummary, 
  extractTextAndDataFromImage, 
  testAIConnection,
  AIConfig 
} from './server/gemini';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // API Route: Test connection to Gemini or Private AI server
  app.post('/api/ai/test-connection', async (req, res) => {
    try {
      const config: AIConfig = req.body.aiConfig || req.body;
      const result = await testAIConnection(config);
      res.json(result);
    } catch (err: any) {
      console.error('Error testing AI connection:', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to test AI server connection' });
    }
  });

  // API Route: Direct Parse & Index File Uploads (MS Word, Excel, PPT, PDF, JPG/PNG, Text)
  app.post('/api/documents/parse-file', async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, aiConfig } = req.body;
      if (!fileBase64) {
        return res.status(400).json({ error: 'Missing fileBase64 in request body' });
      }

      const cleanBase64 = fileBase64.includes(';base64,')
        ? fileBase64.split(';base64,')[1]
        : fileBase64;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const lowerName = (fileName || 'document').toLowerCase();
      let detectedCategory = categorizeHOADocument(fileName || '');
      let textContent = '';
      let docSummary: string | undefined = undefined;
      let keyHighlights: string[] = [];
      let importantDatesOrAmounts: string[] = [];

      if (
        lowerName.endsWith('.docx') || 
        lowerName.endsWith('.doc') || 
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        mimeType === 'application/msword'
      ) {
        // Word document
        const parsed = await parseWordDocument(buffer);
        textContent = parsed.text;
        docSummary = `MS Word document ${fileName} (${parsed.text.length} characters parsed).`;
      } else if (
        lowerName.endsWith('.xlsx') || 
        lowerName.endsWith('.xls') || 
        lowerName.endsWith('.csv') ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        mimeType === 'application/vnd.ms-excel'
      ) {
        // Excel spreadsheet
        const parsed = await parseExcelSpreadsheet(buffer);
        textContent = parsed.text;
        docSummary = `MS Excel spreadsheet ${fileName} (${parsed.pageOrSheetCount || 1} sheet(s) parsed).`;
        if (parsed.tables && parsed.tables.length > 0) {
          keyHighlights = parsed.tables;
        }
      } else if (
        lowerName.endsWith('.pptx') || 
        lowerName.endsWith('.ppt') || 
        mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
        mimeType === 'application/vnd.ms-powerpoint'
      ) {
        // PowerPoint presentation
        const parsed = await parsePowerPointPresentation(buffer);
        textContent = parsed.text;
        docSummary = `MS PowerPoint presentation ${fileName} parsed.`;
      } else if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
        // PDF document
        const parsed = await parsePdfBuffer(buffer);
        textContent = parsed.text;
        docSummary = `PDF document ${fileName} parsed.`;
      } else if (mimeType?.startsWith('image/') || lowerName.match(/\.(jpe?g|png|webp|gif|bmp)$/i)) {
        // Image document with OCR
        const result = await extractTextAndDataFromImage(cleanBase64, mimeType || 'image/jpeg', fileName || 'Scanned Document.jpg', aiConfig);
        textContent = result.textContent;
        docSummary = result.summary;
        detectedCategory = result.category;
        keyHighlights = result.keyHighlights;
        importantDatesOrAmounts = result.importantDatesOrAmounts;
      } else {
        // Plain text / markdown fallback
        textContent = buffer.toString('utf-8');
        docSummary = `Text document ${fileName} parsed.`;
      }

      const docId = 'upload-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      
      res.json({
        id: docId,
        name: fileName || 'Uploaded Document',
        category: detectedCategory,
        mimeType: mimeType || 'application/octet-stream',
        modifiedTime: new Date().toISOString(),
        content: textContent,
        summary: docSummary,
        keyHighlights,
        importantDatesOrAmounts,
        extractedLength: textContent.length,
        snippet: textContent.slice(0, 300) + '...',
        isOfficeDoc: lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.pptx'),
        isImageDoc: mimeType?.startsWith('image/') || !!lowerName.match(/\.(jpe?g|png|webp|gif|bmp)$/i),
      });
    } catch (error: any) {
      console.error('Error in /api/documents/parse-file:', error);
      res.status(500).json({ error: error.message || 'Failed to parse uploaded file' });
    }
  });

  // Legacy route alias for parse-image
  app.post('/api/documents/parse-image', async (req, res) => {
    try {
      const { imageBase64, mimeType, fileName, aiConfig } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 in request body' });
      }

      const result = await extractTextAndDataFromImage(
        imageBase64,
        mimeType || 'image/jpeg',
        fileName || 'Scanned Document.jpg',
        aiConfig
      );

      const docId = 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      
      res.json({
        id: docId,
        name: result.title,
        category: result.category,
        mimeType: mimeType || 'image/jpeg',
        modifiedTime: new Date().toISOString(),
        content: result.textContent,
        summary: result.summary,
        keyHighlights: result.keyHighlights,
        importantDatesOrAmounts: result.importantDatesOrAmounts,
        extractedLength: result.textContent.length,
        snippet: result.textContent.slice(0, 300) + '...',
        isImageDoc: true,
      });
    } catch (error: any) {
      console.error('Error in /api/documents/parse-image:', error);
      res.status(500).json({ error: error.message || 'Failed to parse image with AI OCR' });
    }
  });

  // API Route: Search for HOA folder(s) in Google Drive
  app.get('/api/drive/search-hoa-folders', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Google OAuth Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const matchingFolders = await searchHOAFolders(accessToken);
      res.json({ folders: matchingFolders });
    } catch (error: any) {
      console.error('Error in /api/drive/search-hoa-folders:', error);
      res.status(500).json({ error: error.message || 'Failed to search for HOA folder in Google Drive' });
    }
  });

  // API Route: Index and Parse all files in a folder and all its subfolders with incremental caching
  app.post('/api/drive/index-folder', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Google OAuth Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const { folderId, folderName, forceFullReindex, aiConfig } = req.body;
      if (!folderId) {
        return res.status(400).json({ error: 'Missing folderId parameter in request body' });
      }

      const result = await indexAndParseFolder(accessToken, folderId, folderName || 'Selected Folder', !!forceFullReindex, aiConfig);
      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/drive/index-folder:', error);
      res.status(500).json({ error: error.message || 'Failed to index and parse folder and subfolders' });
    }
  });

  // API Route: Get current active indexed status
  app.get('/api/drive/indexed-status', (req, res) => {
    const meta = getActiveFolderMeta();
    const docs = getActiveIndexedDocs();
    res.json({
      meta,
      documents: docs.map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        mimeType: d.mimeType,
        modifiedTime: d.modifiedTime,
        contentLength: d.content ? d.content.length : 0,
        summary: d.summary,
        keyHighlights: d.keyHighlights || [],
        importantDatesOrAmounts: d.importantDatesOrAmounts || [],
        snippet: d.content ? (d.content.slice(0, 300) + '...') : '',
        folderId: d.folderId,
        folderName: d.folderName,
        folderPath: d.folderPath,
        webViewLink: d.webViewLink,
        iconLink: d.iconLink,
        isHOAKeywordMatch: d.isHOAKeywordMatch,
        isOfficeDoc: d.isOfficeDoc,
        isImageDoc: d.isImageDoc,
      })),
    });
  });

  // API Route: Clear indexed folder documents
  app.post('/api/drive/clear-index', (req, res) => {
    clearActiveFolderIndex();
    res.json({ status: 'cleared' });
  });

  // API Route: List Google Drive files with user Bearer token
  app.get('/api/drive/files', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Google OAuth Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const folderId = req.query.folderId as string | undefined;
      const searchQuery = req.query.q as string | undefined;

      const files = await fetchDriveFilesList(accessToken, folderId, searchQuery);
      res.json({ files });
    } catch (error: any) {
      console.error('Error in /api/drive/files:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch Google Drive files' });
    }
  });

  // API Route: List Google Drive folders for folder selection
  app.get('/api/drive/folders', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Google OAuth Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const parentId = req.query.parentId as string | undefined;

      const folders = await fetchDriveFoldersList(accessToken, parentId);
      res.json({ folders });
    } catch (error: any) {
      console.error('Error in /api/drive/folders:', error);
      res.status(500).json({ error: error.message || 'Failed to list folders' });
    }
  });

  // API Route: Get specific folder metadata
  app.get('/api/drive/folder-info', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Google OAuth Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const folderId = req.query.folderId as string;
      if (!folderId) {
        return res.status(400).json({ error: 'Missing folderId parameter' });
      }

      const info = await fetchDriveFolderInfo(accessToken, folderId);
      res.json({ folder: info });
    } catch (error: any) {
      console.error('Error in /api/drive/folder-info:', error);
      res.status(500).json({ error: error.message || 'Failed to get folder information' });
    }
  });

  // API Route: Extract specific Google Drive document
  app.post('/api/drive/extract', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const { file } = req.body;
      if (!file || !file.id) {
        return res.status(400).json({ error: 'Missing file metadata in request body' });
      }

      const parsed = await extractDocumentContent(accessToken, file);
      res.json({
        id: parsed.id,
        name: parsed.name,
        category: parsed.category,
        contentLength: parsed.content.length,
        snippet: parsed.content.slice(0, 300) + '...',
      });
    } catch (error: any) {
      console.error('Error in /api/drive/extract:', error);
      res.status(500).json({ error: error.message || 'Failed to extract document text' });
    }
  });

  // API Route: Chat with HOA Assistant
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        question,
        history = [],
        selectedDocIds = [],
        filterCategory = 'all',
        driveFilesToExtract = [],
        customDocuments = [],
        aiConfig,
      } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Missing question parameter' });
      }

      let documentsToQuery: ParsedDoc[] = [];

      // Custom/Uploaded parsed documents (such as Word, Excel, PDF, or OCR-extracted JPG images)
      if (Array.isArray(customDocuments) && customDocuments.length > 0) {
        for (const cDoc of customDocuments) {
          if (selectedDocIds.length === 0 || selectedDocIds.includes(cDoc.id)) {
            documentsToQuery.push(cDoc);
          }
        }
      }

      // Check active indexed folder documents from Drive
      const indexedDocs = getActiveIndexedDocs();
      if (indexedDocs.length > 0) {
        for (const doc of indexedDocs) {
          if (selectedDocIds.length === 0 || selectedDocIds.includes(doc.id)) {
            documentsToQuery.push(doc);
          }
        }
      } else if (driveFilesToExtract.length > 0) {
        // If user provided ad-hoc Drive files
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const accessToken = authHeader.split(' ')[1];
          for (const file of driveFilesToExtract) {
            if (selectedDocIds.length > 0 && !selectedDocIds.includes(file.id)) {
              continue;
            }
            try {
              const parsed = await extractDocumentContent(accessToken, file);
              documentsToQuery.push(parsed);
            } catch (docErr) {
              console.error(`Failed to extract text for ${file.name}:`, docErr);
            }
          }
        }
      }

      // Filter by category if specified
      if (filterCategory && filterCategory !== 'all') {
        const filtered = documentsToQuery.filter(d => d.category === filterCategory);
        if (filtered.length > 0) {
          documentsToQuery = filtered;
        }
      }

      const result = await askHOAChatbot({
        question,
        history,
        documents: documentsToQuery,
        filterCategory,
        aiConfig,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/chat:', error);
      res.status(500).json({
        error: error.message || 'Internal server error processing question',
        answer: 'I encountered an issue querying the HOA documents. Please verify your selected folder or AI model configuration.',
        sources: [],
        suggestedQuestions: [
          'What are the leasing restrictions?',
          'What is the current dues assessment?',
          'How do I submit an ARC application?'
        ]
      });
    }
  });

  // API Route: Document Summarizer
  app.post('/api/documents/summarize', async (req, res) => {
    try {
      const { docId, driveFile, customDoc, aiConfig } = req.body;
      let targetDoc: any = null;

      if (customDoc && customDoc.content) {
        targetDoc = customDoc;
      } else if (docId) {
        // Look up in active indexed documents first
        const activeDocs = getActiveIndexedDocs();
        targetDoc = activeDocs.find(d => d.id === docId);
      }
      
      if (!targetDoc && driveFile) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing Authorization header' });
        }
        const accessToken = authHeader.split(' ')[1];
        targetDoc = await extractDocumentContent(accessToken, driveFile);
      }

      if (!targetDoc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const summaryData = await generateDocumentSummary(targetDoc, aiConfig);
      res.json({ document: targetDoc.name, summary: summaryData });
    } catch (error: any) {
      console.error('Error in /api/documents/summarize:', error);
      res.status(500).json({ error: error.message || 'Failed to summarize document' });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HOA Document Assistant Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
