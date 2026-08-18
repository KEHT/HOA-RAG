import React from 'react';
import { User } from 'firebase/auth';
import { ShieldCheck, HardDrive, LogOut, CheckCircle2, RefreshCw, FileSearch, Sparkles } from 'lucide-react';

interface HeaderProps {
  user: User | null;
  hasDriveAccess: boolean;
  isLoggingIn: boolean;
  selectedDocsCount: number;
  totalDocsCount: number;
  isSampleMode: boolean;
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
  isSampleMode,
  onLogin,
  onLogout,
  onRefreshDrive,
  isRefreshingDrive,
}) => {
  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-8 flex items-center justify-between shadow-xs flex-shrink-0 z-30 sticky top-0">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-[#2563EB] rounded-lg flex items-center justify-center shadow-sm">
          <div className="w-4 h-4 border-2 border-white rounded-xs"></div>
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] flex items-center gap-1.5">
            HOA Insight<span className="text-[#2563EB] font-semibold">AI</span>
          </h1>
          <p className="text-[10px] text-[#64748B] font-medium hidden sm:block">
            Professional Governance & Document Intelligence
          </p>
        </div>
      </div>

      {/* Middle Status Pill */}
      <div className="hidden md:flex items-center gap-6">
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-[#F1F5F9] rounded-full text-xs font-medium text-[#64748B] border border-[#E2E8F0]/60">
          <div className={`w-2 h-2 rounded-full ${hasDriveAccess ? 'bg-green-500 animate-pulse' : 'bg-[#2563EB]'}`}></div>
          <span>
            {hasDriveAccess ? 'Connected to Google Drive' : (isSampleMode ? 'Sample HOA Library' : 'Google Drive Disconnected')}
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#1E293B] font-semibold">
            {selectedDocsCount} of {totalDocsCount} indexed
          </span>
        </div>
      </div>

      {/* Right Controls / User Account */}
      <div className="flex items-center gap-3 sm:gap-4">
        {hasDriveAccess ? (
          <div className="flex items-center gap-3">
            <button
              onClick={onRefreshDrive}
              disabled={isRefreshingDrive}
              title="Refresh Google Drive files"
              className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] border border-[#E2E8F0] transition flex items-center gap-1.5 text-xs font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#2563EB] ${isRefreshingDrive ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Drive</span>
            </button>

            <div className="flex items-center gap-3 border-l border-[#E2E8F0] pl-3 sm:pl-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-[#0F172A] leading-tight truncate max-w-[140px]">
                  {user?.displayName || 'HOA Community'}
                </p>
                <p className="text-[10px] text-[#64748B] font-medium">Admin Account</p>
              </div>

              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border-2 border-white shadow-xs"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#E2E8F0] border-2 border-white shadow-xs flex items-center justify-center text-xs font-bold text-[#475569]">
                  {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'HOA'}
                </div>
              )}

              <button
                onClick={onLogout}
                title="Sign out of Google"
                className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs shadow-sm transition disabled:opacity-60"
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

