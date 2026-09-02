import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, RefreshCw, Cpu, Server, Sparkles } from 'lucide-react';
import { AIConfig } from '../types';

interface HeaderProps {
  user: User | null;
  hasDriveAccess: boolean;
  isLoggingIn: boolean;
  selectedDocsCount: number;
  totalDocsCount: number;
  aiConfig: AIConfig;
  onOpenAISettings: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onRefreshDrive: () => void;
  isRefreshingDrive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  hasDriveAccess,
  isLoggingIn,
  selectedDocsCount,
  totalDocsCount,
  aiConfig,
  onOpenAISettings,
  onLogin,
  onLogout,
  onRefreshDrive,
  isRefreshingDrive,
}) => {
  const modelLabel = aiConfig.provider === 'custom'
    ? (aiConfig.customModelName || 'Private AI')
    : (aiConfig.geminiModel === 'gemini-3.7-flash' ? 'Gemini 3.7' : (aiConfig.geminiModel || 'Gemini'));

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between shadow-xs flex-shrink-0 z-30 sticky top-0">
      {/* Brand Zone: single text element */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center shadow-xs">
          <div className="w-3.5 h-3.5 border-2 border-white rounded-xs"></div>
        </div>
        <span className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap">
          HOA Insight AI
        </span>
      </div>

      {/* Middle Zone: AI Model selector button + Document Index Count */}
      <div className="flex items-center gap-2.5">
        {/* AI Model Badge / Config Trigger */}
        <button
          onClick={onOpenAISettings}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] rounded-lg text-xs font-medium text-[#334155] transition cursor-pointer"
          title="Configure AI Model or Private Server Endpoint"
        >
          {aiConfig.provider === 'custom' ? (
            <Server className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
          )}
          <span className="font-semibold text-[#0F172A] max-w-[130px] truncate">{modelLabel}</span>
          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#E2E8F0]/70 text-[#475569]">
            {aiConfig.provider === 'custom' ? 'Private' : 'Cloud'}
          </span>
        </button>

        {/* Index count pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#F1F5F9] rounded-lg text-xs font-medium text-[#64748B] border border-[#E2E8F0]/60">
          <div className={`w-2 h-2 rounded-full ${hasDriveAccess ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          <span className="text-[#1E293B] font-semibold whitespace-nowrap">
            {selectedDocsCount} of {totalDocsCount} indexed
          </span>
        </div>
      </div>

      {/* Right Action Zone */}
      <div className="flex items-center gap-3">
        {hasDriveAccess ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onRefreshDrive}
              disabled={isRefreshingDrive}
              title="Re-parse folder and all subfolders"
              className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] border border-[#E2E8F0] transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${isRefreshingDrive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline whitespace-nowrap">Sync Folder</span>
            </button>

            <div className="flex items-center gap-2.5 border-l border-[#E2E8F0] pl-2.5 sm:pl-3">
              <span className="text-xs font-semibold text-[#0F172A] hidden sm:inline truncate max-w-[130px]">
                {user?.displayName || 'HOA Admin'}
              </span>

              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-slate-200 shadow-2xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#E2E8F0] border border-slate-200 shadow-2xs flex items-center justify-center text-[11px] font-bold text-[#475569]">
                  {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'HOA'}
                </div>
              )}

              <button
                onClick={onLogout}
                title="Sign out of Google"
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-xs transition disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            <span>{isLoggingIn ? 'Connecting...' : 'Connect Google Drive'}</span>
          </button>
        )}
      </div>
    </header>
  );
};
