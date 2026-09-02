import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Key, 
  Globe, 
  RefreshCw, 
  Sliders
} from 'lucide-react';
import { AIConfig } from '../types';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  onSaveConfig: (config: AIConfig) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [currentConfig, setCurrentConfig] = useState<AIConfig>(config);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; availableModels?: string[] } | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConfig: currentConfig }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.availableModels && data.availableModels.length > 0 && !currentConfig.customModelName) {
        setCurrentConfig(prev => ({ ...prev, customModelName: data.availableModels[0] }));
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Failed to connect to specified endpoint.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveConfig(currentConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">AI Model & Server Configuration</h2>
              <p className="text-xs text-zinc-400">Choose Google Gemini or connect your private self-hosted AI server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCurrentConfig(prev => ({ ...prev, provider: 'gemini' }));
                  setTestResult(null);
                }}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                  currentConfig.provider === 'gemini'
                    ? 'border-emerald-500 bg-emerald-500/10 text-zinc-100 ring-1 ring-emerald-500/50'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Sparkles className={`w-4 h-4 ${currentConfig.provider === 'gemini' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span>Google Gemini</span>
                  </div>
                  {currentConfig.provider === 'gemini' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Active</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Multimodal OCR for images, high-speed document indexing, and grounded legal answers.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCurrentConfig(prev => ({ ...prev, provider: 'custom' }));
                  setTestResult(null);
                }}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                  currentConfig.provider === 'custom'
                    ? 'border-emerald-500 bg-emerald-500/10 text-zinc-100 ring-1 ring-emerald-500/50'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium">
                    <Server className={`w-4 h-4 ${currentConfig.provider === 'custom' ? 'text-emerald-400' : 'text-zinc-500'}`} />
                    <span>Private AI Server</span>
                  </div>
                  {currentConfig.provider === 'custom' && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Active</span>
                  )}
                </div>
                <p className="text-xs text-zinc-400">
                  Self-hosted Ollama, vLLM, LM Studio, or OpenAI-compatible local GPU server endpoint.
                </p>
              </button>
            </div>
          </div>

          {/* Gemini Model Selector */}
          {currentConfig.provider === 'gemini' && (
            <div className="space-y-4 rounded-xl p-4 bg-zinc-950/40 border border-zinc-800/80">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Select Gemini Model
                </label>
                <select
                  value={currentConfig.geminiModel}
                  onChange={(e) => setCurrentConfig(prev => ({ ...prev, geminiModel: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="gemini-3.7-flash">Gemini 3.7 Flash (Default - High Speed, Multimodal OCR & Reasoning)</option>
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (Fast & Reliable)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Lightweight & Low Latency)</option>
                </select>
                <p className="text-xs text-zinc-400 mt-1.5">
                  Gemini automatically analyzes multi-page documents, spreadsheets, bylaws, and handwritten ARC forms.
                </p>
              </div>
            </div>
          )}

          {/* Private Server Details */}
          {currentConfig.provider === 'custom' && (
            <div className="space-y-4 rounded-xl p-4 bg-zinc-950/40 border border-zinc-800/80">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  Private Server HTTP Address / URL
                </label>
                <input
                  type="text"
                  placeholder="http://localhost:11434/v1 or http://192.168.1.50:8000/v1"
                  value={currentConfig.customEndpoint}
                  onChange={(e) => setCurrentConfig(prev => ({ ...prev, customEndpoint: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Compatible with Ollama (<code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">http://localhost:11434/v1</code>), vLLM, LM Studio (<code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">http://localhost:1234/v1</code>), LocalAI, or TGI.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  Model Identifier / Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. llama3.3, mistral-large, deepseek-r1, qwen2.5:72b"
                  value={currentConfig.customModelName}
                  onChange={(e) => setCurrentConfig(prev => ({ ...prev, customModelName: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-zinc-400" />
                  API Key / Bearer Token <span className="text-zinc-500 font-normal">(Optional)</span>
                </label>
                <input
                  type="password"
                  placeholder="sk-... (Leave blank if not required on local network)"
                  value={currentConfig.customApiKey || ''}
                  onChange={(e) => setCurrentConfig(prev => ({ ...prev, customApiKey: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Temperature slider */}
          <div className="rounded-xl p-4 bg-zinc-950/40 border border-zinc-800/80 flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                Query Temperature / Creativity
              </label>
              <p className="text-xs text-zinc-400">Lower values (0.1 - 0.2) ensure strict adherence to HOA bylaws and financials.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={currentConfig.temperature ?? 0.2}
                onChange={(e) => setCurrentConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                className="w-24 accent-emerald-500 cursor-pointer"
              />
              <span className="font-mono text-xs text-zinc-200 w-8 text-right font-medium">
                {currentConfig.temperature ?? 0.2}
              </span>
            </div>
          </div>

          {/* Connection Test & Status Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">Connection Verification</span>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Testing Endpoint...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Test Connection
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                testResult.success 
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' 
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-medium">{testResult.message}</p>
                  {testResult.availableModels && testResult.availableModels.length > 0 && (
                    <div className="mt-1 pt-1 border-t border-emerald-800/40">
                      <span className="text-emerald-400 font-medium">Detected Models: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.availableModels.map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setCurrentConfig(prev => ({ ...prev, customModelName: m }))}
                            className="px-1.5 py-0.5 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-700/50 rounded text-[11px] font-mono"
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
          >
            Save & Apply Model
          </button>
        </div>
      </div>
    </div>
  );
};
