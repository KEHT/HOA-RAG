import fs from 'fs';
import path from 'path';
import { 
  parseWordDocument, 
  parseExcelSpreadsheet, 
  parsePowerPointPresentation, 
  parsePdfBuffer 
} from './officeParser';
import { extractTextAndDataFromImage } from './gemini';

export interface ParsedDoc {
  id: string;
  name: string;
  category: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general';
  mimeType: string;
  modifiedTime?: string;
  content: string;
  summary?: string;
  keyHighlights?: string[];
  importantDatesOrAmounts?: string[];
  folderId?: string;
  folderName?: string;
  folderPath?: string;
  subfolderBreadcrumbs?: string[];
  size?: number | string;
  webViewLink?: string;
  iconLink?: string;
  isHOAKeywordMatch?: boolean;
  isImageDoc?: boolean;
  isOfficeDoc?: boolean;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parentId?: string;
  modifiedTime?: string;
}

export interface IncrementalSyncResult {
  folderId: string;
  folderName: string;
  totalSubfolders: number;
  totalFiles: number;
  newOrUpdatedCount: number;
  cachedCount: number;
  removedCount: number;
  files: ParsedDoc[];
  subfolders: FolderNode[];
}

// Persistent storage file path on server
const STORAGE_DIR = path.join(process.cwd(), 'data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'hoa_persistent_index.json');

// In-memory document cache: key is fileId + modifiedTime
const documentCache = new Map<string, ParsedDoc>();

// In-memory active indexed folder state
let activeFolderScopeId: string = 'root';
let activeFolderScopeName: string = 'My Drive';
const activeFolderIndexedDocs = new Map<string, ParsedDoc>();
let activeSubfoldersList: FolderNode[] = [];

// Persistent multi-folder index store: folderId -> Map<fileId, ParsedDoc>
const persistentFolderStores = new Map<string, Map<string, ParsedDoc>>();

/**
 * Load persistent index from disk on initialization
 */
function initPersistentStore() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const rawData = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const json = JSON.parse(rawData);
      
      if (json.folders && typeof json.folders === 'object') {
        for (const [folderId, docsList] of Object.entries<any>(json.folders)) {
          const docMap = new Map<string, ParsedDoc>();
          if (Array.isArray(docsList)) {
            for (const doc of docsList) {
              if (doc && doc.id) {
                // Check if cached doc is an incomplete image placeholder
                const isImageFile = (doc.mimeType && doc.mimeType.startsWith('image/')) || !!doc.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i) || doc.isImageDoc;
                const isInvalidImageCache = isImageFile && (
                  !doc.content ||
                  doc.content.includes('[Image record uploaded') ||
                  doc.content.includes('[Extracted text from') ||
                  doc.content.length < 50
                );

                if (!isInvalidImageCache) {
                  docMap.set(doc.id, doc);
                  const cacheKey = `${doc.id}_${doc.modifiedTime || ''}`;
                  documentCache.set(cacheKey, doc);
                }
              }
            }
          }
          persistentFolderStores.set(folderId, docMap);
        }
      }

      if (json.activeScope) {
        activeFolderScopeId = json.activeScope.folderId || 'root';
        activeFolderScopeName = json.activeScope.folderName || 'My Drive';
        activeSubfoldersList = json.activeScope.subfolders || [];
        
        const currentStore = persistentFolderStores.get(activeFolderScopeId);
        if (currentStore) {
          activeFolderIndexedDocs.clear();
          for (const [id, doc] of currentStore.entries()) {
            activeFolderIndexedDocs.set(id, doc);
          }
        }
      }
      console.log(`[Drive Indexer] Loaded persistent index from disk with ${persistentFolderStores.size} folder store(s).`);
    }
  } catch (err) {
    console.warn('[Drive Indexer] Could not load persistent index from disk:', err);
  }
}

/**
 * Save persistent index to disk
 */
function savePersistentStore() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    const serializableFolders: Record<string, ParsedDoc[]> = {};
    for (const [folderId, docMap] of persistentFolderStores.entries()) {
      serializableFolders[folderId] = Array.from(docMap.values());
    }

    const payload = {
      version: 1,
      lastUpdated: new Date().toISOString(),
      activeScope: {
        folderId: activeFolderScopeId,
        folderName: activeFolderScopeName,
        subfolders: activeSubfoldersList,
      },
      folders: serializableFolders,
    };

    fs.writeFileSync(STORAGE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Drive Indexer] Could not save persistent index to disk:', err);
  }
}

