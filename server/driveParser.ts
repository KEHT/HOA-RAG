import { PDFParse } from 'pdf-parse';
import { extractTextAndDataFromImage } from './gemini';

export interface ParsedDoc {
  id: string;
  name: string;
  category: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general';
  mimeType: string;
  modifiedTime?: string;
  content: string;
  summary?: string;
}

// In-memory document text cache: key is fileId + modifiedTime
const documentCache = new Map<string, ParsedDoc>();

export function categorizeHOADocument(name: string): 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general' {
  const lower = name.toLowerCase();
  if (lower.includes('bylaw') || lower.includes('cc&r') || lower.includes('ccr') || lower.includes('declaration') || lower.includes('covenant') || lower.includes('articles of inc')) {
    return 'bylaws';
  }
  if (lower.includes('minute') || lower.includes('board meeting') || lower.includes('annual meeting') || lower.includes('agenda') || lower.includes('meeting')) {
    return 'minutes';
  }
  if (lower.includes('budget') || lower.includes('financial') || lower.includes('reserve') || lower.includes('dues') || lower.includes('assessment') || lower.includes('audit') || lower.includes('balance sheet') || lower.includes('income') || lower.includes('expense') || lower.includes('statement')) {
    return 'financials';
  }
  if (lower.includes('architectural') || lower.includes('arc') || lower.includes('design') || lower.includes('paint') || lower.includes('solar') || lower.includes('guideline') || lower.includes('color palette')) {
    return 'architectural';
  }
  if (lower.includes('rule') || lower.includes('regulation') || lower.includes('policy') || lower.includes('handbook') || lower.includes('pool') || lower.includes('pet') || lower.includes('parking') || lower.includes('fine')) {
    return 'rules';
  }
  return 'general';
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
  url.searchParams.set('fields', 'files(id, name, modifiedTime, parents)');
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

export async function fetchDriveFolderTreeAndFiles(
  accessToken: string,
  rootFolderId: string = 'root',
  searchQuery?: string
) {
  // 1. Resolve root folder info
  let rootInfo: { id: string; name: string };
  try {
    rootInfo = await fetchDriveFolderInfo(accessToken, rootFolderId);
  } catch (e) {
    console.warn(`Could not resolve root folder ${rootFolderId}, falling back to root:`, e);
    rootInfo = { id: 'root', name: 'My Drive' };
  }

  // 2. Discover all nested subfolders recursively (BFS)
  const folderMap = new Map<string, { id: string; name: string; path: string; parents?: string[] }>();
  folderMap.set(rootInfo.id, {
    id: rootInfo.id,
    name: rootInfo.name,
    path: rootInfo.name,
  });

  const queue: string[] = [rootInfo.id];
  const maxFoldersToTraverse = 100;

  while (queue.length > 0 && folderMap.size < maxFoldersToTraverse) {
    const currentParentId = queue.shift()!;
    const parentFolderData = folderMap.get(currentParentId);
    const parentPath = parentFolderData ? parentFolderData.path : rootInfo.name;

    try {
      let pageToken: string | undefined = undefined;
      do {
        let subQuery = "trashed = false and mimeType = 'application/vnd.google-apps.folder'";
        subQuery += ` and '${currentParentId}' in parents`;

        const folderUrl = new URL('https://www.googleapis.com/drive/v3/files');
        folderUrl.searchParams.set('q', subQuery);
        folderUrl.searchParams.set('fields', 'nextPageToken, files(id, name, modifiedTime, parents)');
        folderUrl.searchParams.set('pageSize', '100');
        folderUrl.searchParams.set('orderBy', 'name');
        if (pageToken) {
          folderUrl.searchParams.set('pageToken', pageToken);
        }

        const response = await fetch(folderUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          const childFolders = data.files || [];
          for (const child of childFolders) {
            if (!folderMap.has(child.id)) {
              const childPath = `${parentPath} / ${child.name}`;
              folderMap.set(child.id, {
                id: child.id,
                name: child.name,
                path: childPath,
                parents: child.parents,
              });
              queue.push(child.id);
            }
          }
          pageToken = data.nextPageToken;
        } else {
          break;
        }
      } while (pageToken && folderMap.size < maxFoldersToTraverse);
    } catch (err) {
      console.warn(`Error querying subfolders of ${currentParentId}:`, err);
    }
  }

  // 3. Collect all documents inside all discovered folders (chunk in batches of 15)
  const allFolderIds = Array.from(folderMap.keys());
  const batchSize = 15;
  const collectedFiles: any[] = [];
  const seenFileIds = new Set<string>();

  for (let i = 0; i < allFolderIds.length; i += batchSize) {
    const batch = allFolderIds.slice(i, i + batchSize);
    const parentClauses = batch.map(id => `'${id}' in parents`).join(' or ');

    let docQuery = `trashed = false and mimeType != 'application/vnd.google-apps.folder' and (${parentClauses}) and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/pdf' or mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp' or mimeType = 'image/gif')`;

    if (searchQuery && searchQuery.trim()) {
      const escaped = searchQuery.replace(/'/g, "\\'");
      docQuery += ` and (name contains '${escaped}' or fullText contains '${escaped}')`;
    }

    try {
      let docPageToken: string | undefined = undefined;
      do {
        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', docQuery);
        url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink, parents, thumbnailLink)');
        url.searchParams.set('pageSize', '100');
        url.searchParams.set('orderBy', 'modifiedTime desc');
        if (docPageToken) {
          url.searchParams.set('pageToken', docPageToken);
        }

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          for (const file of data.files || []) {
            // STRICT CONTAINMENT CHECK: file MUST have a parent inside the discovered folderMap
            const matchingParentId = file.parents?.find((p: string) => folderMap.has(p));
            if (!matchingParentId) {
              continue;
            }

            if (!seenFileIds.has(file.id)) {
              seenFileIds.add(file.id);

              const parentMeta = folderMap.get(matchingParentId);
              const category = categorizeHOADocument(file.name);
              const lower = file.name.toLowerCase();
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
                file.mimeType.startsWith('image/');

              collectedFiles.push({
                id: file.id,
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                modifiedTime: file.modifiedTime,
                iconLink: file.iconLink,
                webViewLink: file.webViewLink,
                parents: file.parents,
                folderId: matchingParentId,
                folderName: parentMeta ? parentMeta.name : rootInfo.name,
                folderPath: parentMeta ? parentMeta.path : rootInfo.name,
                category,
                isHOAKeywordMatch,
              });
            }
          }
          docPageToken = data.nextPageToken;
        } else {
          break;
        }
      } while (docPageToken);
    } catch (err) {
      console.warn('Error fetching batch of document files:', err);
    }
  }

  // Build subfolders list (excluding root)
  const subfoldersList = Array.from(folderMap.values())
    .filter(f => f.id !== rootInfo.id)
    .map(f => {
      const fileCount = collectedFiles.filter(doc => doc.folderId === f.id).length;
      return {
        id: f.id,
        name: f.name,
        path: f.path,
        parents: f.parents,
        fileCount,
      };
    });

  return {
    rootFolder: rootInfo,
    subfolders: subfoldersList,
    files: collectedFiles,
    totalIndexedFiles: collectedFiles.length,
    totalIndexedSubfolders: subfoldersList.length,
  };
}

