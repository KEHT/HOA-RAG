import React, { useState, useRef } from 'react';
import { DriveFile, DriveFolder, FolderBreadcrumb } from '../types';
import { 
  Search, 
  CheckSquare, 
  Square, 
  FileText, 
  ExternalLink, 
  Sparkles, 
  Layers, 
  FileSpreadsheet, 
  BookOpen, 
  Calendar, 
  DollarSign, 
  Home, 
  ShieldAlert,
  AlertCircle,
  HelpCircle,
  Image as ImageIcon,
  UploadCloud,
  Folder,
  FolderOpen,
  FolderCheck,
  ChevronRight,
  RefreshCw,
  FolderTree,
  FileCode
} from 'lucide-react';

interface DriveDocumentBrowserProps {
  files: DriveFile[];
  selectedFileIds: string[];
  isLoading: boolean;
  hasDriveAccess: boolean;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSummarizeDoc: (doc: DriveFile) => void;
  onConnectDrive: () => void;
  onUploadFile?: (file: File) => Promise<void>;
  isUploadingFile?: boolean;
  // Folder scoping props
  currentFolderId: string;
  currentFolderName: string;
  folderBreadcrumbs: FolderBreadcrumb[];
  availableSubfolders?: DriveFolder[];
  onOpenFolderModal: () => void;
  onNavigateBreadcrumb: (index: number) => void;
  onScopeToFolder?: (folderId: string, folderName: string) => void;
  onReindexFolder?: () => void;
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All', icon: Layers },
  { id: 'bylaws', label: 'Bylaws', icon: BookOpen },
  { id: 'minutes', label: 'Minutes', icon: Calendar },
  { id: 'financials', label: 'Financials', icon: DollarSign },
  { id: 'architectural', label: 'ARC', icon: Home },
  { id: 'rules', label: 'Rules', icon: ShieldAlert },
];