// Initialize persistent storage
initPersistentStore();

export function categorizeHOADocument(name: string): 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general' {
  const lower = name.toLowerCase();
  if (lower.includes('bylaw') || lower.includes('cc&r') || lower.includes('ccr') || lower.includes('declaration') || lower.includes('covenant') || lower.includes('articles of inc') || lower.includes('incorporation')) {
    return 'bylaws';
  }
  if (lower.includes('minute') || lower.includes('board meeting') || lower.includes('annual meeting') || lower.includes('agenda') || lower.includes('meeting') || lower.includes('resolution')) {
    return 'minutes';
  }
  if (lower.includes('budget') || lower.includes('financial') || lower.includes('reserve') || lower.includes('dues') || lower.includes('assessment') || lower.includes('audit') || lower.includes('balance sheet') || lower.includes('income') || lower.includes('expense') || lower.includes('statement') || lower.includes('delinquenc') || lower.includes('p&l') || lower.includes('ledger')) {
    return 'financials';
  }
  if (lower.includes('architectural') || lower.includes('arc') || lower.includes('design') || lower.includes('paint') || lower.includes('solar') || lower.includes('guideline') || lower.includes('color palette') || lower.includes('roof') || lower.includes('fence')) {
    return 'architectural';
  }
  if (lower.includes('rule') || lower.includes('regulation') || lower.includes('policy') || lower.includes('handbook') || lower.includes('pool') || lower.includes('pet') || lower.includes('parking') || lower.includes('fine') || lower.includes('towing') || lower.includes('noise')) {
    return 'rules';
  }
  return 'general';
}

/**
 * Search Google Drive for folders named "HOA"
 */
export async function searchHOAFolders(accessToken: string): Promise<Array<{ id: string; name: string; modifiedTime?: string; parents?: string[]; path?: string }>> {
  const query = "trashed = false and mimeType = 'application/vnd.google-apps.folder' and (name = 'HOA' or name = 'hoa' or name contains 'HOA')";
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id, name, modifiedTime, parents, webViewLink)');
  url.searchParams.set('pageSize', '50');
  url.searchParams.set('orderBy', 'name,modifiedTime desc');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to search for HOA folders (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const allFolders: any[] = data.files || [];

  // Filter for exact "HOA" matches first (case-insensitive)
  const exactMatches = allFolders.filter(f => f.name.trim().toLowerCase() === 'hoa');
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  // If no exact "HOA" name, return folders that contain "HOA"
  return allFolders;
}

