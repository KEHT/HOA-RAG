import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  FolderPlus, 
  FolderCheck, 
  ChevronRight, 
  Search, 
  Link2, 
  X, 
  Check, 
  Loader2, 
  ArrowLeft, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  HardDrive,
  FolderTree,
  Sparkles
} from 'lucide-react';
import { DriveFolder, FolderBreadcrumb } from '../types';

interface FolderSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFolderId: string;
  currentFolderName: string;
  onSelectFolder: (folderId: string, folderName: string, breadcrumbs?: FolderBreadcrumb[]) => Promise<void>;
  accessToken: string | null;
  matchingHOAFolders?: DriveFolder[];
  noticeMessage?: string;
}

export const FolderSelectorModal: React.FC<FolderSelectorModalProps> = ({
  isOpen,
  onClose,
  currentFolderId,
  currentFolderName,
  onSelectFolder,
  accessToken,
  matchingHOAFolders = [],
  noticeMessage,
}) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'link'>('browse');
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [browseFolderId, setBrowseFolderId] = useState<string>(currentFolderId || 'root');
  const [browseBreadcrumbs, setBrowseBreadcrumbs] = useState<FolderBreadcrumb[]>([
    { id: 'root', name: 'My Drive' }
  ]);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Link tab state
  const [folderLinkInput, setFolderLinkInput] = useState('');
  const [isValidatingLink, setIsValidatingLink] = useState(false);
  const [linkValidationResult, setLinkValidationResult] = useState<{ id: string; name: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Fetch folders in the current browsing parent
  useEffect(() => {
    if (!isOpen || !accessToken) return;

    const fetchFolders = async () => {
      setIsLoadingFolders(true);
      try {
        const res = await fetch(`/api/drive/folders?parentId=${browseFolderId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFolders(data.folders || []);
        } else {
          console.warn('Failed to fetch folders');
        }
      } catch (err) {
        console.error('Error fetching folders:', err);
      } finally {
        setIsLoadingFolders(false);
      }
    };

    fetchFolders();
  }, [isOpen, browseFolderId, accessToken]);

  if (!isOpen) return null;

  const extractFolderId = (input: string): string => {
    const trimmed = input.trim();
    const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idParamMatch && idParamMatch[1]) {
      return idParamMatch[1];
    }
    return trimmed;
  };

  const handleValidateLink = async () => {
    const extractedId = extractFolderId(folderLinkInput);
    if (!extractedId) {
      setLinkError('Please enter a valid Google Drive folder link or folder ID.');
      return;
    }

    setIsValidatingLink(true);
    setLinkError(null);
    setLinkValidationResult(null);

    try {
      const res = await fetch(`/api/drive/folder-info?folderId=${extractedId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        throw new Error('Could not access folder. Please verify the folder ID and permissions.');
      }

      const data = await res.json();
      if (data.folder && data.folder.id) {
        setLinkValidationResult({
          id: data.folder.id,
          name: data.folder.name || 'Selected Folder',
        });
      } else {
        throw new Error('Folder information not found.');
      }
    } catch (err: any) {
      setLinkError(err.message || 'Failed to locate folder in Google Drive.');
    } finally {
      setIsValidatingLink(false);
    }
  };

  const handleDrillDown = (folder: DriveFolder) => {
    setBrowseFolderId(folder.id);
    setBrowseBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = browseBreadcrumbs[index];
    setBrowseBreadcrumbs(browseBreadcrumbs.slice(0, index + 1));
    setBrowseFolderId(target.id);
  };

  const handleConfirmSelection = async (folderId: string, folderName: string, customCrumbs?: FolderBreadcrumb[]) => {
    const crumbs = customCrumbs || browseBreadcrumbs;
    await onSelectFolder(folderId, folderName, crumbs);
    onClose();
  };

  const currentBrowsingName = browseBreadcrumbs[browseBreadcrumbs.length - 1]?.name || 'My Drive';
  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchFilter.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-[#CBD5E1] w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Select HOA Folder on Google Drive</h2>
              <p className="text-xs text-[#64748B]">
                Parses all files in all subfolders and removes indexes outside this folder
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#E2E8F0] px-5 pt-3 gap-4 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'browse'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Browse Folders</span>
          </button>
          <button
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'link'
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Paste Drive Folder Link / ID</span>
          </button>
        </div>

        {/* Notice banner if auto-discovery triggered modal */}
        {noticeMessage && (
          <div className="px-5 pt-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-950">HOA Folder Selection</p>
                <p className="text-[11px] text-amber-800 mt-0.5">{noticeMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick select list if multiple HOA folders were discovered */}
        {matchingHOAFolders.length > 0 && (
          <div className="px-5 pt-3">
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                Matching "HOA" Folders Found in Your Drive:
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {matchingHOAFolders.map((hf) => (
                  <button
                    key={hf.id}
                    onClick={() => handleConfirmSelection(hf.id, hf.name, [{ id: hf.id, name: hf.name }])}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white hover:bg-blue-100/60 border border-blue-200/80 transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Folder className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
                      <span className="text-xs font-semibold text-[#0F172A] group-hover:text-[#2563EB] truncate">
                        {hf.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] px-2 py-0.5 bg-blue-50 rounded">
                      Select This
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info callout */}
        <div className="px-5 pt-3 pb-0">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-[#1E293B] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2563EB] flex-shrink-0" />
            <span className="text-[11px] text-[#334155] leading-snug">
              When a folder is selected, all documents in all its subfolders are parsed & indexed. Previous indexes outside this folder are pruned.
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'browse' ? (
            <div className="space-y-4">
              {/* Breadcrumb Bar */}
              <div className="flex items-center gap-1 p-2 rounded-xl bg-[#F1F5F9] border border-[#E2E8F0] overflow-x-auto text-xs">
                {browseBreadcrumbs.map((crumb, idx) => {
                  const isLast = idx === browseBreadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id + idx}>
                      <button
                        onClick={() => handleBreadcrumbClick(idx)}
                        className={`px-2 py-1 rounded-md transition font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                          isLast
                            ? 'bg-white text-[#2563EB] shadow-2xs font-semibold'
                            : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/70'
                        }`}
                      >
                        {idx === 0 ? <HardDrive className="w-3 h-3" /> : <Folder className="w-3 h-3" />}
                        <span>{crumb.name}</span>
                      </button>
                      {!isLast && <ChevronRight className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Current Active Target CTA banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/90 border border-blue-200">
                <div className="min-w-0 pr-3">
                  <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider block">
                    Select Target Folder & Subfolders
                  </span>
                  <p className="text-xs font-semibold text-[#0F172A] truncate">
                    {currentBrowsingName}
                  </p>
                </div>
                <button
                  onClick={() => handleConfirmSelection(browseFolderId, currentBrowsingName)}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
                >
                  <FolderCheck className="w-3.5 h-3.5" />
                  <span>Parse "{currentBrowsingName}"</span>
                </button>
              </div>

              {/* Search filter for subfolders */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter subfolders..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                />
              </div>

              {/* Subfolder list */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                <p className="text-[11px] font-semibold text-[#64748B] px-1 uppercase tracking-wider">
                  Subfolders inside {currentBrowsingName}
                </p>

                {isLoadingFolders ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#64748B]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
                    <span className="text-xs">Loading folders from Google Drive...</span>
                  </div>
                ) : filteredFolders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#94A3B8] bg-[#F8FAFC] rounded-xl border border-dashed border-[#E2E8F0]">
                    {searchFilter ? 'No matching folders found.' : 'No subfolders in this location.'}
                  </div>
                ) : (
                  filteredFolders.map((folder) => {
                    return (
                      <div
                        key={folder.id}
                        className="group flex items-center justify-between p-2.5 rounded-xl border border-[#E2E8F0] hover:border-blue-300 hover:bg-blue-50/40 transition"
                      >
                        <button
                          onClick={() => handleDrillDown(folder)}
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 group-hover:text-[#2563EB] transition">
                            <Folder className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-medium text-[#1E293B] group-hover:text-[#2563EB] truncate">
                              {folder.name}
                            </p>
                            <span className="text-[10px] text-[#94A3B8]">Click to open subfolder</span>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleConfirmSelection(folder.id, folder.name, [...browseBreadcrumbs, { id: folder.id, name: folder.name }])}
                            className="px-2.5 py-1 rounded-md bg-white border border-[#CBD5E1] hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] text-[11px] font-medium text-[#475569] transition shadow-2xs cursor-pointer flex items-center gap-1"
                            title={`Select ${folder.name} and all its subfolders`}
                          >
                            <FolderCheck className="w-3 h-3" />
                            <span>Select</span>
                          </button>
                          <button
                            onClick={() => handleDrillDown(folder)}
                            className="p-1 rounded-md hover:bg-[#E2E8F0] text-[#64748B] transition cursor-pointer"
                            title="Open folder"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200 text-xs text-[#1E293B] space-y-1">
                <p className="font-semibold text-[#0F172A] flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
                  Direct Link or Folder ID
                </p>
                <p className="text-[11px] text-[#64748B]">
                  Open Google Drive, copy the URL of your HOA folder (e.g. <code>https://drive.google.com/drive/folders/1ABC...</code>) and paste it below.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] mb-1">
                  Google Drive Folder URL or ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://drive.google.com/drive/folders/1a2b3c4d5e..."
                    value={folderLinkInput}
                    onChange={(e) => {
                      setFolderLinkInput(e.target.value);
                      setLinkError(null);
                      setLinkValidationResult(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleValidateLink();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2563EB] focus:border-[#2563EB]"
                  />
                  <button
                    onClick={handleValidateLink}
                    disabled={!folderLinkInput.trim() || isValidatingLink}
                    className="px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white text-xs font-semibold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isValidatingLink ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Verify</span>
                  </button>
                </div>
              </div>

              {linkError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{linkError}</p>
                </div>
              )}

              {linkValidationResult && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FolderCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Folder Verified
                      </span>
                      <p className="text-xs font-bold text-emerald-950">
                        {linkValidationResult.name}
                      </p>
                      <span className="text-[10px] text-emerald-700">ID: {linkValidationResult.id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConfirmSelection(linkValidationResult.id, linkValidationResult.name, [
                      { id: 'root', name: 'My Drive' },
                      { id: linkValidationResult.id, name: linkValidationResult.name }
                    ])}
                    className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Parse and Index "{linkValidationResult.name}" & Subfolders</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-xs">
          <button
            onClick={() => handleConfirmSelection('root', 'My Drive', [{ id: 'root', name: 'My Drive' }])}
            className="text-[#64748B] hover:text-[#2563EB] font-medium transition underline cursor-pointer"
          >
            Reset to My Drive Root
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[#334155] font-semibold transition cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
