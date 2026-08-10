import React from 'react';
import { Bot, Plus, Activity, ChevronDown, CheckCircle2, Building2, Sparkles, FileCheck } from 'lucide-react';
import { Team } from '../types';

interface NavbarProps {
  teams: Team[];
  activeTeam: Team | null;
  onSelectTeam: (teamId: string) => void;
  onOpenWizard: () => void;
  onOpenLogs: () => void;
  onOpenFixtureModal: () => void;
  logCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  teams,
  activeTeam,
  onSelectTeam,
  onOpenWizard,
  onOpenLogs,
  onOpenFixtureModal,
  logCount,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                UMKM Virtual Team
              </h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                Multi-Agent
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              1 Orang, Kualitas Setara Tim Lengkap
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 md:gap-3">
          {/* Team Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg transition-all"
            >
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="max-w-[150px] sm:max-w-[200px] truncate">
                {activeTeam ? activeTeam.name : 'Pilih Tim AI'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                  Daftar Tim Saya ({teams.length})
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onSelectTeam(t.id);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700/60 transition-colors ${
                        activeTeam?.id === t.id ? 'bg-indigo-600/20 text-indigo-300 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div className="truncate">
                        <div className="truncate font-medium">{t.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t.boss.name} + {t.members.length} agent
                        </div>
                      </div>
                      {activeTeam?.id === t.id && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-700/80 p-1 bg-slate-900/40">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenWizard();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-slate-700/50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Buat Tim AI Baru...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New Team Wizard Button */}
          <button
            onClick={onOpenWizard}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Buat Tim AI Baru</span>
            <span className="sm:hidden">Buat Tim</span>
          </button>

          {/* Activity Logs Button */}
          <button
            onClick={onOpenLogs}
            className="relative flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg transition-all"
            title="Lihat Log Aktivitas & Penggunaan Token"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Log Real-Time</span>
            {logCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                {logCount}
              </span>
            )}
          </button>

          {/* Export Fixture Test Button */}
          <button
            onClick={onOpenFixtureModal}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 border border-indigo-500/30 text-indigo-300 text-xs font-medium px-3 py-2 rounded-lg transition-all"
            title="Uji Render Pipeline Ekspor Dokumen"
          >
            <FileCheck className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Uji Ekspor</span>
          </button>

          {/* API Key Status Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px] px-2.5 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Gemini Key:</span>
            <span className="text-emerald-400 font-mono font-semibold">Tersambung</span>
          </div>
        </div>
      </div>
    </header>
  );
};
