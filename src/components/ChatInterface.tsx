import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, SourceCitation } from '../types';
import { QUICK_PROMPTS } from '../data/sampleHOAData';
import { 
  Send, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Bookmark, 
  HelpCircle, 
  ArrowRight, 
  Layers, 
  Filter,
  Camera,
  Image as ImageIcon,
  UploadCloud
} from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  isLoading: boolean;
  selectedDocsCount: number;
  filterCategory: string;
  onSendMessage: (query: string) => void;
  onClearMessages: () => void;
  onSelectCategory: (cat: string) => void;
  onViewSource: (source: SourceCitation) => void;
  onUploadImage?: (file: File) => Promise<void>;
  isUploadingImage?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  isLoading,
  selectedDocsCount,
  filterCategory,
  onSendMessage,
  onClearMessages,
  onSelectCategory,
  onViewSource,
  onUploadImage,
  isUploadingImage = false,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadImage) {
      await onUploadImage(file);
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

  return (
    <main className="flex-1 flex flex-col h-full bg-[#F8FAFC] font-sans text-[#1E293B] relative overflow-hidden">
      {/* Top Filter & Scope Tools bar */}
      <div className="h-14 px-6 sm:px-8 border-b border-[#E2E8F0] bg-white flex items-center justify-between z-10 flex-shrink-0">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-[#64748B] font-semibold text-[11px] uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="hidden sm:inline">Scope Filter:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {[
              { id: 'all', label: 'All Documents' },
              { id: 'bylaws', label: 'Bylaws & CC&Rs' },
              { id: 'minutes', label: 'Board Minutes' },
              { id: 'financials', label: 'Financials' },
              { id: 'architectural', label: 'ARC / Design' },
              { id: 'rules', label: 'Rules' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
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

        {messages.length > 0 && (
          <button
            onClick={onClearMessages}
            title="Clear Chat History"
            className="flex items-center gap-1 text-[#94A3B8] hover:text-rose-600 text-xs font-medium transition px-2.5 py-1 rounded-md hover:bg-rose-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        )}
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {messages.length === 0 ? (
          /* Empty state matching Professional Polish layout */
          <div className="max-w-3xl mx-auto py-6 space-y-8 animate-in fade-in duration-300">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#EFF6FF] border border-blue-200 text-[#2563EB] shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
                HOA Document Assistant
              </h2>
              <p className="text-sm text-[#64748B] max-w-lg mx-auto leading-relaxed">
                Query governing bylaws, architectural rules, dues, and board resolutions with verifiable citations directly from your documents.
              </p>
            </div>

            {/* Frequent Queries Starter Cards */}
            <div>
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-[#64748B] mb-3 text-center sm:text-left">
                Frequent Queries & Starter Prompts
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
                /* User bubble - Professional Royal Blue rounded pill */
                <div className="bg-[#2563EB] text-white px-5 py-3.5 rounded-2xl rounded-tr-none max-w-[85%] sm:max-w-[75%] shadow-sm">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                /* Assistant response card - Clean white card with slate borders */
                <div className="bg-white border border-[#E2E8F0] text-[#1E293B] px-5 sm:px-6 py-5 rounded-2xl rounded-tl-none max-w-[92%] sm:max-w-[85%] shadow-sm space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-[#2563EB] rounded-full flex items-center justify-center text-[8px] text-white font-bold">
                        AI
                      </div>
                      <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-tighter">
                        Assistant • Verified HOA Source
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="p-1 text-[#94A3B8] hover:text-[#0F172A] transition rounded hover:bg-[#F1F5F9] flex items-center gap-1 text-[10px] font-medium"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-[#2563EB]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Markdown content */}
                  <div className="text-sm text-[#1E293B] leading-relaxed space-y-2">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ ...props }) => (
                          <div className="overflow-x-auto my-3 border border-[#E2E8F0] rounded-lg">
                            <table className="min-w-full divide-y divide-[#E2E8F0] text-xs" {...props} />
                          </div>
                        ),
                        thead: ({ ...props }) => <thead className="bg-[#F8FAFC] font-semibold text-[#0F172A]" {...props} />,
                        th: ({ ...props }) => <th className="px-3 py-2 text-left font-bold text-[#0F172A] border-b border-[#E2E8F0]" {...props} />,
                        td: ({ ...props }) => <td className="px-3 py-2 text-[#334155] border-b border-[#F1F5F9]" {...props} />,
                        h3: ({ ...props }) => <h3 className="font-bold text-[#0F172A] text-sm mt-3 mb-1.5" {...props} />,
                        h4: ({ ...props }) => <h4 className="font-semibold text-[#0F172A] text-xs mt-2 mb-1" {...props} />,
                        ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1.5 my-2 text-[#334155]" {...props} />,
                        ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1.5 my-2 text-[#334155]" {...props} />,
                        li: ({ ...props }) => <li className="text-[#334155] text-sm leading-relaxed" {...props} />,
                        blockquote: ({ ...props }) => (
                          <blockquote className="border-l-3 border-[#2563EB] bg-[#EFF6FF]/60 pl-3 py-1.5 my-2 italic text-[#1E293B] rounded-r" {...props} />
                        ),
                        strong: ({ ...props }) => <strong className="font-semibold text-[#0F172A]" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Sources & Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#F1F5F9] space-y-2">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                        <Bookmark className="w-3 h-3 text-[#2563EB]" />
                        Document Citations & Excerpts:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((source, idx) => (
                          <button
                            key={idx}
                            onClick={() => onViewSource(source)}
                            className="px-2.5 py-1 rounded-md bg-[#F1F5F9] hover:bg-[#EFF6FF] text-[#475569] hover:text-[#2563EB] border border-[#E2E8F0] hover:border-blue-200 text-[11px] font-medium transition flex items-center gap-1.5 group cursor-pointer"
                            title="Click to view exact text excerpt"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                            <span className="truncate max-w-[200px]">{source.fileName}</span>
                            {source.sectionOrClause && (
                              <span className="text-[10px] text-[#64748B] group-hover:text-[#2563EB]">
                                ({source.sectionOrClause})
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Questions */}
                  {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#F1F5F9] space-y-1.5">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-[#2563EB]" />
                        Suggested Follow-ups:
                      </p>
                      <div className="space-y-1">
                        {msg.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handlePromptClick(q)}
                            className="w-full text-left p-2 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] text-xs text-[#475569] hover:text-[#2563EB] border border-[#E2E8F0] hover:border-blue-200 transition flex items-center justify-between group cursor-pointer"
                          >
                            <span>"{q}"</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#2563EB] transition" />
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

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-3xl mx-auto justify-start">
            <div className="bg-white border border-[#E2E8F0] text-[#1E293B] px-5 py-4 rounded-2xl rounded-tl-none shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0F172A]">
                <div className="w-2 h-2 rounded-full bg-[#2563EB] animate-ping"></div>
                <span>Analyzing HOA governing documents...</span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                Cross-referencing bylaws, minutes, dues schedules, and ARC policies
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Box */}
      <div className="p-4 sm:p-6 bg-white border-t border-[#E2E8F0] z-10 flex-shrink-0">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* Hidden file input for image upload */}
          <input
            type="file"
            ref={chatFileInputRef}
            onChange={handleChatFileChange}
            accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isUploadingImage}
          />

          <div className="relative group">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={
                selectedDocsCount > 0
                  ? `Ask a question about your ${selectedDocsCount} indexed HOA documents...`
                  : 'Ask about bylaws, meeting minutes, 2026 dues, reserve funds, parking rules...'
              }
              className="w-full min-h-[56px] pl-12 pr-16 py-4 bg-white border border-[#CBD5E1] rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all text-sm text-[#1E293B] placeholder-[#94A3B8] resize-none"
            />

            {/* Left-side image upload button */}
            <button
              type="button"
              onClick={() => chatFileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="absolute left-2.5 top-2.5 h-10 w-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer disabled:opacity-50"
              title="Upload JPG/Photo of meeting notes or financials to parse with Vision OCR"
            >
              {isUploadingImage ? (
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>

            {/* Right-side submit button */}
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2.5 top-2.5 h-10 w-10 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:hover:bg-[#2563EB] rounded-lg flex items-center justify-center transition-colors shadow-md text-white cursor-pointer"
              title="Send question"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2.5 px-1 text-[10px] text-[#94A3B8]">
            <div className="flex items-center gap-1.5 text-indigo-600 font-medium">
              <Camera className="w-3 h-3 text-indigo-500" />
              <span>JPG OCR Supported (Meeting Photos & Financial Records)</span>
            </div>
            <span className="uppercase tracking-widest font-semibold">
              Gemini 3.7 Flash Verified Assistant
            </span>
          </div>
        </form>
      </div>
    </main>
  );
};

