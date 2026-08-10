import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ControlRoom } from './components/Dashboard/ControlRoom';
import { TeamWizard } from './components/Wizard/TeamWizard';
import { ActivityLogsModal } from './components/ActivityLogsModal';
import { AgentDetailModal } from './components/AgentDetailModal';
import { ExportFixtureModal } from './components/ExportFixtureModal';
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

  // Modal States
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
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

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];

  const handleCreateTeam = (newTeam: Team) => {
    setTeams((prev) => [newTeam, ...prev]);
    setActiveTeamId(newTeam.id);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        teams={teams}
        activeTeam={activeTeam}
        onSelectTeam={setActiveTeamId}
        onOpenWizard={() => setIsWizardOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenFixtureModal={() => setIsFixtureModalOpen(true)}
        logCount={activityLogs.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {activeTeam ? (
          <ControlRoom
            team={activeTeam}
            onOpenAgentModal={handleOpenAgentModal}
            onAddLog={handleAddLog}
          />
        ) : (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-4">
            <h2 className="text-xl font-bold text-slate-200">Belum Ada Tim AI Virtual</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Buat tim AI Virtual pertama Anda untuk mendampingi bisnis UMKM Anda.
            </p>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              + Buat Tim AI Pertama
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-400">UMKM Virtual Team</span> — Platform Multi-Agent AI untuk UMKM Indonesia
          </div>
          <div>Powered by Google Gemini API & Cloud Run</div>
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
