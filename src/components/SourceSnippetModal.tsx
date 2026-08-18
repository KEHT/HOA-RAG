import React from 'react';
import { SourceCitation } from '../types';
import { X, FileText, CheckCircle2, BookmarkCheck, ExternalLink } from 'lucide-react';

interface SourceSnippetModalProps {
  source: SourceCitation | null;
  onClose: () => void;
}

export const SourceSnippetModal: React.FC<SourceSnippetModalProps> = ({ source, onClose }) => {
  if (!source) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-blue-200">
              <BookmarkCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">Document Source Citation</h3>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                {source.category ? source.category.toUpperCase() : 'HOA RECORD'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs text-[#334155] bg-[#F8FAFC]">
          {/* Document name & section */}
          <div className="p-3.5 bg-white rounded-xl border border-[#E2E8F0] shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-[#0F172A] font-bold text-xs">
              <FileText className="w-4 h-4 text-[#2563EB]" />
              <span>{source.fileName}</span>
            </div>
            {source.sectionOrClause && (
              <p className="text-[11px] font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-blue-200 inline-block">
                Reference: {source.sectionOrClause}
              </p>
            )}
          </div>

          {/* Exact Quote / Excerpt */}
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-1.5">
              Verified Text Snippet:
            </label>
            <div className="p-4 rounded-xl bg-[#0F172A] text-slate-100 font-mono text-[11px] leading-relaxed border border-slate-800 shadow-inner whitespace-pre-wrap">
              {source.snippet}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#2563EB] font-medium bg-[#EFF6FF] p-3 rounded-lg border border-blue-200/60">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#2563EB]" />
            <span>This excerpt was analyzed by Gemini 3.7 Flash to ground the response with high fidelity.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E2E8F0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            Close Citation
          </button>
        </div>
      </div>
    </div>
  );
};