export async function fetchDriveFolderInfo(accessToken: string, folderId: string): Promise<{ id: string; name: string; parents?: string[]; webViewLink?: string }> {
  if (folderId === 'root') {
    return { id: 'root', name: 'My Drive' };
  }

  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType,parents,webViewLink`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch folder info (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    parents: data.parents,
    webViewLink: data.webViewLink,
  };
}

export async function fetchDriveFoldersList(accessToken: string, parentFolderId?: string): Promise<Array<{ id: string; name: string; modifiedTime?: string }>> {
  let query = "trashed = false and mimeType = 'application/vnd.google-apps.folder'";
  if (parentFolderId && parentFolderId !== 'all') {
    query += ` and '${parentFolderId}' in parents`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id, name, modifiedTime, parents), nextPageToken');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('orderBy', 'name');

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
}

const SUPPORTED_DRIVE_MIME_TYPES = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.ms-powerpoint', // ppt
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/rtf',
  'application/rtf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
];

/**
 * Recursively discover all subfolders and files inside a root folder.
 */
export async function recursivelyScanFolder(
  accessToken: string,
  rootFolderId: string,
  rootFolderName: string = 'Selected Folder'
): Promise<{ folders: FolderNode[]; files: any[] }> {
  const discoveredFolders: FolderNode[] = [];
  const discoveredFiles: any[] = [];
  const visitedFolderIds = new Set<string>();

  // Initialize root folder node
  const rootNode: FolderNode = {
    id: rootFolderId,
    name: rootFolderName,
    path: rootFolderName,
  };
  discoveredFolders.push(rootNode);

  const folderQueue: FolderNode[] = [rootNode];

  while (folderQueue.length > 0) {
    const currentFolder = folderQueue.shift()!;
    if (visitedFolderIds.has(currentFolder.id)) {
      continue;
    }
    visitedFolderIds.add(currentFolder.id);

    // 1. Fetch all child subfolders in currentFolder (with pagination)
    let folderPageToken: string | null = null;
    do {
      const folderUrl = new URL('https://www.googleapis.com/drive/v3/files');
      const folderQuery = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and '${currentFolder.id}' in parents`;
      folderUrl.searchParams.set('q', folderQuery);
      folderUrl.searchParams.set('fields', 'nextPageToken, files(id, name, modifiedTime, parents)');
      folderUrl.searchParams.set('pageSize', '100');
      folderUrl.searchParams.set('orderBy', 'name');
      if (folderPageToken) {
        folderUrl.searchParams.set('pageToken', folderPageToken);
      }

      const res = await fetch(folderUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        console.warn(`Could not list subfolders for ${currentFolder.name} (${currentFolder.id}):`, res.statusText);
        break;
      }

      const data: any = await res.json();
      const childFolders = data.files || [];
      for (const child of childFolders) {
        if (!visitedFolderIds.has(child.id)) {
          const childPath = currentFolder.path ? `${currentFolder.path}/${child.name}` : child.name;
          const childNode: FolderNode = {
            id: child.id,
            name: child.name,
            path: childPath,
            parentId: currentFolder.id,
            modifiedTime: child.modifiedTime,
          };
          discoveredFolders.push(childNode);
          folderQueue.push(childNode);
        }
      }
      folderPageToken = data.nextPageToken || null;
    } while (folderPageToken);

    // 2. Fetch all supported files in currentFolder (with pagination)
    let filePageToken: string | null = null;
    const mimeQuery = SUPPORTED_DRIVE_MIME_TYPES.map(m => `mimeType = '${m}'`).join(' or ');
    const fileQuery = `trashed = false and mimeType != 'application/vnd.google-apps.folder' and (${mimeQuery}) and '${currentFolder.id}' in parents`;

    do {
      const fileUrl = new URL('https://www.googleapis.com/drive/v3/files');
      fileUrl.searchParams.set('q', fileQuery);
      fileUrl.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink, parents, thumbnailLink)');
      fileUrl.searchParams.set('pageSize', '100');
      fileUrl.searchParams.set('orderBy', 'name');
      if (filePageToken) {
        fileUrl.searchParams.set('pageToken', filePageToken);
      }

      const fileRes = await fetch(fileUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!fileRes.ok) {
        console.warn(`Could not list files for folder ${currentFolder.name} (${currentFolder.id}):`, fileRes.statusText);
        break;
      }

      const fileData: any = await fileRes.json();
      const filesInFolder = fileData.files || [];
      for (const file of filesInFolder) {
        const category = categorizeHOADocument(file.name);
        const lower = file.name.toLowerCase();
        const isOfficeDoc = lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.pptx') || lower.endsWith('.ppt') || file.mimeType.includes('officedocument') || file.mimeType.includes('msword') || file.mimeType.includes('ms-excel');
        const isImageDoc = file.mimeType.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i);

        const isHOAKeywordMatch =
          lower.includes('hoa') ||
          lower.includes('homeowner') ||
          lower.includes('bylaw') ||
          lower.includes('cc&r') ||
          lower.includes('minute') ||
          lower.includes('meeting') ||
          lower.includes('budget') ||
          lower.includes('reserve') ||
          lower.includes('finan') ||
          lower.includes('architect') ||
          lower.includes('rule') ||
          lower.includes('association') ||
          isOfficeDoc ||
          isImageDoc;

        discoveredFiles.push({
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          size: file.size,
          modifiedTime: file.modifiedTime,
          iconLink: file.iconLink,
          webViewLink: file.webViewLink,
          parents: file.parents,
          folderId: currentFolder.id,
          folderName: currentFolder.name,
          folderPath: currentFolder.path,
          category,
          isHOAKeywordMatch,
          isOfficeDoc,
          isImageDoc: !!isImageDoc,
        });
      }
      filePageToken = fileData.nextPageToken || null;
    } while (filePageToken);
  }

  return { folders: discoveredFolders, files: discoveredFiles };
}

/**
 * Concurrently parse files with a bounded pool limit.
 */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Parse all files in all subfolders and that folder with INCREMENTAL SYNC:
 * - Reuses existing parsed cache for files where modifiedTime has NOT changed.
 * - Only downloads & parses new or modified files.
 * - Removes files deleted/moved out of the folder from the persistent index.
 */
