import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  Bot,
  Crown,
  Users,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AgentConfig, BossPreset, Team } from '../../types';
import { BOSS_PRESETS, MEMBER_PRESETS } from '../../data/presetAgents';

interface TeamWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTeam: (team: Team) => void;
}

export const TeamWizard: React.FC<TeamWizardProps> = ({
  isOpen,
  onClose,
  onCreateTeam,
}) => {
  const [step, setStep] = useState<number>(1);

  // Form State
  const [teamName, setTeamName] = useState('Tim Pertumbuhan UMKM');
  const [businessContext, setBusinessContext] = useState(
    'Usaha Kuliner & Makanan Ringan UMKM'
  );
  const [selectedBossPreset, setSelectedBossPreset] = useState<BossPreset>(
    BOSS_PRESETS[0]
  );
  
  // Selected roles (indices or roles from MEMBER_PRESETS) - default select 2-3 members for MVP
  const [selectedMemberRoles, setSelectedMemberRoles] = useState<string[]>([
    'marketing',
    'sales',
    'content',
  ]);

  // Configured Members
  const [configuredMembers, setConfiguredMembers] = useState<AgentConfig[]>(
    []
  );

  // Whenever selectedMemberRoles change, initialize configuredMembers
  React.useEffect(() => {
    const updated = selectedMemberRoles.map((role) => {
      const preset = MEMBER_PRESETS.find((m) => m.role === role)!;
      return {
        id: `agent-${role}-${Date.now()}`,
        type: 'member' as const,
        name: preset.name,
        role: preset.role,
        roleTitle: preset.roleTitle,
        avatar: preset.avatar,
        color: preset.color,
        systemPrompt: preset.systemPrompt,
        model: preset.model,
        active: true,
      };
    });
    setConfiguredMembers(updated);
  }, [selectedMemberRoles]);

  if (!isOpen) return null;

  const toggleMemberRole = (role: string) => {
    if (selectedMemberRoles.includes(role)) {
      setSelectedMemberRoles(selectedMemberRoles.filter((r) => r !== role));
    } else {
      // Enforce MVP constraint: max 3 members
      if (selectedMemberRoles.length >= 3) {
        return; // UI limit reached
      }
      setSelectedMemberRoles([...selectedMemberRoles, role]);
    }
  };

  const handleFinish = () => {
    // Trigger celebratory confetti
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }

    const bossConfig: AgentConfig = {
      id: `boss-${Date.now()}`,
      type: 'boss',
      name: selectedBossPreset.name,
      role: 'boss',
      roleTitle: selectedBossPreset.title,
      avatar: selectedBossPreset.avatar,
      color: selectedBossPreset.color,
      systemPrompt: selectedBossPreset.systemPrompt,
      model: 'gemini-3.6-flash',
      active: true,
    };

    const newTeam: Team = {
      id: `team-${Date.now()}`,
      name: teamName.trim() || 'Tim AI Baru',
      businessContext: businessContext.trim(),
      boss: bossConfig,
      members: configuredMembers,
      createdAt: new Date().toISOString(),
    };

    onCreateTeam(newTeam);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Wizard 5 Langkah: Buat Tim AI Virtual
              </h2>
              <p className="text-xs text-slate-400">
                Langkah {step} dari 5 — {getStepTitle(step)}
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

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-1.5 w-full rounded-full transition-all ${
                  s <= step
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                    : 'bg-slate-800'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Team Name & Context */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  1. Nama Tim AI Virtual Anda
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Contoh: Tim Digital Marketing, Tim Penjualan UMKM..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  2. Konteks Bisnis / Jenis Produk UMKM (Opsional tapi Disarankan)
                </label>
                <textarea
                  rows={3}
                  value={businessContext}
                  onChange={(e) => setBusinessContext(e.target.value)}
                  placeholder="Jelaskan jenis produk, skala usaha, target pembeli... (mis. Usaha Sambal Kemasan Kemasan Botol Plastik, Omset Rp 15jt/bulan, Target Ibu Rumah Tangga & Anak Kos)"
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Konteks ini akan otomatis dibaca oleh Boss & seluruh Agent untuk menghasilkan saran yang akurat & realistis.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Choose Boss */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                Pilih Pemimpin Tim (Boss / Coordinator AI)
              </div>
              <p className="text-xs text-slate-400">
                Boss bertugas memahami instruksi Anda, memecah tugas, mendelegasikan ke agent spesialis, dan menyatukan hasil menjadi 1 Laporan Utama.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {BOSS_PRESETS.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBossPreset(b)}
                    className={`cursor-pointer p-4 rounded-xl border transition-all relative flex flex-col justify-between ${
                      selectedBossPreset.id === b.id
                        ? 'bg-slate-800/90 border-amber-500 ring-1 ring-amber-500 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-800/40 border-slate-700/70 hover:border-slate-600 hover:bg-slate-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl">{b.avatar}</span>
                        {selectedBossPreset.id === b.id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Dipilih
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-100 text-sm">{b.name}</h3>
                      <p className="text-xs text-amber-400 font-medium mb-2">{b.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Select Members (MVP limit: max 3 active members) */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-400" />
                    Pilih Anggota Tim AI Spesialis
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Pilih hingga <span className="font-bold text-indigo-300">maksimal 3 agent</span> (Batas MVP) agar eksekusi fokus dan cepat.
                  </p>
                </div>
                <div className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-indigo-300">
                  {selectedMemberRoles.length} / 3 Terpilih
                </div>
              </div>

              {selectedMemberRoles.length >= 3 && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Batas MVP maksimal 3 agent aktif tercapai. Uncheck agent untuk mengganti pilihan.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {MEMBER_PRESETS.map((m) => {
                  const isSelected = selectedMemberRoles.includes(m.role);
                  const isLimitReached = !isSelected && selectedMemberRoles.length >= 3;

                  return (
                    <div
                      key={m.role}
                      onClick={() => !isLimitReached && toggleMemberRole(m.role)}
                      className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 cursor-pointer'
                          : isLimitReached
                          ? 'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'
                          : 'bg-slate-800/40 border-slate-700/70 hover:bg-slate-800/70 hover:border-slate-600 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl mt-0.5">{m.avatar}</span>
                        <div>
                          <h4 className="font-semibold text-slate-200 text-xs">{m.name}</h4>
                          <p className="text-[11px] text-slate-400 font-medium">{m.roleTitle}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'border-slate-600 bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Configure Agents */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                Konfigurasi Agent Dalam Tim
              </div>
              <p className="text-xs text-slate-400">
                Sesuaikan nama agent atau aktifkan/nonaktifkan agent sesuai kebutuhan tim Anda.
              </p>

              <div className="space-y-3">
                {configuredMembers.map((member, idx) => (
                  <div
                    key={member.id}
                    className="p-4 bg-slate-800/60 border border-slate-700/70 rounded-xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{member.avatar}</span>
                        <div>
                          <span className="text-xs font-bold text-slate-200">{member.roleTitle}</span>
                          <p className="text-[11px] text-slate-400">Gemini Model: {member.model}</p>
                        </div>
                      </div>

                      {/* Active Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                        <input
                          type="checkbox"
                          checked={member.active}
                          onChange={(e) => {
                            const copy = [...configuredMembers];
                            copy[idx].active = e.target.checked;
                            setConfiguredMembers(copy);
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                        />
                        <span>{member.active ? 'Aktif' : 'Nonaktif'}</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Nama Agent
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => {
                            const copy = [...configuredMembers];
                            copy[idx].name = e.target.value;
                            setConfiguredMembers(copy);
                          }}
                          className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                          Sistem Role/Fokus
                        </label>
                        <input
                          type="text"
                          value={member.roleTitle}
                          disabled
                          className="w-full bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400 cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Create Team & Summary */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="text-center py-2 space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white mx-auto shadow-xl shadow-indigo-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-100">Tim AI Virtual Siap Diluncurkan!</h3>
                <p className="text-xs text-slate-400">
                  Berikut adalah ringkasan struktur tim baru yang akan mengawal bisnis UMKM Anda.
                </p>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div>
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Nama Tim:</span>
                    <h4 className="text-base font-bold text-slate-100">{teamName}</h4>
                    {businessContext && (
                      <p className="text-xs text-slate-400 mt-0.5">Context: {businessContext}</p>
                    )}
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Status: Ready
                  </span>
                </div>

                {/* Boss summary */}
                <div className="flex items-center gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700/50">
                  <span className="text-2xl">{selectedBossPreset.avatar}</span>
                  <div>
                    <div className="text-[11px] font-bold text-amber-400 uppercase">
                      Boss / Coordinator
                    </div>
                    <div className="font-semibold text-slate-200 text-xs">
                      {selectedBossPreset.name} — {selectedBossPreset.title}
                    </div>
                  </div>
                </div>

                {/* Members summary */}
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase">
                    Anggota Agent Spesialis ({configuredMembers.filter((m) => m.active).length} Aktif)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {configuredMembers.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                          m.active
                            ? 'bg-slate-900/80 border-slate-700 text-slate-200'
                            : 'bg-slate-900/30 border-slate-800 text-slate-500 line-through'
                        }`}
                      >
                        <span>{m.avatar}</span>
                        <div className="truncate">
                          <div className="font-semibold truncate">{m.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{m.roleTitle}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Controls */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className={`px-4 py-2 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all ${
              step === 1
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 3 && selectedMemberRoles.length === 0}
              className={`px-5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 transition-all ${
                step === 3 && selectedMemberRoles.length === 0
                  ? 'opacity-50 cursor-not-allowed'
                  : ''
              }`}
            >
              Lanjut
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 text-white bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:opacity-90 shadow-xl shadow-indigo-500/25 transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Luncurkan Tim AI Sekarang
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function getStepTitle(step: number): string {
  switch (step) {
    case 1:
      return 'Nama & Konteks Tim UMKM';
    case 2:
      return 'Pilih Boss / Coordinator';
    case 3:
      return 'Pilih Anggota Spesialis';
    case 4:
      return 'Konfigurasi Detail Agent';
    case 5:
      return 'Review & Peluncuran';
    default:
      return '';
  }
}
