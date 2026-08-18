export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number | string;
  modifiedTime?: string;
  iconLink?: string;
  webViewLink?: string;
  parents?: string[];
  folderId?: string;
  folderName?: string;
  folderPath?: string;
  category?: 'bylaws' | 'minutes' | 'financials' | 'architectural' | 'rules' | 'general';
  isHOAKeywordMatch?: boolean;
  pageCount?: number;
  extractedLength?: number;
  snippet?: string;
  isImageDoc?: boolean;
  imageUrl?: string;
  content?: string;
  summary?: string;
  keyHighlights?: string[];
  importantDatesOrAmounts?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
  path?: string;
  parents?: string[];
  webViewLink?: string;
  modifiedTime?: string;
  fileCount?: number;
  subfolderCount?: number;
}

export interface FolderBreadcrumb {
  id: string;
  name: string;
}

export interface SourceCitation {
  fileId: string;
  fileName: string;
  category?: string;
  sectionOrClause?: string;
  pageNumber?: number;
  snippet: string;
  matchScore?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  sources?: SourceCitation[];
  suggestedQuestions?: string[];
  isThinking?: boolean;
  error?: boolean;
}

export interface HOAOverview {
  hoaName: string;
  bylawCount: number;
  minutesCount: number;
  financialCount: number;
  rulesCount: number;
  totalDocuments: number;
}