export async function indexAndParseFolder(
  accessToken: string,
  rootFolderId: string,
  rootFolderName: string = 'Selected Folder',
  forceFullReindex: boolean = false,
  aiConfig?: any
): Promise<IncrementalSyncResult> {
  if (rootFolderId !== 'root' && (rootFolderName === 'Selected Folder' || !rootFolderName)) {
    try {
      const info = await fetchDriveFolderInfo(accessToken, rootFolderId);
      rootFolderName = info.name || rootFolderName;
    } catch {
      // Keep default
    }
  }

  console.log(`[Drive Indexer] Incrementally scanning folder "${rootFolderName}" (${rootFolderId}) and all subfolders...`);
  const { folders, files } = await recursivelyScanFolder(accessToken, rootFolderId, rootFolderName);
  console.log(`[Drive Indexer] Discovered ${folders.length - 1} subfolders and ${files.length} files across folder tree.`);

  const currentFolderStore = persistentFolderStores.get(rootFolderId) || new Map<string, ParsedDoc>();
  const validFileIds = new Set<string>(files.map(f => f.id));

  // Count removed files
  let removedCount = 0;
  for (const existingId of currentFolderStore.keys()) {
    if (!validFileIds.has(existingId)) {
      currentFolderStore.delete(existingId);
      removedCount++;
    }
  }

  // Update active state references
  activeFolderScopeId = rootFolderId;
  activeFolderScopeName = rootFolderName;
  activeSubfoldersList = folders;
  activeFolderIndexedDocs.clear();

  let cachedCount = 0;
  let newOrUpdatedCount = 0;

  // Separate files into cached vs files that require parsing
  const filesToParse: any[] = [];
  const resolvedDocs: ParsedDoc[] = [];

  for (const file of files) {
    const cacheKey = `${file.id}_${file.modifiedTime || ''}`;
    const cached = (!forceFullReindex) ? (documentCache.get(cacheKey) || currentFolderStore.get(file.id)) : null;

    const isImageFile = file.mimeType.startsWith('image/') || !!file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i);
    const isInvalidImageCache = isImageFile && (
      !cached?.content ||
      cached.content.includes('[Image record uploaded') ||
      cached.content.includes('[Extracted text from') ||
      cached.content.length < 50
    );

    // If cached document exists, modifiedTime matches, and content is not an error message -> reuse immediately!
    if (
      cached &&
      !isInvalidImageCache &&
      cached.modifiedTime === file.modifiedTime &&
      cached.content &&
      !cached.content.startsWith('[Could not') &&
      !cached.content.startsWith('[Error')
    ) {
      cached.folderId = file.folderId;
      cached.folderName = file.folderName;
      cached.folderPath = file.folderPath;
      cached.size = file.size;
      cached.webViewLink = file.webViewLink;
      cached.iconLink = file.iconLink;
      cached.isHOAKeywordMatch = file.isHOAKeywordMatch;
      cached.isOfficeDoc = file.isOfficeDoc;
      cached.isImageDoc = file.isImageDoc;

      resolvedDocs.push(cached);
      currentFolderStore.set(cached.id, cached);
      activeFolderIndexedDocs.set(cached.id, cached);
      cachedCount++;
    } else {
      filesToParse.push(file);
    }
  }

  console.log(`[Drive Indexer] Incremental sync: ${cachedCount} files cached & reused, ${filesToParse.length} new/modified files to parse.`);

  // Concurrently parse new or modified files
  if (filesToParse.length > 0) {
    const parsedNewDocs = await mapConcurrent(filesToParse, 5, async (file) => {
      try {
        const parsed = await extractDocumentContent(accessToken, file, aiConfig);
        parsed.folderId = file.folderId;
        parsed.folderName = file.folderName;
        parsed.folderPath = file.folderPath;
        parsed.size = file.size;
        parsed.webViewLink = file.webViewLink;
        parsed.iconLink = file.iconLink;
        parsed.isHOAKeywordMatch = file.isHOAKeywordMatch;
        parsed.isOfficeDoc = file.isOfficeDoc;
        if (file.mimeType.startsWith('image/')) {
          parsed.isImageDoc = true;
        }

        currentFolderStore.set(parsed.id, parsed);
        activeFolderIndexedDocs.set(parsed.id, parsed);
        newOrUpdatedCount++;
        return parsed;
      } catch (err: any) {
        console.error(`Failed to parse file "${file.name}" (${file.id}):`, err);
        const fallbackParsed: ParsedDoc = {
          id: file.id,
          name: file.name,
          category: file.category || 'general',
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          content: `[Could not extract text: ${err.message || 'Unknown error'}]`,
          folderId: file.folderId,
          folderName: file.folderName,
          folderPath: file.folderPath,
          size: file.size,
          webViewLink: file.webViewLink,
          iconLink: file.iconLink,
          isHOAKeywordMatch: file.isHOAKeywordMatch,
        };
        currentFolderStore.set(fallbackParsed.id, fallbackParsed);
        activeFolderIndexedDocs.set(fallbackParsed.id, fallbackParsed);
        newOrUpdatedCount++;
        return fallbackParsed;
      }
    });

    resolvedDocs.push(...parsedNewDocs);
  }

  // Update persistent folder store map and save to disk
  persistentFolderStores.set(rootFolderId, currentFolderStore);
  savePersistentStore();

  console.log(`[Drive Indexer] Indexed total ${resolvedDocs.length} files (${newOrUpdatedCount} new/modified, ${cachedCount} unchanged, ${removedCount} removed).`);

  return {
    folderId: rootFolderId,
    folderName: rootFolderName,
    totalSubfolders: Math.max(0, folders.length - 1),
    totalFiles: resolvedDocs.length,
    newOrUpdatedCount,
    cachedCount,
    removedCount,
    files: resolvedDocs,
    subfolders: folders,
  };
}

