import React from 'react';
import { X, Activity, Cpu, Sparkles, Terminal } from 'lucide-react';
import { ActivityLog } from '../types';

interface ActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLog[];
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  if (!isOpen) return null;

  // Calculate total tokens
  const totalTokens = logs.reduce(
    (acc, log) => {
      if (log.tokens) {
        acc.input += log.tokens.inputTokens || 0;
        acc.output += log.tokens.outputTokens || 0;
      }
      return acc;
    },
    { input: 0, output: 0 }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Log Eksekusi Real-Time & Penggunaan Token
              </h3>
              <p className="text-[11px] text-slate-400">
                Lacak aktivitas koordinasi Boss & Agent secara rinci
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

        {/* Token Stats Summary */}
        <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-800 bg-slate-950/60 p-3 text-center">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              Input Tokens
            </span>
            <div className="text-sm font-bold text-indigo-400 font-mono">
              {totalTokens.input.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              Output Tokens
            </span>
            <div className="text-sm font-bold text-purple-400 font-mono">
              {totalTokens.output.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              Total Token Use
            </span>
            <div className="text-sm font-bold text-emerald-400 font-mono">
              {(totalTokens.input + totalTokens.output).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Log Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-950/80 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-2">
              <Terminal className="w-8 h-8 text-slate-600" />
              <span>Belum ada log eksekusi. Berikan instruksi ke Boss untuk memulai.</span>
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg border bg-slate-900/60 border-slate-800/80 flex items-start gap-3 transition-all hover:border-slate-700"
              >
                <div className="text-[10px] text-slate-500 shrink-0 mt-0.5 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          log.eventType === 'PLAN_WARNING' ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                      />
                      {log.agentName}
                    </span>
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded border ${
                        log.eventType === 'PLAN_WARNING'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {log.eventType}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans text-xs">
                    {log.message}
                  </p>
                  {log.tokens && (
                    <div className="mt-1 text-[10px] text-slate-500 flex items-center gap-2">
                      <Cpu className="w-3 h-3 text-slate-400" />
                      <span>
                        Tokens: {log.tokens.inputTokens} in / {log.tokens.outputTokens} out
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/80 text-right">
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
