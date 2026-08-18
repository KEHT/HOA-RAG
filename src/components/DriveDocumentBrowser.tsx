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
  Camera,
  Folder,
  FolderOpen,
  FolderCheck,
  ChevronRight,
  HardDrive,
  RefreshCw
} from 'lucide-react';

interface DriveDocumentBrowserProps {
  files: DriveFile[];
  selectedFileIds: string[];
  isLoading: boolean;
  hasDriveAccess: boolean;
  isSampleMode: boolean;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSummarizeDoc: (doc: DriveFile) => void;
  onSwitchMode: (toSample: boolean) => void;
  onConnectDrive: () => void;
  onUploadImage?: (file: File) => Promise<void>;
  isUploadingImage?: boolean;
  currentFolderId: string;
  currentFolderName: string;
  folderBreadcrumbs: FolderBreadcrumb[];
  availableSubfolders?: DriveFolder[];
  onOpenFolderModal: () => void;
  onNavigateBreadcrumb: (index: number) => void;
  onDrillIntoFolder?: (folder: DriveFolder) => void;
  onScopeToFolder?: (folderId: string, folderName: string) => void;
  onResetToRoot?: () => void;
  isFolderScoped?: boolean;
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
  isSampleMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onSummarizeDoc,
  onSwitchMode,
  onConnectDrive,
  onUploadImage,
  isUploadingImage = false,
  currentFolderId = 'root',
  currentFolderName = 'My Drive',
  folderBreadcrumbs = [{ id: 'root', name: 'My Drive' }],
  availableSubfolders = [],
  onOpenFolderModal,
  onNavigateBreadcrumb,
  onResetToRoot,
  isFolderScoped = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadImage) {
      await onUploadImage(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onUploadImage) {
      await onUploadImage(file);
    }
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.folderPath && file.folderPath.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (file.snippet && file.snippet.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || file.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getFileIcon = (file: DriveFile) => {
    if (file.mimeType.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i) || file.isImageDoc) {
      return <ImageIcon className="w-4 h-4 text-indigo-600 flex-shrink-0" />;
    }
    if (file.mimeType.includes('spreadsheet')) {
      return <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
    }
    if (file.category === 'bylaws') {
      return <BookOpen className="w-4 h-4 text-[#2563EB] flex-shrink-0" />;
    }
    if (file.category === 'financials') {
      return <DollarSign className="w-4 h-4 text-amber-600 flex-shrink-0" />;
    }
    if (file.category === 'minutes') {
      return <Calendar className="w-4 h-4 text-sky-600 flex-shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-[#64748B] flex-shrink-0" />;
  };

  const getCategoryBadge = (category?: string, isImage?: boolean) => {
    const imageTag = isImage ? (
      <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold flex items-center gap-0.5">
        <Camera className="w-2.5 h-2.5" />
        <span>JPG OCR</span>
      </span>
    ) : null;

    let badge = null;
    switch (category) {
      case 'bylaws':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-[#2563EB] font-semibold">Bylaws / CC&Rs</span>;
        break;
      case 'minutes':
        badge = <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold">Board Minutes</span>;
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
        {imageTag}
      </div>
    );
  };

  return (
    <aside className="w-72 sm:w-80 bg-white border-r border-[#E2E8F0] flex flex-col h-full max-h-screen">
      {/* Top Header & Mode Switcher */}
      <div className="p-4 border-b border-[#F1F5F9] bg-white space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#64748B]">
            Document Library
          </h2>
          
          <div className="flex items-center p-0.5 bg-[#F1F5F9] rounded-lg text-xs font-medium border border-[#E2E8F0]/60">
            <button
              onClick={() => onSwitchMode(false)}
              className={`px-2.5 py-1 rounded-md transition text-[11px] cursor-pointer ${
                !isSampleMode
                  ? 'bg-white text-[#0F172A] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Google Drive
            </button>
            <button
              onClick={() => onSwitchMode(true)}
              className={`px-2.5 py-1 rounded-md transition text-[11px] cursor-pointer ${
                isSampleMode
                  ? 'bg-white text-[#2563EB] shadow-xs font-semibold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Sample HOA
            </button>
          </div>
        </div>

        {/* Drive Authentication Callout if disconnected in Drive mode */}
        {!hasDriveAccess && !isSampleMode && (
          <div className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1E293B] space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#0F172A]">Connect Google Drive</p>
                <p className="text-[#475569] text-[11px] mt-0.5 leading-snug">
                  Sign in to select your HOA folder. All subfolders and documents will be indexed automatically.
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

        {/* Selected Folder Scope Banner (Active when Drive is connected and in Drive mode) */}
        {hasDriveAccess && !isSampleMode && (
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                <div className="w-7 h-7 rounded-lg bg-[#2563EB] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                  <FolderCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold text-[#2563EB] uppercase tracking-wider block leading-none">
                      Active Folder Scope
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#0F172A] truncate leading-tight mt-0.5" title={currentFolderName}>
                    {currentFolderName}
                  </p>
                </div>
              </div>

              <button
                onClick={onOpenFolderModal}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-[#2563EB] text-[11px] font-bold transition flex items-center gap-1 flex-shrink-0 cursor-pointer border border-blue-200 shadow-2xs"
                title="Select a specific folder in Google Drive"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Change</span>
              </button>
            </div>

            {/* Folder stats & recursive info */}
            <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-1 border-t border-blue-200/60">
              <span className="flex items-center gap-1 text-[#2563EB] font-medium">
                <Layers className="w-3 h-3" />
                <span>Recursive: includes all subfolders</span>
              </span>
              {availableSubfolders.length > 0 && (
                <span className="bg-blue-100/70 text-[#1E40AF] px-1.5 py-0.2 rounded font-semibold text-[9px]">
                  {availableSubfolders.length} subfolders
                </span>
              )}
            </div>

            {/* Breadcrumb row if deep in tree */}
            {folderBreadcrumbs.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto text-[10px] text-[#64748B] pt-1">
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
                      {!isLast && <ChevronRight className="w-2.5 h-2.5 text-[#CBD5E1] flex-shrink-0" />}
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
            placeholder="Search documents or subfolders..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] focus:bg-white text-[#1E293B] placeholder-[#94A3B8] transition-all"
          />
        </div>

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

        {/* Upload JPG / Photo OCR Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`p-2.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1.5 ${
            isDragOver 
              ? 'bg-indigo-50 border-indigo-400 border-dashed ring-2 ring-indigo-200'
              : 'bg-[#F8FAFC] border-[#E2E8F0] border-dashed hover:bg-[#F1F5F9]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isUploadingImage}
          />

          {isUploadingImage ? (
            <div className="flex items-center gap-2 py-1">
              <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[11px] font-semibold text-indigo-700">Gemini Vision OCR transcribing image...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full px-1">
              <div className="flex items-center gap-2 text-left">
                <div className="w-7 h-7 rounded-lg bg-indigo-100/70 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#0F172A] leading-none">Parse JPG Photo</p>
                  <p className="text-[10px] text-[#64748B] mt-0.5 leading-tight">Meeting minutes or financials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[10px] transition shadow-2xs flex items-center gap-1 flex-shrink-0 cursor-pointer"
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
            Active in Query: <strong className="text-[#0F172A]">{selectedFileIds.length}</strong> of {files.length}
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

      {/* Indexed Documents Section Header */}
      <div className="px-4 py-2.5 border-b border-[#F1F5F9] bg-[#F8FAFC]/50 flex items-center justify-between">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-[#64748B]">
          Indexed Documents
        </h2>
        <span className="text-[10px] text-[#64748B] font-semibold bg-[#E2E8F0]/70 px-1.5 py-0.5 rounded">
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          <div className="py-12 text-center text-[#94A3B8] space-y-2">
            <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-[#64748B]">Recursively scanning & indexing "{currentFolderName}"...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-10 px-4 text-center text-[#94A3B8] space-y-2">
            <HelpCircle className="w-7 h-7 mx-auto text-[#CBD5E1]" />
            <p className="text-xs font-semibold text-[#475569]">No documents found</p>
            <p className="text-[11px] text-[#94A3B8]">
              {searchQuery 
                ? 'No documents match your search query.' 
                : hasDriveAccess 
                  ? `No supported files found inside "${currentFolderName}" or its subfolders.`
                  : 'Upload a meeting/financial photo or connect Google Drive.'
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
            const isImage = !!(file.isImageDoc || file.mimeType.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|gif|bmp)$/i));
            
            // Format relative folder path badge (if inside a subfolder)
            const showSubfolderBadge = file.folderPath && file.folderPath !== currentFolderName && file.folderPath !== 'My Drive';

            return (
              <div
                key={file.id}
                className={`group p-2.5 rounded-xl border transition text-left flex flex-col gap-1.5 ${
                  isSelected
                    ? isImage 
                      ? 'bg-indigo-50/70 text-indigo-900 border-indigo-200 shadow-2xs'
                      : 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE] shadow-2xs'
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
                      <CheckSquare className={`w-4 h-4 ${isImage ? 'text-indigo-600' : 'text-[#2563EB]'}`} />
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

                    {/* Subfolder location badge if nested */}
                    {showSubfolderBadge && (
                      <div className="flex items-center gap-1 mt-1 pl-3">
                        <Folder className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
                        <span className="text-[9px] text-[#64748B] font-medium truncate" title={file.folderPath}>
                          {file.folderPath}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 mt-1 flex-wrap pl-3">
                      {getCategoryBadge(file.category, isImage)}
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
                    className={`flex items-center gap-1 font-medium transition hover:underline cursor-pointer ${isImage ? 'text-indigo-600 hover:text-indigo-800' : 'text-[#2563EB] hover:text-[#1D4ED8]'}`}
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
                    <span className="text-[#94A3B8] text-[9px]">{isImage ? 'OCR Indexed' : 'Verified'}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Synced Info Footer */}
      <div className="p-3.5 mt-auto border-t border-[#F1F5F9] bg-white">
        <div className="bg-[#F1F5F9] p-2.5 rounded-xl border border-[#E2E8F0]/60">
          <p className="text-[10px] text-[#475569] leading-relaxed font-medium">
            {hasDriveAccess ? (
              <>
                <strong>{files.length} documents</strong> indexed in <em>"{currentFolderName}"</em> (including all subfolders).
              </>
            ) : (
              <>
                <strong>{files.length} sample HOA records</strong> loaded for analysis.
              </>
            )}
          </p>
        </div>
      </div>
    </aside>
  );
};