export function getActiveIndexedDocs(): ParsedDoc[] {
  return Array.from(activeFolderIndexedDocs.values());
}

export function getActiveFolderMeta() {
  return {
    folderId: activeFolderScopeId,
    folderName: activeFolderScopeName,
    subfolders: activeSubfoldersList,
    totalIndexedDocs: activeFolderIndexedDocs.size,
  };
}

export function clearActiveFolderIndex() {
  activeFolderIndexedDocs.clear();
  activeFolderScopeId = 'root';
  activeFolderScopeName = 'My Drive';
  activeSubfoldersList = [];
  savePersistentStore();
}

export async function fetchDriveFilesList(accessToken: string, folderId?: string, searchQuery?: string) {
  if (folderId && folderId === activeFolderScopeId && activeFolderIndexedDocs.size > 0) {
    const docs = Array.from(activeFolderIndexedDocs.values());
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return docs.filter(d => d.name.toLowerCase().includes(q) || (d.content && d.content.toLowerCase().includes(q)));
    }
    return docs;
  }

  const mimeQuery = SUPPORTED_DRIVE_MIME_TYPES.map(m => `mimeType = '${m}'`).join(' or ');
  let query = `trashed = false and (mimeType = 'application/vnd.google-apps.folder' or ${mimeQuery})`;

  if (folderId && folderId !== 'all') {
    query += ` and '${folderId}' in parents`;
  }

  if (searchQuery && searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    query += ` and (name contains '${escaped}' or fullText contains '${escaped}')`;
  }

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', query);
  url.searchParams.set('fields', 'files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink, parents, thumbnailLink)');
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('orderBy', 'folder,modifiedTime desc');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const files = (data.files || []).map((file: any) => {
    const category = categorizeHOADocument(file.name);
    const lower = file.name.toLowerCase();
    const isOfficeDoc = lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.pptx') || lower.endsWith('.ppt') || file.mimeType.includes('officedocument') || file.mimeType.includes('msword') || file.mimeType.includes('ms-excel');
    const isImageDoc = file.mimeType.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i);

    const isHOAKeywordMatch =
      lower.includes('hoa') ||
      lower.includes('homeowner') ||
      lower.includes('bylaw') ||
      lower.includes('cc&r') ||
      lower.includes('minute') ||
      lower.includes('meeting') ||
      lower.includes('budget') ||
      lower.includes('reserve') ||
      lower.includes('finan') ||
      lower.includes('architect') ||
      lower.includes('rule') ||
      lower.includes('association') ||
      isOfficeDoc ||
      isImageDoc;

    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      modifiedTime: file.modifiedTime,
      iconLink: file.iconLink,
      webViewLink: file.webViewLink,
      parents: file.parents,
      category,
      isHOAKeywordMatch,
      isOfficeDoc,
      isImageDoc: !!isImageDoc,
    };
  });

  return files;
}

