import React from 'react';
import { Bot, Plus, ChevronDown, CheckCircle2, Building2, Sparkles, Key, Trash2 } from 'lucide-react';
import { Team } from '../types';

interface NavbarProps {
  teams: Team[];
  activeTeam: Team | null;
  onSelectTeam: (teamId: string) => void;
  onDeleteTeam: (teamId: string) => void;
  onOpenWizard: () => void;
  onOpenApiKeyModal: () => void;
  apiKeysCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  teams,
  activeTeam,
  onSelectTeam,
  onDeleteTeam,
  onOpenWizard,
  onOpenApiKeyModal,
  apiKeysCount,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-[#fe4c6f] to-rose-600 flex items-center justify-center shadow-lg shadow-[#fe4c6f]/20 ring-1 ring-white/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                UMKM Virtual Team
              </h1>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[#fe4c6f]/20 text-[#fe4c6f] border border-[#fe4c6f]/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#fe4c6f]" />
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
              <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in duration-150">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60">
                  Daftar Tim Saya ({teams.length})
                </div>
                <div className="max-h-60 overflow-y-auto py-1 divide-y divide-slate-700/40">
                  {teams.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                      Belum ada tim yang tersimpan.
                    </div>
                  ) : (
                    teams.map((t) => (
                      <div
                        key={t.id}
                        className={`group px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700/60 transition-colors ${
                          activeTeam?.id === t.id ? 'bg-[#fe4c6f]/10 text-slate-100 font-semibold' : 'text-slate-300'
                        }`}
                      >
                        {deleteConfirmId === t.id ? (
                          <div className="flex items-center justify-between w-full py-0.5">
                            <span className="text-rose-400 font-medium text-[11px] truncate">Hapus tim ini?</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTeam(t.id);
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold rounded transition-colors"
                              >
                                Ya
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(null);
                                }}
                                className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-medium rounded transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                onSelectTeam(t.id);
                                setDropdownOpen(false);
                              }}
                              className="flex-1 text-left min-w-0 pr-2"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {activeTeam?.id === t.id && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#fe4c6f] shrink-0" />
                                )}
                                <span className="truncate font-medium">{t.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 truncate pl-5">
                                {t.boss.name} + {t.members.length} agent
                              </div>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(t.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors opacity-80 group-hover:opacity-100"
                              title="Hapus Tim Ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-slate-700/80 p-1 bg-slate-900/40">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenWizard();
                    }}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-[#fe4c6f] hover:text-rose-300 hover:bg-slate-700/50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Buat Tim AI Baru...
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Gemini Key Button */}
          <button
            onClick={onOpenApiKeyModal}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-[#fe4c6f]/50 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg transition-all group"
            title="Klik untuk Pengaturan Gemini API Keys"
          >
            <Key className="w-3.5 h-3.5 text-[#fe4c6f] group-hover:scale-110 transition-transform" />
            <span className="text-slate-400">Gemini Key:</span>
            <span className="text-emerald-400 font-mono font-semibold">
              {apiKeysCount > 0 ? `${apiKeysCount} Aktif` : 'Tersambung'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
