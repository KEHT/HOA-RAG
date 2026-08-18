import React from 'react';
import { DriveFile } from '../types';
import { X, Sparkles, CheckCircle2, FileText, ArrowRight, HelpCircle, Calendar } from 'lucide-react';

interface SummaryData {
  executiveSummary?: string;
  keyHighlights?: string[];
  importantDatesOrAmounts?: string[];
  suggestedQueries?: string[];
}

interface DocSummaryModalProps {
  document: DriveFile | null;
  summary: SummaryData | null;
  isLoading: boolean;
  onClose: () => void;
  onSelectQuery: (query: string) => void;
}

export const DocSummaryModal: React.FC<DocSummaryModalProps> = ({
  document,
  summary,
  isLoading,
  onClose,
  onSelectQuery,
}) => {
  if (!document) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-[#E2E8F0] overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB] border border-blue-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0F172A]">AI Executive Summary</h3>
              <p className="text-xs text-[#64748B] font-medium truncate max-w-md">{document.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-[#334155] bg-[#F8FAFC]">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm font-semibold text-[#0F172A]">Analyzing document with Gemini...</p>
              <p className="text-xs text-[#64748B]">Extracting governance clauses, bylaws, dates, and financial metrics</p>
            </div>
          ) : (
            <>
              {/* Executive Summary Paragraph */}
              <div className="p-4 sm:p-5 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl space-y-1.5 shadow-2xs">
                <h4 className="font-bold text-[#1E3A8A] flex items-center gap-1.5 text-xs">
                  <FileText className="w-4 h-4 text-[#2563EB]" />
                  Executive Overview
                </h4>
                <p className="text-[#1E293B] leading-relaxed text-xs sm:text-sm">
                  {summary?.executiveSummary || document.snippet || 'Document verified in HOA database.'}
                </p>
              </div>

              {/* Key Highlights */}
              {summary?.keyHighlights && summary.keyHighlights.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[#64748B] uppercase tracking-widest text-[10px]">
                    Key Highlights & Governance Rules
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {summary.keyHighlights.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs text-[#1E293B]">
                        <CheckCircle2 className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                        <span className="leading-snug">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates & Amounts */}
              {summary?.importantDatesOrAmounts && summary.importantDatesOrAmounts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-[#64748B] uppercase tracking-widest text-[10px]">
                    Important Dates & Financial Figures
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.importantDatesOrAmounts.map((item, idx) => (
                      <span key={idx} className="px-3 py-1.5 rounded-lg bg-white text-[#0F172A] border border-[#E2E8F0] font-semibold text-xs shadow-2xs">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Questions */}
              {summary?.suggestedQueries && summary.suggestedQueries.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                  <h4 className="font-bold text-[#0F172A] flex items-center gap-1.5 text-xs">
                    <HelpCircle className="w-3.5 h-3.5 text-[#2563EB]" />
                    Ask a Question About This Document:
                  </h4>
                  <div className="space-y-1.5">
                    {summary.suggestedQueries.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          onSelectQuery(q);
                          onClose();
                        }}
                        className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-blue-200 text-[#475569] hover:text-[#2563EB] transition flex items-center justify-between group shadow-2xs cursor-pointer"
                      >
                        <span>"{q}"</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2563EB] transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E2E8F0] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-sm transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