export async function extractDocumentContent(
  accessToken: string,
  file: { id: string; name: string; mimeType: string; modifiedTime?: string },
  aiConfig?: any
): Promise<ParsedDoc> {
  const cacheKey = `${file.id}_${file.modifiedTime || ''}`;
  const isImageFile = file.mimeType.startsWith('image/') || !!file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i);

  if (documentCache.has(cacheKey)) {
    const cached = documentCache.get(cacheKey)!;
    const isInvalidImageCache = isImageFile && (
      !cached.content ||
      cached.content.includes('[Image record uploaded') ||
      cached.content.includes('[Extracted text from') ||
      cached.content.length < 50
    );
    if (!isInvalidImageCache) {
      return cached;
    }
  }

  let textContent = '';
  let docSummary: string | undefined = undefined;
  let keyHighlights: string[] = [];
  let importantDatesOrAmounts: string[] = [];
  let category = categorizeHOADocument(file.name);
  const lowerName = file.name.toLowerCase();

  try {
    if (file.mimeType === 'application/vnd.google-apps.document') {
      // Export Google Doc as text/plain
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`;
      const res = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        textContent = await res.text();
      } else {
        textContent = `[Could not export Google Doc ${file.name}: ${res.statusText}]`;
      }
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Export Google Sheet as text/csv
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/csv`;
      const res = await fetch(exportUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        textContent = await res.text();
      } else {
        textContent = `[Could not export Google Sheet ${file.name}: ${res.statusText}]`;
      }
    } else if (
      lowerName.endsWith('.docx') || 
      lowerName.endsWith('.doc') || 
      file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      file.mimeType === 'application/msword'
    ) {
      // MS Word Document
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const parsedWord = await parseWordDocument(buffer);
        textContent = parsedWord.text;
      } else {
        textContent = `[Could not download MS Word file ${file.name}: ${res.statusText}]`;
      }
    } else if (
      lowerName.endsWith('.xlsx') || 
      lowerName.endsWith('.xls') || 
      file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
      file.mimeType === 'application/vnd.ms-excel'
    ) {
      // MS Excel Spreadsheet
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const parsedExcel = await parseExcelSpreadsheet(buffer);
        textContent = parsedExcel.text;
      } else {
        textContent = `[Could not download MS Excel file ${file.name}: ${res.statusText}]`;
      }
    } else if (
      lowerName.endsWith('.pptx') || 
      lowerName.endsWith('.ppt') || 
      file.mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || 
      file.mimeType === 'application/vnd.ms-powerpoint'
    ) {
      // MS PowerPoint Presentation
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const parsedPpt = await parsePowerPointPresentation(buffer);
        textContent = parsedPpt.text;
      } else {
        textContent = `[Could not download MS PowerPoint file ${file.name}: ${res.statusText}]`;
      }
    } else if (file.mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
      // PDF document
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const parsedPdf = await parsePdfBuffer(buffer);
        textContent = parsedPdf.text;
      } else {
        textContent = `[Could not download PDF ${file.name}: ${res.statusText}]`;
      }
    } else if (file.mimeType.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i)) {
      // Image document
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');
        const extracted = await extractTextAndDataFromImage(base64, file.mimeType || 'image/jpeg', file.name, aiConfig);
        textContent = extracted.textContent;
        docSummary = extracted.summary;
        if (extracted.category && extracted.category !== 'general') {
          category = extracted.category;
        }
        keyHighlights = extracted.keyHighlights || [];
        importantDatesOrAmounts = extracted.importantDatesOrAmounts || [];
      } else {
        textContent = `[Could not download image ${file.name}: ${res.statusText}]`;
      }
    } else if (file.mimeType.startsWith('text/') || lowerName.endsWith('.txt') || lowerName.endsWith('.md') || lowerName.endsWith('.csv') || lowerName.endsWith('.rtf')) {
      // Plain text / markdown / csv file
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        textContent = await res.text();
      } else {
        textContent = `[Could not download text file ${file.name}: ${res.statusText}]`;
      }
    } else {
      textContent = `[Unsupported file format: ${file.mimeType}]`;
    }
  } catch (err: any) {
    console.error(`Error parsing file ${file.name} (${file.id}):`, err);
    textContent = `[Error parsing document: ${err.message || 'Unknown error'}]`;
  }

  const parsed: ParsedDoc = {
    id: file.id,
    name: file.name,
    category,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    content: textContent,
    summary: docSummary,
    keyHighlights,
    importantDatesOrAmounts,
    isImageDoc: isImageFile,
  };

  documentCache.set(cacheKey, parsed);
  return parsed;
}
