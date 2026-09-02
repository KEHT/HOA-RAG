import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, SourceCitation, AIConfig } from '../types';
import { QUICK_PROMPTS } from '../data/sampleHOAData';
import { 
  Send, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Bookmark, 
  ArrowRight, 
  Filter,
  Camera,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Server,
  Cpu
} from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedDocsCount: number;
  filterCategory: string;
  aiConfig: AIConfig;
  onSendMessage: (query: string) => void;
  onClearMessages: () => void;
  onSelectCategory: (cat: string) => void;
  onViewSource: (source: SourceCitation) => void;
  onUploadFile?: (file: File) => Promise<void>;
  isUploadingFile?: boolean;
  onOpenAISettings: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  selectedDocsCount,
  filterCategory,
  aiConfig,
  onSendMessage,
  onClearMessages,
  onSelectCategory,
  onViewSource,
  onUploadFile,
  isUploadingFile = false,
  onOpenAISettings,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadFile) {
      await onUploadFile(file);
      if (chatFileInputRef.current) chatFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePromptClick = (prompt: string) => {
    onSendMessage(prompt);
  };

  const activeModelDisplay = aiConfig.provider === 'custom' 
    ? `Private Server (${aiConfig.customModelName || 'custom'})`
    : `Google Gemini (${aiConfig.geminiModel || 'gemini-3.7-flash'})`;

  return (
    <main className="flex-1 flex flex-col h-full bg-[#F8FAFC] font-sans text-[#1E293B] relative overflow-hidden">
      {/* Top Filter & Model Bar */}
      <div className="h-14 px-6 sm:px-8 border-b border-[#E2E8F0] bg-white flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline">Focus Filter:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {[
              { id: 'all', label: 'All Documents' },
              { id: 'bylaws', label: 'Bylaws & CC&Rs' },
              { id: 'minutes', label: 'Minutes' },
              { id: 'financials', label: 'Financials & Dues' },
              { id: 'architectural', label: 'ARC Guidelines' },
              { id: 'rules', label: 'Rules' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-blue-200 shadow-2xs'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={onClearMessages}
              title="Clear Chat History"
              className="flex items-center gap-1 text-[#94A3B8] hover:text-rose-600 text-xs font-medium transition px-2.5 py-1 rounded-md hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto py-6 space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#EFF6FF] border border-blue-200 text-[#2563EB] shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
                HOA Document Assistant
              </h2>
              <p className="text-sm text-[#64748B] max-w-lg mx-auto leading-relaxed">
                Ask questions about governing bylaws, CC&Rs, board minutes, budgets, spreadsheets, and architectural rules with exact document citations.
              </p>
            </div>

            {/* Starter Prompts */}
            <div>
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#64748B] mb-3 text-center sm:text-left">
                Common HOA Queries
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {QUICK_PROMPTS.map((qp) => (
                  <div
                    key={qp.id}
                    onClick={() => handlePromptClick(qp.prompt)}
                    className="p-4 border border-[#E2E8F0] rounded-xl text-xs text-[#64748B] hover:border-[#2563EB] hover:text-[#0F172A] hover:bg-white bg-white/70 shadow-xs cursor-pointer transition-all group flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded">
                          {qp.categoryLabel}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#CBD5E1] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition" />
                      </div>
                      <h4 className="text-xs font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors">
                        {qp.title}
                      </h4>
                      <p className="text-[11px] text-[#64748B] line-clamp-2 mt-1">
                        "{qp.prompt}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl mx-auto ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'user' ? (
                <div className="bg-[#2563EB] text-white px-5 py-3.5 rounded-2xl rounded-tr-none max-w-[85%] sm:max-w-[75%] shadow-sm">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div className="bg-white border border-[#E2E8F0] text-[#1E293B] px-5 sm:px-6 py-5 rounded-2xl rounded-tl-none max-w-[92%] sm:max-w-[85%] shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-blue-50 text-[#2563EB] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-[#0F172A]">HOA Assistant</span>
                      {msg.error && (
                        <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-semibold">
                          Notice
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="text-[#94A3B8] hover:text-[#0F172A] p-1 rounded hover:bg-[#F1F5F9] transition cursor-pointer"
                      title="Copy response to clipboard"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Markdown Content */}
                  <div className="prose prose-sm max-w-none text-[#334155] leading-relaxed break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h1 className="text-base font-bold text-[#0F172A] mt-3 mb-1.5">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-sm font-bold text-[#0F172A] mt-3 mb-1">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-bold text-[#0F172A] mt-2 mb-1">{children}</h3>,
                        p: ({ children }) => <p className="mb-2 text-xs leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2 text-xs">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2 text-xs">{children}</ol>,
                        li: ({ children }) => <li className="text-xs">{children}</li>,
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-3 border-[#2563EB] pl-3 py-1 bg-[#F8FAFC] my-2 text-xs text-[#475569] italic rounded-r">
                            {children}
                          </blockquote>
                        ),
                        table: ({ children }) => (
                          <div className="overflow-x-auto my-3 border border-[#E2E8F0] rounded-lg">
                            <table className="min-w-full divide-y divide-[#E2E8F0] text-xs">{children}</table>
                          </div>
                        ),
                        thead: ({ children }) => <thead className="bg-[#F8FAFC]">{children}</thead>,
                        tbody: ({ children }) => <tbody className="divide-y divide-[#F1F5F9] bg-white">{children}</tbody>,
                        tr: ({ children }) => <tr>{children}</tr>,
                        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-[#0F172A] text-[11px]">{children}</th>,
                        td: ({ children }) => <td className="px-3 py-2 text-[#334155] text-xs">{children}</td>,
                        code: ({ children }) => (
                          <code className="bg-[#F1F5F9] text-[#2563EB] font-mono text-[11px] px-1 py-0.5 rounded">
                            {children}
                          </code>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Verifiable Source Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-3 border-t border-[#F1F5F9] space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                        <Bookmark className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Referenced Document Sources ({msg.sources.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.sources.map((source, sIdx) => (
                          <div
                            key={sIdx}
                            onClick={() => onViewSource(source)}
                            className="p-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-white hover:border-[#2563EB] text-left transition cursor-pointer group shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#0F172A] truncate max-w-[180px] group-hover:text-[#2563EB]">
                                {source.fileName}
                              </span>
                              {source.sectionOrClause && (
                                <span className="text-[10px] font-mono text-[#2563EB] bg-blue-50 px-1 py-0.5 rounded">
                                  {source.sectionOrClause}
                                </span>
                              )}
                            </div>
                            {source.folderPath && (
                              <p className="text-[9px] text-[#94A3B8] font-mono truncate mt-0.5">
                                📁 {source.folderPath}
                              </p>
                            )}
                            <p className="text-[11px] text-[#64748B] line-clamp-2 mt-1 italic">
                              "{source.snippet}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Follow-up Questions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="pt-2 border-t border-[#F1F5F9] space-y-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#94A3B8]">
                        Suggested Follow-ups
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedQuestions.map((sq, sqIdx) => (
                          <button
                            key={sqIdx}
                            onClick={() => onSendMessage(sq)}
                            className="px-2.5 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#EFF6FF] hover:text-[#2563EB] text-xs text-[#475569] border border-[#E2E8F0] transition flex items-center gap-1 cursor-pointer"
                          >
                            <span>{sq}</span>
                            <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Thinking Indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-3xl mx-auto justify-start animate-pulse">
            <div className="bg-white border border-[#E2E8F0] text-[#1E293B] px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-[#475569]">
                Auditing documents with {activeModelDisplay}...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="p-4 sm:p-6 bg-white border-t border-[#E2E8F0] shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-2">
          {/* File Upload Hidden Input */}
          <input
            type="file"
            ref={chatFileInputRef}
            onChange={handleChatFileChange}
            accept=".docx,.doc,.xlsx,.xls,.pptx,.ppt,.pdf,.jpg,.jpeg,.png,.webp,.txt,.csv"
            className="hidden"
            disabled={isUploadingFile}
          />

          <div className="relative flex items-center bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl focus-within:ring-2 focus-within:ring-[#2563EB]/20 focus-within:border-[#2563EB] focus-within:bg-white transition-all shadow-xs">
            {/* Quick Upload Button */}
            <button
              type="button"
              onClick={() => chatFileInputRef.current?.click()}
              disabled={isUploadingFile}
              title="Upload Word, Excel, PDF, or JPG document to index"
              className="p-2.5 text-[#64748B] hover:text-[#2563EB] transition cursor-pointer flex items-center gap-1 text-xs shrink-0"
            >
              {isUploadingFile ? (
                <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedDocsCount > 0
                  ? `Ask about your ${selectedDocsCount} indexed HOA documents...`
                  : 'Ask about bylaws, board minutes, dues, or architectural rules...'
              }
              className="w-full py-3 px-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none focus:ring-0 text-[#0F172A] placeholder-[#94A3B8] resize-none max-h-32 leading-relaxed"
            />

            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="m-1.5 p-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:hover:bg-[#2563EB] text-white transition shadow-2xs shrink-0 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#94A3B8] px-1">
            <span>
              Supports <strong className="text-[#475569]">Google Docs, Word, Excel, PDF, and JPG scans</strong>
            </span>
            <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
          </div>
        </form>
      </div>
    </main>
  );
};
