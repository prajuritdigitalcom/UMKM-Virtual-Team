import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Play,
  RotateCcw,
  Sparkles,
  Download,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Eye,
  Building2,
  Lightbulb,
  Bot
} from 'lucide-react';
import { AgentConfig, Job, Task, Team, ActivityLog } from '../../types';
import {
  exportToTxt,
  exportToCsv,
  exportToDoc,
  exportToPdf,
} from '../../utils/exportHelpers';

interface ControlRoomProps {
  team: Team;
  onOpenAgentModal: (agent: AgentConfig, task?: Task | null) => void;
  onAddLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
}

export const ControlRoom: React.FC<ControlRoomProps> = ({
  team,
  onOpenAgentModal,
  onAddLog,
}) => {
  const [instruction, setInstruction] = useState('');
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'synthesis' | 'agent_results'>('synthesis');
  const [selectedAgentResultId, setSelectedAgentResultId] = useState<string | null>(null);

  // Active agents count
  const activeMembers = team.members.filter((m) => m.active);
  const totalAgents = team.members.length + 1; // Members + Boss
  const totalActive = activeMembers.length + (team.boss.active ? 1 : 0);

  // Preset Prompts for UMKM
  const PRESET_PROMPTS = [
    {
      title: '🚀 Launching Produk Baru',
      text: 'Buatkan strategi komprehensif launching produk makanan frozen baru (Risol Mayo Premium). Minta Riset pasar kompetitor lokal, Strategi Marketing & Channel, serta Skrip Penjualan WhatsApp.',
    },
    {
      title: '💬 Skrip Penjualan & Closing WA',
      text: 'Susunkan funnel penjualan WhatsApp dan skrip penanganan keberatan calon pembeli yang mengeluhkan harga terlalu mahal untuk produk fashion lokal.',
    },
    {
      title: '📊 Analisis Biaya & Pricing',
      text: 'Lakukan analisis kelayakan finansial dan estimasi HPP/biaya campaign promosi Instagram/TikTok Ads sebesar Rp 500rb/bulan beserta potensi ROI-nya.',
    },
    {
      title: '📱 Rencana Konten IG & TikTok',
      text: 'Rancang jadwal dan konsep konten 1 minggu untuk Instagram & TikTok lengkap dengan brief prompt visual dan alternatif hook judul menarik.',
    },
  ];

  // Map tasks to runtime agent status
  const getAgentStatus = (agentId: string) => {
    if (agentId === team.boss.id) {
      if (isExecuting && currentJob?.status === 'running') return 'WORKING';
      return 'IDLE';
    }

    const agentObj = team.members.find((m) => m.id === agentId);
    if (!agentObj?.active) return 'OFFLINE';

    if (!currentJob) return 'IDLE';

    const task = currentJob.tasks.find((t) => t.agentId === agentId);
    if (!task) return 'IDLE';

    return task.status;
  };

  // Run the multi-agent orchestration pipeline
  const handleRunJob = async (customInstruction?: string) => {
    const textToRun = customInstruction || instruction;
    if (!textToRun.trim() || isExecuting) return;

    setIsExecuting(true);
    setInstruction('');

    const jobId = `job-${Date.now()}`;

    // Log job start
    onAddLog({
      jobId,
      agentName: team.boss.name,
      eventType: 'JOB_CREATED',
      message: `Instruksi baru diterima: "${textToRun}"`,
    });

    try {
      // -----------------------------------------------------------
      // STEP 1: BOSS PLANNING & SUB-TASK DECOMPOSITION
      // -----------------------------------------------------------
      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'PLANNING_STARTED',
        message: `${team.boss.name} sedang memecah instruksi dan membuat rencana kerja terstruktur...`,
      });

      const planRes = await fetch('/api/boss/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: team.name,
          businessContext: team.businessContext,
          boss: team.boss,
          activeMembers: activeMembers,
          instruction: textToRun,
        }),
      });

      if (!planRes.ok) {
        throw new Error('Gagal menghubungi Boss AI untuk membuat rencana');
      }

      const planData = await planRes.json();
      const plans = planData.plans || [];

      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'PLANNING_COMPLETED',
        message: `${team.boss.name} berhasil membagi ${plans.length} sub-tugas dengan urutan ketergantungan.`,
        tokens: planData.tokens,
      });

      // Construct Initial Job & Tasks
      const initialTasks: Task[] = plans.map((p: any) => ({
        id: `task-${p.agentId}-${Date.now()}`,
        jobId,
        agentId: p.agentId,
        agentName: p.agentName,
        agentRole: p.role,
        instruction: p.instruction,
        dependsOn: p.dependsOn || [],
        status: 'IDLE',
        result: null,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 2,
        inputTokens: 0,
        outputTokens: 0,
      }));

      const newJob: Job = {
        id: jobId,
        teamId: team.id,
        instruction: textToRun,
        status: 'running',
        tasks: initialTasks,
        finalSynthesis: null,
        createdAt: new Date().toISOString(),
      };

      setCurrentJob(newJob);

      // -----------------------------------------------------------
      // STEP 2: EXECUTE TASKS RESPECTING DEPENDENCIES
      // -----------------------------------------------------------
      const completedTaskResults: Array<{
        agentId: string;
        agentName: string;
        role: string;
        result: string;
        status: string;
      }> = [];

      let runningTasks = [...initialTasks];

      // Loop until all tasks are DONE or ERROR
      let iterations = 0;
      const maxIterations = 10;

      while (
        runningTasks.some((t) => t.status === 'IDLE' || t.status === 'WORKING') &&
        iterations < maxIterations
      ) {
        iterations++;

        // Find tasks ready to execute (all dependencies completed)
        const readyTasks = runningTasks.filter((t) => {
          if (t.status !== 'IDLE') return false;
          if (!t.dependsOn || t.dependsOn.length === 0) return true;
          // All dependent agent tasks must be DONE
          return t.dependsOn.every((depId) => {
            const depTask = runningTasks.find((dt) => dt.agentId === depId);
            return depTask && depTask.status === 'DONE';
          });
        });

        // If no ready tasks found but some are idle, check for blocked tasks
        if (readyTasks.length === 0) {
          const hasFailedDeps = runningTasks.some(
            (t) =>
              t.status === 'IDLE' &&
              t.dependsOn.some((depId) => {
                const depTask = runningTasks.find((dt) => dt.agentId === depId);
                return depTask && depTask.status === 'ERROR';
              })
          );

          if (hasFailedDeps) {
            // Mark blocked tasks as ERROR
            runningTasks = runningTasks.map((t) => {
              if (
                t.status === 'IDLE' &&
                t.dependsOn.some((depId) => {
                  const depTask = runningTasks.find((dt) => dt.agentId === depId);
                  return depTask && depTask.status === 'ERROR';
                })
              ) {
                return {
                  ...t,
                  status: 'ERROR',
                  errorMessage: 'Dibatalkan karena task pendahulu gagal (BLOCKED)',
                };
              }
              return t;
            });
            break;
          }
        }

        // Execute ready tasks in parallel
        await Promise.all(
          readyTasks.map(async (taskToRun) => {
            // Update status to WORKING
            runningTasks = runningTasks.map((t) =>
              t.id === taskToRun.id ? { ...t, status: 'WORKING', startedAt: new Date().toISOString() } : t
            );
            setCurrentJob((prev) => (prev ? { ...prev, tasks: [...runningTasks] } : null));

            const agentObj = team.members.find((m) => m.id === taskToRun.agentId);
            if (!agentObj) return;

            onAddLog({
              jobId,
              taskId: taskToRun.id,
              agentName: agentObj.name,
              eventType: 'TASK_STARTED',
              message: `${agentObj.name} (${agentObj.roleTitle}) mulai mengerjakan sub-tugas...`,
            });

            let execData: any = null;
            let lastError: any = null;
            let attempt = 0;

            while (attempt <= taskToRun.maxRetries) {
              try {
                // Gather previous results from dependencies matching agentId
                const prevResults = completedTaskResults.filter((r) =>
                  taskToRun.dependsOn.includes(r.agentId)
                );

                const execRes = await fetch('/api/agent/execute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    agent: agentObj,
                    instruction: taskToRun.instruction,
                    businessContext: team.businessContext,
                    globalInstruction: textToRun,
                    previousResults: prevResults,
                  }),
                });

                if (!execRes.ok) {
                  const execErr: any = new Error(
                    `Execution error for agent ${agentObj.name} (HTTP ${execRes.status})`
                  );
                  execErr.status = execRes.status;
                  throw execErr;
                }

                execData = await execRes.json();
                lastError = null;
                break; // success, exit retry loop
              } catch (err: any) {
                lastError = err;
                attempt++;

                // Client error (4xx selain 429 rate-limit) akan gagal dengan cara
                // yang persis sama kalau diulang — jangan buang jatah retry untuk ini.
                const isNonRetryableClientError =
                  typeof err.status === 'number' &&
                  err.status >= 400 &&
                  err.status < 500 &&
                  err.status !== 429;

                if (isNonRetryableClientError) {
                  break;
                }

                if (attempt <= taskToRun.maxRetries) {
                  onAddLog({
                    jobId,
                    taskId: taskToRun.id,
                    agentName: agentObj.name,
                    eventType: 'TASK_RETRY',
                    message: `Percobaan ke-${attempt} untuk ${agentObj.name} setelah error: ${err.message}`,
                  });
                  // Backoff before retry
                  await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
                }
              }
            }

            if (lastError) {
              runningTasks = runningTasks.map((t) =>
                t.id === taskToRun.id
                  ? {
                      ...t,
                      status: 'ERROR',
                      retryCount: attempt,
                      errorMessage: lastError.message || 'Gagal mengeksekusi sub-tugas setelah retry',
                    }
                  : t
              );

              onAddLog({
                jobId,
                taskId: taskToRun.id,
                agentName: agentObj.name,
                eventType: 'TASK_ERROR',
                message: `Error permanen setelah ${attempt} percobaan pada ${agentObj.name}: ${lastError.message}`,
              });
            } else {
              runningTasks = runningTasks.map((t) =>
                t.id === taskToRun.id
                  ? {
                      ...t,
                      status: 'DONE',
                      result: execData.result,
                      retryCount: attempt,
                      inputTokens: execData.tokens?.inputTokens || 0,
                      outputTokens: execData.tokens?.outputTokens || 0,
                      completedAt: new Date().toISOString(),
                    }
                  : t
              );

              completedTaskResults.push({
                agentId: agentObj.id,
                agentName: agentObj.name,
                role: agentObj.roleTitle,
                result: execData.result,
                status: 'DONE',
              });

              onAddLog({
                jobId,
                taskId: taskToRun.id,
                agentName: agentObj.name,
                eventType: 'TASK_COMPLETED',
                message: `${agentObj.name} telah menyelesaikan sub-tugas dengan sukses.`,
                tokens: execData.tokens,
              });
            }

            setCurrentJob((prev) => (prev ? { ...prev, tasks: [...runningTasks] } : null));
          })
        );
      }

      // Safeguard: mark lingering tasks as ERROR if max iterations reached
      if (iterations >= maxIterations) {
        runningTasks = runningTasks.map((t) => {
          if (t.status === 'IDLE' || t.status === 'WORKING') {
            return {
              ...t,
              status: 'ERROR',
              errorMessage: 'Dibatalkan: batas iterasi tercapai, kemungkinan ada dependency yang tidak terselesaikan',
            };
          }
          return t;
        });
        setCurrentJob((prev) => (prev ? { ...prev, tasks: [...runningTasks] } : null));
      }

      // -----------------------------------------------------------
      // STEP 3: BOSS SYNTHESIS OF FINAL SUPER STRONG REPORT
      // -----------------------------------------------------------
      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'SYNTHESIS_STARTED',
        message: `${team.boss.name} sedang mereview seluruh temuan dan menyusun Laporan Sintesis Akhir...`,
      });

      const synthRes = await fetch('/api/boss/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boss: team.boss,
          teamName: team.name,
          businessContext: team.businessContext,
          userInstruction: textToRun,
          taskResults: runningTasks.map((t) => ({
            agentName: t.agentName,
            agentRole: t.agentRole,
            result: t.result,
            status: t.status,
            errorMessage: t.errorMessage,
          })),
        }),
      });

      if (!synthRes.ok) {
        throw new Error('Sintesis laporan akhir Boss gagal');
      }

      const synthData = await synthRes.json();

      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'SYNTHESIS_COMPLETED',
        message: `${team.boss.name} selesai menyusun Laporan Akhir Super Strong!`,
        tokens: synthData.tokens,
      });

      setCurrentJob({
        id: jobId,
        teamId: team.id,
        instruction: textToRun,
        status: 'done',
        tasks: runningTasks,
        finalSynthesis: synthData.finalSynthesis,
        createdAt: newJob.createdAt,
        completedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Job execution failed:', err);
      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'TASK_ERROR',
        message: `Gangguan alur kerja multi-agent: ${err.message}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Copy Synthesis
  const handleCopySynthesis = () => {
    if (currentJob?.finalSynthesis) {
      navigator.clipboard.writeText(currentJob.finalSynthesis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate overall job progress percentage
  const getJobProgressPercentage = () => {
    if (!currentJob || currentJob.tasks.length === 0) return 0;
    const completed = currentJob.tasks.filter(
      (t) => t.status === 'DONE' || t.status === 'ERROR'
    ).length;
    return Math.round((completed / currentJob.tasks.length) * 100);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner: Control Room Live Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/20">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider">
                  RUANG KONTROL REAL-TIME
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">
                {team.name}
              </h2>
              {team.businessContext && (
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  {team.businessContext}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl">
            <div className="text-right">
              <div className="text-xs font-bold text-slate-200">
                {totalAgents} Agents • {totalActive} Active
              </div>
              <div className="text-[11px] text-slate-400">
                Orkestrasi Multi-Agent
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
              AI
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Boss Card + Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Boss / Coordinator Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-900/90 border border-amber-500/40 shadow-lg relative overflow-hidden group">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-3xl">{team.boss.avatar}</span>
              <div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {team.boss.roleTitle}
                </span>
                <h3 className="font-bold text-slate-100 text-sm mt-0.5">
                  {team.boss.name}
                </h3>
              </div>
            </div>

            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              LEADER
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">
            "Mengoordinasikan tim agent spesialis dan menyatukan laporan akhir."
          </p>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Status Runtime:</span>
            <span className="font-bold text-amber-400 flex items-center gap-1">
              {isExecuting ? 'SYNTHESIZING...' : 'READY'}
            </span>
          </div>
        </div>

        {/* Member Cards */}
        {team.members.map((member) => {
          const status = getAgentStatus(member.id);
          const task = currentJob?.tasks.find((t) => t.agentId === member.id);

          return (
            <div
              key={member.id}
              onClick={() => onOpenAgentModal(member, task)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                status === 'WORKING'
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500 shadow-lg shadow-indigo-500/20'
                  : status === 'DONE'
                  ? 'bg-slate-900/90 border-emerald-500/50 hover:border-emerald-500'
                  : status === 'ERROR'
                  ? 'bg-slate-900/90 border-rose-500/50 hover:border-rose-500'
                  : member.active
                  ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                  : 'bg-slate-900/30 border-slate-800/40 opacity-40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{member.avatar}</span>
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs">
                        {member.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {member.roleTitle}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                      status
                    )}`}
                  >
                    {status}
                  </span>
                </div>

                {/* Task preview or role summary */}
                <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">
                  {task ? task.instruction : member.systemPrompt.slice(0, 75) + '...'}
                </p>
              </div>

              {/* Progress bar for working status */}
              {status === 'WORKING' && (
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-indigo-500 animate-pulse w-3/4 rounded-full" />
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>Model: {member.model}</span>
                <span className="text-indigo-400 flex items-center gap-1 font-semibold group-hover:underline">
                  <Eye className="w-3.5 h-3.5" /> Detail
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Box: Send Instruction to Boss AI */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Beri Instruksi ke Boss ({team.boss.name})
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Boss akan mendelegasikan ke {activeMembers.length} agent aktif
          </span>
        </div>

        {/* Quick Prompts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {PRESET_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleRunJob(p.text)}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-slate-700/80 text-slate-300 hover:text-indigo-300 text-xs font-medium whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              {p.title}
            </button>
          ))}
        </div>

        {/* Input Text Area */}
        <div className="relative">
          <textarea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ketik instruksi bisnis UMKM Anda di sini... (Contoh: Tolong buatkan strategi promosi produk sambal kemasan untuk bulan Ramadan, lengkap dengan riset harga kompetitor dan skrip penawaran WA)"
            className="w-full bg-slate-950/80 border border-slate-700/90 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none pr-32"
          />

          <button
            onClick={() => handleRunJob()}
            disabled={!instruction.trim() || isExecuting}
            className={`absolute right-3 bottom-4 px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg ${
              !instruction.trim() || isExecuting
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 shadow-indigo-600/25 active:scale-95'
            }`}
          >
            {isExecuting ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Sintesis...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Jalankan Tim
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Job Execution Pipeline View */}
      {currentJob && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                PROGRES TUGAS SAAT INI
              </span>
              <h3 className="text-base font-bold text-slate-100">
                "{currentJob.instruction}"
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${getJobProgressPercentage()}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-300 font-mono">
                {getJobProgressPercentage()}%
              </span>
            </div>
          </div>

          {/* Sub-Tasks Stepper / List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {currentJob.tasks.map((task) => (
              <div
                key={task.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${
                  task.status === 'DONE'
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : task.status === 'WORKING'
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 animate-pulse'
                    : task.status === 'ERROR'
                    ? 'bg-rose-950/20 border-rose-500/40'
                    : 'bg-slate-950/40 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-200">
                    {task.agentName} ({task.agentRole})
                  </span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(
                      task.status
                    )}`}
                  >
                    {task.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">
                  {task.instruction}
                </p>

                {task.dependsOn && task.dependsOn.length > 0 && (
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Menunggu: {task.dependsOn.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Final Report Synthesis View */}
          {currentJob.finalSynthesis && (
            <div className="mt-6 border-t border-slate-800 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-100">
                      Laporan Akhir Sintesis Boss ({team.boss.name})
                    </h4>
                    <p className="text-xs text-slate-400">
                      Super Strong — Langsung Dapat Dieksekusi untuk UMKM
                    </p>
                  </div>
                </div>

                {/* Export Toolbar */}
                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={handleCopySynthesis}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Tercopy' : 'Copy'}
                  </button>

                  <button
                    onClick={() =>
                      exportToDoc(
                        `Laporan_${team.name}_${new Date().toISOString().slice(0, 10)}`,
                        currentJob.finalSynthesis || ''
                      )
                    }
                    className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Word (.doc)
                  </button>

                  <button
                    onClick={() =>
                      exportToCsv(
                        `Laporan_${team.name}_${new Date().toISOString().slice(0, 10)}`,
                        currentJob.finalSynthesis || ''
                      )
                    }
                    className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    Excel (.csv)
                  </button>

                  <button
                    onClick={() =>
                      exportToPdf(
                        `Laporan_${team.name}`,
                        currentJob.finalSynthesis || ''
                      )
                    }
                    className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    PDF
                  </button>
                </div>
              </div>

              {/* Rendered Synthesis Content */}
              <div className="p-6 bg-slate-950/90 border border-slate-800 rounded-2xl text-slate-200 text-sm leading-relaxed font-sans max-h-[600px] overflow-y-auto">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-lg font-bold text-indigo-300 mt-4 mb-2 border-b border-slate-800 pb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold text-indigo-400 mt-4 mb-2 border-b border-slate-800/80 pb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold text-slate-200 mt-3 mb-1.5">{children}</h3>,
                    p: ({ children }) => <p className="mb-2.5 leading-relaxed text-slate-300">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1 text-slate-300 pl-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1 text-slate-300 pl-2">{children}</ol>,
                    li: ({ children }) => <li className="text-slate-300 mb-0.5">{children}</li>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-indigo-500 pl-3 my-2 text-slate-400 italic bg-slate-900/60 py-1.5 rounded-r">{children}</blockquote>,
                    strong: ({ children }) => <strong className="font-bold text-slate-100">{children}</strong>,
                    code: ({ children }) => <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
                  }}
                >
                  {currentJob.finalSynthesis}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'DONE':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'WORKING':
      return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 animate-pulse';
    case 'ERROR':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    case 'OFFLINE':
      return 'bg-slate-800 text-slate-500 border-slate-700';
    default:
      return 'bg-slate-800 text-slate-400 border-slate-700';
  }
}