export const DriveDocumentBrowser: React.FC<DriveDocumentBrowserProps> = ({
  files,
  selectedFileIds,
  isLoading,
  hasDriveAccess,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onSummarizeDoc,
  onConnectDrive,
  onUploadFile,
  isUploadingFile = false,
  currentFolderName = 'My Drive',
  folderBreadcrumbs = [{ id: 'root', name: 'My Drive' }],
  availableSubfolders = [],
  onOpenFolderModal,
  onNavigateBreadcrumb,
  onScopeToFolder,
  onReindexFolder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSubfolderFilter, setActiveSubfolderFilter] = useState('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      await onUploadFile(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onUploadFile) {
      await onUploadFile(file);
    }
  };

  // Distinct subfolder paths present in the indexed files
  const uniqueSubfolderPaths = Array.from(
    new Set(files.map(f => f.folderPath).filter((p): p is string => !!p && p !== 'Uploaded Files' && p !== 'Uploaded Scans'))
  );

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.snippet && file.snippet.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (file.folderPath && file.folderPath.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || file.category === activeCategory;
    const matchesSubfolder = activeSubfolderFilter === 'all' || file.folderPath === activeSubfolderFilter;
    return matchesSearch && matchesCategory && matchesSubfolder;
  });

  const getFileIcon = (file: DriveFile) => {
    const name = file.name.toLowerCase();
    if (file.mimeType.startsWith('image/') || name.match(/\.(jpe?g|png|webp|gif|bmp)$/i) || file.isImageDoc) {
      return <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />;
    }
    if (file.mimeType.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />;
    }
    if (name.endsWith('.docx') || name.endsWith('.doc') || file.mimeType.includes('wordprocessingml') || file.mimeType.includes('msword')) {
      return <FileText className="w-4 h-4 text-blue-600 shrink-0" />;
    }
    if (name.endsWith('.pptx') || name.endsWith('.ppt') || file.mimeType.includes('presentation')) {
      return <FileCode className="w-4 h-4 text-orange-600 shrink-0" />;
    }
    if (file.category === 'bylaws') {
      return <BookOpen className="w-4 h-4 text-[#2563EB] shrink-0" />;
    }
    if (file.category === 'financials') {
      return <DollarSign className="w-4 h-4 text-amber-600 shrink-0" />;
    }
    if (file.category === 'minutes') {
      return <Calendar className="w-4 h-4 text-sky-600 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-[#64748B] shrink-0" />;
  };

  const getCategoryBadge = (file: DriveFile) => {
    const name = file.name.toLowerCase();
    const isImage = !!(file.isImageDoc || file.mimeType.startsWith('image/') || name.match(/\.(jpe?g|png|webp|gif|bmp)$/i));
    const isWord = name.endsWith('.docx') || name.endsWith('.doc') || file.mimeType.includes('word');
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || file.mimeType.includes('spreadsheet');

    let formatPill = null;
    if (isImage) {
      formatPill = (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
          JPG OCR
        </span>
      );
    } else if (isWord) {
      formatPill = (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
          Word DOCX
        </span>
      );
    } else if (isExcel) {
      formatPill = (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
          Excel XLSX
        </span>
      );
    }

    let badge = null;
    switch (file.category) {
      case 'bylaws':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB] font-semibold">Bylaws / CC&Rs</span>;
        break;
      case 'minutes':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold">Minutes</span>;
        break;
      case 'financials':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">Budget & Dues</span>;
        break;
      case 'architectural':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">ARC Guidelines</span>;
        break;
      case 'rules':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-semibold">Rules & Regs</span>;
        break;
      default:
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] font-medium">HOA Doc</span>;
        break;
    }

    return (
      <div className="flex items-center gap-1">
        {badge}
        {formatPill}
      </div>
    );
  };

  return (
    <aside className="w-72 sm:w-80 bg-white border-r border-[#E2E8F0] flex flex-col h-full max-h-screen">
      {/* Top Header */}
      <div className="p-4 border-b border-[#F1F5F9] bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#64748B]">
            Document Library
          </h2>
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {files.length} {files.length === 1 ? 'Doc' : 'Docs'}
          </span>
        </div>

        {/* Drive Authentication Callout if disconnected */}
        {!hasDriveAccess && (
          <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1E293B] space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0F172A]">Connect Google Drive</p>
                <p className="text-[#475569] text-[11px] mt-0.5 leading-snug">
                  Select an HOA folder to automatically parse all Word, Excel, PDF, and image files in that folder and all its subfolders.
                </p>
              </div>
            </div>
            <button
              onClick={onConnectDrive}
              className="w-full py-1.5 px-3 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Sign in with Google</span>
            </button>
          </div>
        )}

        {/* Folder Scoping & Selection Banner (Active when Drive is connected) */}
        {hasDriveAccess && (
          <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100/70 text-[#2563EB] flex items-center justify-center shrink-0">
                  <Folder className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider block leading-none">
                    Indexed Folder Scope
                  </span>
                  <p className="text-xs font-bold text-[#0F172A] truncate leading-tight mt-0.5" title={currentFolderName}>
                    {currentFolderName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onReindexFolder && (
                  <button
                    onClick={onReindexFolder}
                    disabled={isLoading}
                    className="p-1 rounded-md bg-white hover:bg-slate-100 text-[#64748B] hover:text-[#2563EB] text-[10px] transition border border-[#CBD5E1] cursor-pointer"
                    title="Re-parse folder and all subfolders"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-[#2563EB]' : ''}`} />
                  </button>
                )}
                <button
                  onClick={onOpenFolderModal}
                  className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-[10px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer border border-blue-200/80"
                  title="Select a specific folder in Google Drive"
                >
                  <FolderOpen className="w-3 h-3" />
                  <span>Change</span>
                </button>
              </div>
            </div>

            {/* Breadcrumb row */}
            {folderBreadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0]/70">
                {folderBreadcrumbs.map((crumb, idx) => {
                  const isLast = idx === folderBreadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id + idx}>
                      <button
                        onClick={() => onNavigateBreadcrumb(idx)}
                        className={`truncate max-w-[90px] transition cursor-pointer ${
                          isLast 
                            ? 'font-bold text-[#2563EB]' 
                            : 'hover:text-[#0F172A] hover:underline'
                        }`}
                        title={crumb.name}
                      >
                        {crumb.name}
                      </button>
                      {!isLast && <ChevronRight className="w-2.5 h-2.5 text-[#CBD5E1] shrink-0" />}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, subfolders, or clauses..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] focus:bg-white text-[#1E293B] placeholder-[#94A3B8] transition-all"
          />
        </div>

        {/* Subfolder filter dropdown if multiple subfolder paths exist */}
        {uniqueSubfolderPaths.length > 1 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <FolderTree className="w-3 h-3 text-[#2563EB]" />
                <span>Subfolder Filter</span>
              </span>
              {activeSubfolderFilter !== 'all' && (
                <button
                  onClick={() => setActiveSubfolderFilter('all')}
                  className="text-[#2563EB] hover:underline normal-case font-normal text-[10px] cursor-pointer"
                >
                  Show all
                </button>
              )}
            </div>
            <select
              value={activeSubfolderFilter}
              onChange={(e) => setActiveSubfolderFilter(e.target.value)}
              className="w-full text-xs py-1 px-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
            >
              <option value="all">All Subfolders ({files.length} files)</option>
              {uniqueSubfolderPaths.map((path) => {
                const count = files.filter(f => f.folderPath === path).length;
                return (
                  <option key={path} value={path}>
                    {path} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-2 py-1 rounded-md flex items-center gap-1 whitespace-nowrap transition text-[11px] cursor-pointer ${
                  isActive
                    ? 'bg-[#2563EB] text-white font-medium shadow-xs'
                    : 'bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Upload MS Office, PDF, or JPG/PNG Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`p-2.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 ${
            isDragOver 
              ? 'bg-blue-50 border-[#2563EB] border-dashed ring-2 ring-blue-200'
              : 'bg-[#F8FAFC] border-[#E2E8F0] border-dashed hover:bg-[#F1F5F9]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv"
            className="hidden"
            disabled={isUploadingFile}
          />

          {isUploadingFile ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-3.5 h-3.5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[11px] font-semibold text-[#2563EB]">Parsing MS Office / PDF / JPG document...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full px-1">
              <div className="flex items-center gap-2 text-left">
                <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-[#2563EB] flex items-center justify-center shrink-0">
                  <UploadCloud className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#0F172A] leading-none">Upload File</p>
                  <p className="text-[10px] text-[#64748B] mt-0.5 leading-tight">Word, Excel, PDF, or JPG scan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-[10px] transition shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <UploadCloud className="w-3 h-3" />
                <span>Upload</span>
              </button>
            </div>
          )}
        </div>

        {/* Selection bar */}
        <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-0.5">
          <span>
            Active: <strong className="text-[#0F172A]">{selectedFileIds.length}</strong> of {files.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAll}
              className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-[#CBD5E1]">•</span>
            <button
              onClick={onClearSelection}
              className="text-[#64748B] hover:text-[#0F172A] cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Discovered Subfolders breakdown bar */}
      {availableSubfolders && availableSubfolders.length > 0 && (
        <div className="p-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]/70">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#64748B] flex items-center gap-1">
              <FolderTree className="w-3 h-3 text-[#2563EB]" />
              <span>Parsed Subfolders ({availableSubfolders.length})</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {availableSubfolders.map((folder) => {
              const fileCountInFolder = files.filter(f => f.folderId === folder.id || (f.folderPath && f.folderPath.includes(folder.name))).length;
              return (
                <button 
                  key={folder.id}
                  onClick={() => onScopeToFolder && onScopeToFolder(folder.id, folder.name)}
                  className="px-2 py-0.5 rounded-md bg-white border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50 text-[10px] text-[#334155] flex items-center gap-1 transition cursor-pointer"
                  title={`Scope specifically to ${folder.name}`}
                >
                  <Folder className="w-2.5 h-2.5 text-amber-500" />
                  <span className="truncate max-w-[120px] font-medium">{folder.name}</span>
                  <span className="text-[9px] text-[#94A3B8]">({fileCountInFolder})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Indexed Documents Section Header */}
      <div className="p-3 border-b border-[#F1F5F9] bg-[#F8FAFC]/50 flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#64748B] flex items-center gap-1.5">
          <FolderCheck className="w-3 h-3 text-[#2563EB]" />
          <span>Parsed & Indexed Files</span>
        </h2>
        <span className="text-[10px] text-[#64748B] font-medium bg-[#E2E8F0]/60 px-1.5 py-0.5 rounded">
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          <div className="py-12 text-center text-[#94A3B8] space-y-2">
            <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-[#0F172A]">Parsing all files in folder and subfolders...</p>
            <p className="text-[11px] text-[#64748B]">Removing indexes of files from other folders</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-10 px-4 text-center text-[#94A3B8] space-y-2">
            <HelpCircle className="w-7 h-7 mx-auto text-[#CBD5E1]" />
            <p className="text-xs font-semibold text-[#475569]">No documents found</p>
            <p className="text-[11px] text-[#94A3B8]">
              {searchQuery 
                ? 'Try a different search query.' 
                : hasDriveAccess 
                  ? `No supported files found in "${currentFolderName}" or its subfolders.`
                  : 'Connect Google Drive or upload Word, Excel, PDF, or JPG files.'
              }
            </p>
            {hasDriveAccess && (
              <button
                onClick={onOpenFolderModal}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#2563EB] hover:bg-blue-100 font-semibold text-xs transition cursor-pointer border border-blue-200"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Select Different Folder</span>
              </button>
            )}
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedFileIds.includes(file.id);
            return (
              <div
                key={file.id}
                className={`group p-2.5 rounded-lg border transition text-left flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] shadow-2xs'
                    : 'bg-white hover:bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                }`}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSelect(file.id)}
                    className="mt-0.5 text-[#94A3B8] hover:text-[#2563EB] transition cursor-pointer"
                    title={isSelected ? 'Deselect document' : 'Select document for QA'}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#2563EB]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#CBD5E1]" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {getFileIcon(file)}
                      <p 
                        onClick={() => onToggleSelect(file.id)}
                        className={`text-xs font-medium truncate cursor-pointer ${
                          isSelected ? 'text-[#1E293B] font-semibold' : 'text-[#334155] hover:text-[#2563EB]'
                        }`} 
                        title={file.name}
                      >
                        {file.name}
                      </p>
                    </div>

                    {/* Subfolder path indicator */}
                    {file.folderPath && (
                      <div className="flex items-center gap-1 mt-0.5 pl-3 text-[10px] text-[#64748B]">
                        <Folder className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[190px] font-mono text-[9px] bg-[#F1F5F9] px-1 py-0.2 rounded" title={file.folderPath}>
                          {file.folderPath}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-1 flex-wrap pl-3">
                      {getCategoryBadge(file)}
                      {file.modifiedTime && (
                        <span className="text-[10px] text-[#94A3B8]">
                          {new Date(file.modifiedTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick actions row */}
                <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0]/60 text-[10px] text-[#64748B] pl-6">
                  <button
                    onClick={() => onSummarizeDoc(file)}
                    className="flex items-center gap-1 font-medium transition hover:underline cursor-pointer text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Quick Summary</span>
                  </button>

                  {file.webViewLink ? (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[#94A3B8] hover:text-[#475569] transition"
                      title="Open file in Google Drive"
                    >
                      <span>Drive</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ) : (
                    <span className="text-[#94A3B8] text-[9px]">Indexed</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Synced Info Footer */}
      <div className="p-3.5 mt-auto border-t border-[#F1F5F9] bg-white">
        <div className="bg-[#F1F5F9] p-2.5 rounded-lg border border-[#E2E8F0]/60 text-[10px] text-[#475569] leading-tight space-y-1">
          <div className="flex items-center justify-between font-semibold text-[#0F172A]">
            <span>Active Folder Index</span>
            <span className="text-[#2563EB]">{files.length} parsed</span>
          </div>
          <p className="truncate text-[#64748B]">
            {hasDriveAccess ? `Scoped to "${currentFolderName}" & subfolders` : 'Connect Google Drive or upload files'}
          </p>
        </div>
      </div>
    </aside>
  );
};