export async function fetchDriveFilesList(accessToken: string, folderId?: string, searchQuery?: string) {
  let query = "trashed = false and (mimeType = 'application/vnd.google-apps.folder' or mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/pdf' or mimeType = 'text/plain' or mimeType = 'text/markdown' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp' or mimeType = 'image/gif')";

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
      file.mimeType.startsWith('image/');

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
    };
  });

  return files;
}

export async function extractDocumentContent(accessToken: string, file: { id: string; name: string; mimeType: string; modifiedTime?: string }): Promise<ParsedDoc> {
  const cacheKey = `${file.id}_${file.modifiedTime || ''}`;
  if (documentCache.has(cacheKey)) {
    return documentCache.get(cacheKey)!;
  }

  let textContent = '';
  let docSummary: string | undefined = undefined;
  let category = categorizeHOADocument(file.name);

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
    } else if (file.mimeType === 'application/pdf') {
      // Download binary PDF stream and parse with PDFParse
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const uint8Data = new Uint8Array(arrayBuf);
        const parser = new PDFParse({ data: uint8Data });
        try {
          const textResult = await parser.getText();
          textContent = textResult.text || '';
        } finally {
          await parser.destroy();
        }
      } else {
        textContent = `[Could not download PDF ${file.name}: ${res.statusText}]`;
      }
    } else if (file.mimeType.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i)) {
      // Download binary image stream and perform OCR with Gemini 3.7 Flash multimodal
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString('base64');
        const extracted = await extractTextAndDataFromImage(base64, file.mimeType || 'image/jpeg', file.name);
        textContent = extracted.textContent;
        docSummary = extracted.summary;
        if (extracted.category && extracted.category !== 'general') {
          category = extracted.category;
        }
      } else {
        textContent = `[Could not download image ${file.name}: ${res.statusText}]`;
      }
    } else if (file.mimeType.startsWith('text/')) {
      // Plain text / markdown file
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
  };

  documentCache.set(cacheKey, parsed);
  return parsed;
}
