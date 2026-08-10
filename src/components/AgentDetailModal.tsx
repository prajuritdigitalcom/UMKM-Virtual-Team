import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, Bot, Copy, Download, Check, Sparkles, Sliders, FileText, FileSpreadsheet } from 'lucide-react';
import { AgentConfig, Task } from '../types';
import { exportToTxt, exportToDoc, exportToPdf, exportToCsv } from '../utils/exportHelpers';

interface AgentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentConfig | null;
  latestTask?: Task | null;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({
  isOpen,
  onClose,
  agent,
  latestTask,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !agent) return null;

  const handleCopy = () => {
    if (latestTask?.result) {
      navigator.clipboard.writeText(latestTask.result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{agent.avatar}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">{agent.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold uppercase">
                  {agent.roleTitle}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Model: {agent.model} • Status: {latestTask ? latestTask.status : (agent.active ? 'IDLE' : 'OFFLINE')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Tabs / Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Output Section if task exists */}
          {latestTask && latestTask.result ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Hasil Pekerjaan Agent ({agent.name})
                </span>

                {/* Export Options for Agent Result */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    onClick={handleCopy}
                    className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors border border-slate-700"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Tercopy' : 'Copy'}
                  </button>
                  <button
                    onClick={() => exportToDoc(`Hasil_${agent.name}_${agent.roleTitle}`, latestTask.result || '')}
                    className="px-2 py-1 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Word
                  </button>
                  <button
                    onClick={() => exportToPdf(`Hasil_${agent.name}_${agent.roleTitle}`, latestTask.result || '')}
                    className="px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    PDF
                  </button>
                  <button
                    onClick={() => exportToTxt(`Hasil_${agent.name}_${agent.roleTitle}`, latestTask.result || '')}
                    className="px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 transition-colors border border-slate-700"
                  >
                    TXT
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans max-h-80 overflow-y-auto">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-base font-bold text-indigo-300 mt-3 mb-1.5 border-b border-slate-800 pb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold text-indigo-400 mt-2.5 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-bold text-slate-200 mt-2 mb-1">{children}</h3>,
                    p: ({ children }) => <p className="mb-2 leading-relaxed text-slate-300">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5 text-slate-300 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5 text-slate-300 pl-1">{children}</ol>,
                    li: ({ children }) => <li className="text-slate-300">{children}</li>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500 pl-2 my-1 text-slate-400 italic bg-slate-900/50 py-1 rounded-r">{children}</blockquote>,
                    strong: ({ children }) => <strong className="font-bold text-slate-100">{children}</strong>,
                    code: ({ children }) => <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded text-[11px] font-mono">{children}</code>,
                  }}
                >
                  {latestTask.result}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs text-slate-400 italic">
              Agent ini belum memiliki hasil pengerjaan pada tugas berjalan.
            </div>
          )}

          {/* System Prompt & Personality */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-purple-400" />
              System Prompt & Standar Kerja Agent
            </span>
            <div className="p-4 bg-slate-950/50 border border-slate-800/80 rounded-xl text-[11px] text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-56 overflow-y-auto">
              {agent.systemPrompt}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {agent.active ? '● Agent Aktif & Siap Menerima Tugas' : '○ Agent Nonaktif'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
