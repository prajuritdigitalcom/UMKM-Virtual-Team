import React, { useState, useEffect } from 'react';
import { FileCheck } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ControlRoom } from './components/Dashboard/ControlRoom';
import { TeamWizard } from './components/Wizard/TeamWizard';
import { ActivityLogsModal } from './components/ActivityLogsModal';
import { AgentDetailModal } from './components/AgentDetailModal';
import { ExportFixtureModal } from './components/ExportFixtureModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { Team, AgentConfig, Task, ActivityLog } from './types';
import { INITIAL_TEAMS } from './data/sampleTeams';

export default function App() {
  // Load saved teams or default to INITIAL_TEAMS
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const saved = localStorage.getItem('umkm_virtual_teams');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved teams:', e);
    }
    return INITIAL_TEAMS;
  });

  const [activeTeamId, setActiveTeamId] = useState<string>(() => {
    return teams[0]?.id || INITIAL_TEAMS[0].id;
  });

  // Custom Gemini API keys state
  const [apiKeys, setApiKeys] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('umkm_gemini_api_keys');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load saved API keys:', e);
    }
    return [];
  });

  // Modal States
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [selectedAgentForModal, setSelectedAgentForModal] = useState<AgentConfig | null>(null);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  // Save teams to local storage when changed
  useEffect(() => {
    try {
      localStorage.setItem('umkm_virtual_teams', JSON.stringify(teams));
    } catch (e) {
      console.error('Failed to save teams:', e);
    }
  }, [teams]);

  // Save API keys to local storage when changed
  const handleSaveApiKeys = (keys: string[]) => {
    setApiKeys(keys);
    try {
      localStorage.setItem('umkm_gemini_api_keys', JSON.stringify(keys));
    } catch (e) {
      console.error('Failed to save API keys:', e);
    }
  };

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0] || null;

  const handleCreateTeam = (newTeam: Team) => {
    setTeams((prev) => [newTeam, ...prev]);
    setActiveTeamId(newTeam.id);
  };

  const handleDeleteTeam = (teamId: string) => {
    setTeams((prev) => {
      const updated = prev.filter((t) => t.id !== teamId);
      if (activeTeamId === teamId) {
        if (updated.length > 0) {
          setActiveTeamId(updated[0].id);
        } else {
          setActiveTeamId('');
        }
      }
      return updated;
    });
  };

  const handleAddLog = (logData: Omit<ActivityLog, 'id' | 'timestamp'>) => {
    const newLog: ActivityLog = {
      ...logData,
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs((prev) => [newLog, ...prev]);
  };

  const handleOpenAgentModal = (agent: AgentConfig, task?: Task | null) => {
    setSelectedAgentForModal(agent);
    setSelectedTaskForModal(task || null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-[#fe4c6f] selection:text-white">
      {/* Navigation Header */}
      <Navbar
        teams={teams}
        activeTeam={activeTeam}
        onSelectTeam={setActiveTeamId}
        onDeleteTeam={handleDeleteTeam}
        onOpenWizard={() => setIsWizardOpen(true)}
        onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        apiKeysCount={apiKeys.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {activeTeam ? (
          <ControlRoom
            team={activeTeam}
            apiKeys={apiKeys}
            onOpenAgentModal={handleOpenAgentModal}
            onAddLog={handleAddLog}
            logs={activityLogs}
            onOpenLogs={() => setIsLogsOpen(true)}
          />
        ) : (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
            <h2 className="text-xl font-bold text-slate-200">Belum Ada Tim AI Virtual</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Buat tim AI Virtual pertama Anda untuk mendampingi bisnis UMKM Anda.
            </p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-6 py-2.5 bg-[#fe4c6f] hover:bg-[#e03f5f] text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              + Buat Tim AI Pertama
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-5 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-slate-400 font-medium">
            © 2026 Karya Prajurit Digital. Hak Cipta Dilindungi.
          </div>
          <div>
            <button
              onClick={() => setIsFixtureModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-[#fe4c6f]/30 hover:border-[#fe4c6f] text-[#fe4c6f] text-xs font-semibold px-3 py-1.5 rounded-lg transition-all shadow-sm"
              title="Uji Render Pipeline Ekspor Dokumen"
            >
              <FileCheck className="w-4 h-4 text-[#fe4c6f]" />
              <span>Uji Ekspor</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals & Wizards */}
      <TeamWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onCreateTeam={handleCreateTeam}
      />

      <ActivityLogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        logs={activityLogs}
      />

      <ExportFixtureModal
        isOpen={isFixtureModalOpen}
        onClose={() => setIsFixtureModalOpen(false)}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={handleSaveApiKeys}
      />

      <AgentDetailModal
        isOpen={!!selectedAgentForModal}
        onClose={() => {
          setSelectedAgentForModal(null);
          setSelectedTaskForModal(null);
        }}
        agent={selectedAgentForModal}
        latestTask={selectedTaskForModal}
      />
    </div>
  );
}
