import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { SAMPLE_HOA_DOCUMENTS } from './server/sampleDocuments';
import { fetchDriveFilesList, fetchDriveFolderTreeAndFiles, extractDocumentContent, fetchDriveFolderInfo, fetchDriveFoldersList, ParsedDoc } from './server/driveParser';
import { askHOAChatbot, generateDocumentSummary, extractTextAndDataFromImage } from './server/gemini';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '30mb' }));

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    });
  });

  // API Route: Get pre-loaded sample HOA document library
  app.get('/api/documents/sample', (req, res) => {
    const list = SAMPLE_HOA_DOCUMENTS.map(doc => ({
      id: doc.id,
      name: doc.name,
      category: doc.category,
      mimeType: doc.mimeType,
      modifiedTime: doc.modifiedTime,
      summary: doc.summary,
      contentLength: doc.content.length,
      isSample: true,
    }));
    res.json({ documents: list });
  });

  // API Route: Direct Parse & Index Image (JPG/PNG/WEBP of meetings or financials)
  app.post('/api/documents/parse-image', async (req, res) => {
    try {
      const { imageBase64, mimeType, fileName } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 in request body' });
      }

      const result = await extractTextAndDataFromImage(
        imageBase64,
        mimeType || 'image/jpeg',
        fileName || 'Scanned Document.jpg'
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
      res.status(500).json({ error: error.message || 'Failed to parse image with Gemini' });
    }
  });

  // API Route: List Google Drive files with user Bearer token (recursively indexes selected folder)
  app.get('/api/drive/files', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid Google OAuth Authorization header' });
      }
      const accessToken = authHeader.split(' ')[1];
      const folderId = (req.query.folderId as string) || 'root';
      const searchQuery = req.query.q as string | undefined;

      const result = await fetchDriveFolderTreeAndFiles(accessToken, folderId, searchQuery);
      res.json(result);
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
        useSampleLibrary = false,
        filterCategory = 'all',
        driveFilesToExtract = [],
        customDocuments = [],
      } = req.body;

      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Missing question parameter' });
      }

      let documentsToQuery: Array<ParsedDoc | typeof SAMPLE_HOA_DOCUMENTS[0]> = [];

      // Custom/Uploaded parsed documents (such as OCR-extracted JPG images)
      if (Array.isArray(customDocuments) && customDocuments.length > 0) {
        for (const cDoc of customDocuments) {
          if (selectedDocIds.length === 0 || selectedDocIds.includes(cDoc.id)) {
            documentsToQuery.push(cDoc);
          }
        }
      }

      // If user has sample docs enabled or requested
      if (useSampleLibrary) {
        const sampleDocs = SAMPLE_HOA_DOCUMENTS.filter(doc => {
          if (selectedDocIds.length > 0 && selectedDocIds.some((id: string) => id.startsWith('sample-'))) {
            return selectedDocIds.includes(doc.id);
          }
          return true;
        });
        documentsToQuery.push(...sampleDocs);
      }

      // If user has connected Google Drive and selected or provided Drive files
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ') && driveFilesToExtract.length > 0) {
        const accessToken = authHeader.split(' ')[1];
        for (const file of driveFilesToExtract) {
          // If specific docs were selected, only extract those
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
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error in /api/chat:', error);
      res.status(500).json({
        error: error.message || 'Internal server error processing question',
        answer: 'I encountered an issue querying the HOA documents. Please check your connection or try again.',
        sources: [],
        suggestedQuestions: [
          'What are the leasing restrictions?',
          'What is the 2026 dues assessment?',
          'How do I submit an ARC application?'
        ]
      });
    }
  });

  // API Route: Document Summarizer
  app.post('/api/documents/summarize', async (req, res) => {
    try {
      const { docId, driveFile, customDoc } = req.body;
      let targetDoc: any = null;

      if (customDoc && customDoc.content) {
        targetDoc = customDoc;
      } else if (docId && docId.startsWith('sample-')) {
        targetDoc = SAMPLE_HOA_DOCUMENTS.find(d => d.id === docId);
      } else if (driveFile) {
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

      const summaryData = await generateDocumentSummary(targetDoc);
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
