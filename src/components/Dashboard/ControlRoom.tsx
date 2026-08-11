import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Bot,
  Activity,
  OctagonX,
  Paperclip,
  X,
  Image as ImageIcon,
  File as FileIcon,
  Loader2,
} from 'lucide-react';
import { AgentConfig, Attachment, Job, Task, Team, ActivityLog } from '../../types';
import {
  exportToTxt,
  exportToCsv,
  exportToDoc,
  exportToPdf,
} from '../../utils/exportHelpers';
import {
  processFile,
  formatFileSize,
  toAttachmentPayload,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
  MAX_TOTAL_SIZE_BYTES,
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_LABEL,
} from '../../utils/attachmentHelpers';

interface ControlRoomProps {
  team: Team;
  apiKeys?: string[];
  onOpenAgentModal: (agent: AgentConfig, task?: Task | null) => void;
  onAddLog: (log: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  logs?: ActivityLog[];
  onOpenLogs?: () => void;
}

export const ControlRoom: React.FC<ControlRoomProps> = ({
  team,
  apiKeys = [],
  onOpenAgentModal,
  onAddLog,
  logs = [],
  onOpenLogs,
}) => {
  const [instruction, setInstruction] = useState('');
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'synthesis' | 'agent_results'>('synthesis');
  const [selectedAgentResultId, setSelectedAgentResultId] = useState<string | null>(null);

  // Lampiran File (gambar, PDF, Word, Excel, CSV, TXT)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Load saved currentJob for active team from localStorage
  React.useEffect(() => {
    try {
      const savedJob = localStorage.getItem(`umkm_active_job_${team.id}`);
      if (savedJob) {
        const parsed = JSON.parse(savedJob);
        if (parsed.status === 'running') {
          parsed.status = 'error';
        }
        setCurrentJob(parsed);
      } else {
        setCurrentJob(null);
      }
    } catch (e) {
      console.error('Failed to load saved active job:', e);
      setCurrentJob(null);
    }
  }, [team.id]);

  // Persist currentJob to localStorage when updated
  React.useEffect(() => {
    if (!currentJob) {
      localStorage.removeItem(`umkm_active_job_${team.id}`);
      return;
    }
    try {
      localStorage.setItem(`umkm_active_job_${team.id}`, JSON.stringify(currentJob));
    } catch (e) {
      console.error('Failed to persist active job:', e);
    }
  }, [currentJob, team.id]);

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

  const abortControllerRef = useRef<AbortController | null>(null);
  const isStoppedRef = useRef<boolean>(false);

  // Stop the running job manually
  const handleStopJob = () => {
    if (!isExecuting) return;
    isStoppedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExecuting(false);
    if (currentJob) {
      setCurrentJob((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'error',
          tasks: prev.tasks.map((t) =>
            t.status === 'IDLE' || t.status === 'WORKING'
              ? { ...t, status: 'ERROR', errorMessage: 'Dibatalkan secara manual oleh pengguna' }
              : t
          ),
        };
      });
      onAddLog({
        jobId: currentJob.id,
        agentName: team.boss.name,
        eventType: 'TASK_ERROR',
        message: `Proses eksekusi dihentikan secara manual oleh pengguna.`,
      });
    }
  };

  const getRequestHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKeys && apiKeys.length > 0) {
      headers['x-gemini-api-key'] = apiKeys.join(',');
    } else {
      try {
        const saved = localStorage.getItem('umkm_gemini_api_keys');
        if (saved) {
          const keys = JSON.parse(saved);
          if (Array.isArray(keys) && keys.length > 0) {
            headers['x-gemini-api-key'] = keys.join(',');
          }
        }
      } catch (e) {
        // ignore
      }
    }
    return headers;
  };

  const parseErrorResponse = async (res: Response, fallback: string): Promise<string> => {
    try {
      const body = await res.json();
      if (body?.error) return body.error;
    } catch {
      // body bukan JSON atau kosong
    }
    return fallback;
  };

  // Run the multi-agent orchestration pipeline
  const handleRunJob = async (customInstruction?: string) => {
    const textToRun = customInstruction || instruction;
    if (!textToRun.trim() || isExecuting) return;

    // Ambil snapshot lampiran saat ini untuk dikirim ke backend, lalu bersihkan area input
    const attachmentsToSend = toAttachmentPayload(attachments);
    const attachmentSummaries = attachments.map((a) => ({ name: a.name, size: a.size }));

    setIsExecuting(true);
    setInstruction('');
    setAttachments([]);
    setAttachmentError(null);

    isStoppedRef.current = false;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

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
        headers: getRequestHeaders(),
        signal,
        body: JSON.stringify({
          teamName: team.name,
          businessContext: team.businessContext,
          boss: team.boss,
          activeMembers: activeMembers,
          instruction: textToRun,
          attachments: attachmentsToSend,
        }),
      });

      if (!planRes.ok) {
        const errMsg = await parseErrorResponse(planRes, 'Gagal menghubungi Boss AI untuk membuat rencana');
        throw new Error(errMsg);
      }

      const planData = await planRes.json();
      const plans = planData.plans || [];
      const planKeySuffix = planData.keyUsedSuffix ? ` [Key: ...${planData.keyUsedSuffix}]` : '';

      if (planData.attemptsLog && planData.attemptsLog.length > 1) {
        onAddLog({
          jobId,
          agentName: team.boss.name,
          eventType: 'PLAN_WARNING',
          message: `Rotasi Key Boss Planner: ${planData.attemptsLog.join(' → ')}`,
        });
      }

      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'PLANNING_COMPLETED',
        message: `${team.boss.name} berhasil membagi ${plans.length} sub-tugas dengan urutan ketergantungan.${planKeySuffix}`,
        tokens: planData.tokens,
      });

      // Soft warning dari sanity-check backend (non-blocking) — eksekusi tetap lanjut
      const planWarnings: Array<{ agentId: string; agentName: string; message: string }> =
        planData.warnings || [];
      planWarnings.forEach((w) => {
        onAddLog({
          jobId,
          agentName: w.agentName,
          eventType: 'PLAN_WARNING',
          message: w.message,
        });
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
        attachmentSummaries: attachmentSummaries.length > 0 ? attachmentSummaries : undefined,
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
            setCurrentJob((prev) => (prev ? { ...prev, tasks: [...runningTasks] } : null));
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
            if (!agentObj) {
              runningTasks = runningTasks.map((t) =>
                t.id === taskToRun.id
                  ? {
                      ...t,
                      status: 'ERROR',
                      errorMessage: `Agent ID "${taskToRun.agentId}" tidak ditemukan dalam tim.`,
                    }
                  : t
              );
              onAddLog({
                jobId,
                taskId: taskToRun.id,
                agentName: taskToRun.agentName || 'Unknown Agent',
                eventType: 'TASK_ERROR',
                message: `Sub-tugas dibatalkan: Agent ID "${taskToRun.agentId}" tidak ada dalam daftar tim.`,
              });
              setCurrentJob((prev) => (prev ? { ...prev, tasks: [...runningTasks] } : null));
              return;
            }

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
                  headers: getRequestHeaders(),
                  signal,
                  body: JSON.stringify({
                    agent: agentObj,
                    instruction: taskToRun.instruction,
                    businessContext: team.businessContext,
                    globalInstruction: textToRun,
                    previousResults: prevResults,
                    attachments: attachmentsToSend,
                  }),
                });

                if (!execRes.ok) {
                  const errMsg = await parseErrorResponse(
                    execRes,
                    `Execution error for agent ${agentObj.name} (HTTP ${execRes.status})`
                  );
                  const execErr: any = new Error(errMsg);
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

              const agentKeySuffix = execData.keyUsedSuffix ? ` [Key: ...${execData.keyUsedSuffix}]` : '';

              if (execData.attemptsLog && execData.attemptsLog.length > 1) {
                onAddLog({
                  jobId,
                  taskId: taskToRun.id,
                  agentName: agentObj.name,
                  eventType: 'TASK_RETRY',
                  message: `Rotasi Key Agent ${agentObj.name}: ${execData.attemptsLog.join(' → ')}`,
                });
              }

              onAddLog({
                jobId,
                taskId: taskToRun.id,
                agentName: agentObj.name,
                eventType: 'TASK_COMPLETED',
                message: `${agentObj.name} telah menyelesaikan sub-tugas dengan sukses.${agentKeySuffix}`,
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
        headers: getRequestHeaders(),
        signal,
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
        const errMsg = await parseErrorResponse(synthRes, 'Sintesis laporan akhir Boss gagal');
        throw new Error(errMsg);
      }

      const synthData = await synthRes.json();
      const synthKeySuffix = synthData.keyUsedSuffix ? ` [Key: ...${synthData.keyUsedSuffix}]` : '';

      if (synthData.attemptsLog && synthData.attemptsLog.length > 1) {
        onAddLog({
          jobId,
          agentName: team.boss.name,
          eventType: 'PLAN_WARNING',
          message: `Rotasi Key Boss Synthesis: ${synthData.attemptsLog.join(' → ')}`,
        });
      }

      onAddLog({
        jobId,
        agentName: team.boss.name,
        eventType: 'SYNTHESIS_COMPLETED',
        message: `${team.boss.name} selesai menyusun Laporan Akhir Super Strong!${synthKeySuffix}`,
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
        attachmentSummaries: newJob.attachmentSummaries,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || isStoppedRef.current) {
        onAddLog({
          jobId,
          agentName: team.boss.name,
          eventType: 'TASK_ERROR',
          message: `Proses alur kerja dihentikan secara manual oleh pengguna.`,
        });
      } else {
        console.error('Job execution failed:', err);
        onAddLog({
          jobId,
          agentName: team.boss.name,
          eventType: 'TASK_ERROR',
          message: `Gangguan alur kerja multi-agent: ${err.message}`,
        });
      }
    } finally {
      setIsExecuting(false);
      abortControllerRef.current = null;
    }
  };

  // Tambahkan file baru ke daftar lampiran (dipakai oleh input file & drag-and-drop)
  const addFiles = async (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    if (incoming.length === 0) return;

    setAttachmentError(null);

    const currentTotalSize = attachments.reduce((sum, a) => sum + a.size, 0);
    const incomingTotalSize = incoming.reduce((sum, f) => sum + f.size, 0);

    if (attachments.length + incoming.length > MAX_ATTACHMENTS) {
      setAttachmentError(`Maksimal ${MAX_ATTACHMENTS} file per instruksi. Hapus salah satu lampiran dulu.`);
      return;
    }

    if (currentTotalSize + incomingTotalSize > MAX_TOTAL_SIZE_BYTES) {
      setAttachmentError(
        `Total ukuran lampiran melebihi batas ${MAX_TOTAL_SIZE_BYTES / 1024 / 1024}MB. Kurangi jumlah/ukuran file.`
      );
      return;
    }

    setIsProcessingFiles(true);
    const newAttachments: Attachment[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      try {
        const processed = await processFile(file);
        newAttachments.push(processed);
      } catch (err: any) {
        errors.push(err.message || `Gagal memproses file "${file.name}"`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
    if (errors.length > 0) {
      setAttachmentError(errors.join(' '));
    }
    setIsProcessingFiles(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
    // reset agar file yang sama bisa dipilih ulang setelah dihapus
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setAttachmentError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isExecuting) setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (isExecuting) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const getAttachmentIcon = (att: Attachment) => {
    if (att.mimeType.startsWith('image/')) return <ImageIcon className="w-4 h-4 text-indigo-300" />;
    if (att.mimeType === 'application/pdf') return <FileText className="w-4 h-4 text-rose-300" />;
    if (att.mimeType.includes('spreadsheet') || att.mimeType.includes('excel') || att.mimeType === 'text/csv')
      return <FileSpreadsheet className="w-4 h-4 text-emerald-300" />;
    if (att.mimeType.includes('word')) return <FileText className="w-4 h-4 text-blue-300" />;
    return <FileIcon className="w-4 h-4 text-slate-300" />;
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
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#fe4c6f]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#fe4c6f] to-rose-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-[#fe4c6f]/20">
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
            <div className="w-8 h-8 rounded-lg bg-[#fe4c6f]/20 text-[#fe4c6f] flex items-center justify-center font-bold text-xs border border-[#fe4c6f]/30">
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
                  ? 'bg-rose-950/40 border-[#fe4c6f] ring-1 ring-[#fe4c6f] shadow-lg shadow-[#fe4c6f]/20'
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
                  <div className="h-full bg-[#fe4c6f] animate-pulse w-3/4 rounded-full" />
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                <span>Model: {member.model}</span>
                <span className="text-[#fe4c6f] flex items-center gap-1 font-semibold group-hover:underline">
                  <Eye className="w-3.5 h-3.5" /> Detail
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Box Grid: 3 Cols Instruction + 1 Col Real-Time Log */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Send Instruction to Boss AI (3 Columns) */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#fe4c6f]" />
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
                  className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-[#fe4c6f]/20 hover:border-[#fe4c6f]/50 border border-slate-700/80 text-slate-300 hover:text-[#fe4c6f] text-xs font-medium whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  {p.title}
                </button>
              ))}
            </div>

            {/* Input Text Area & Actions */}
            <div className="space-y-3">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl transition-all ${
                  isDraggingFile ? 'ring-2 ring-[#fe4c6f] ring-offset-2 ring-offset-slate-900' : ''
                }`}
              >
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ketik instruksi bisnis UMKM Anda di sini... (Contoh: Tolong buatkan strategi promosi produk sambal kemasan untuk bulan Ramadan, lengkap dengan riset harga kompetitor dan skrip penawaran WA)"
                  className="w-full bg-slate-950/80 border border-slate-700/90 rounded-2xl p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#fe4c6f] focus:ring-1 focus:ring-[#fe4c6f] resize-none"
                />
                {isDraggingFile && (
                  <div className="absolute inset-0 rounded-2xl bg-[#fe4c6f]/10 border-2 border-dashed border-[#fe4c6f] flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-bold text-[#fe4c6f] bg-slate-950/90 px-3 py-1.5 rounded-lg">
                      Lepaskan file di sini untuk melampirkan
                    </span>
                  </div>
                )}
              </div>

              {/* Attach File Button + Hidden Input */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_EXTENSIONS}
                  onChange={handleFileInputChange}
                  className="hidden"
                  disabled={isExecuting}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isExecuting || attachments.length >= MAX_ATTACHMENTS}
                  className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={`Lampirkan file: ${ACCEPTED_FILE_LABEL}`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  Lampirkan File
                </button>
                {isProcessingFiles && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memproses file...
                  </span>
                )}
                <span className="text-[10px] text-slate-500">
                  Maks {MAX_ATTACHMENTS} file, {MAX_FILE_SIZE_BYTES / 1024 / 1024}MB/file
                </span>
              </div>

              {/* Attachment Error */}
              {attachmentError && (
                <div className="flex items-start gap-2 text-[11px] text-rose-300 bg-rose-950/30 border border-rose-500/30 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{attachmentError}</span>
                </div>
              )}

              {/* Attached File Chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl pl-2 pr-1.5 py-1.5 max-w-[220px]"
                    >
                      {att.previewUrl ? (
                        <img
                          src={att.previewUrl}
                          alt={att.name}
                          className="w-6 h-6 rounded object-cover shrink-0"
                        />
                      ) : (
                        <span className="shrink-0">{getAttachmentIcon(att)}</span>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-200 truncate">{att.name}</p>
                        <p className="text-[9.5px] text-slate-500">{formatFileSize(att.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        disabled={isExecuting}
                        className="shrink-0 p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-rose-300 transition-colors disabled:opacity-40"
                        title="Hapus lampiran"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  {isExecuting ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-emerald-400 font-semibold">Tim AI sedang mengeksekusi tugas...</span>
                    </>
                  ) : (
                    <span>Ketik instruksi, lampirkan file jika perlu, atau pilih instruksi cepat di atas</span>
                  )}
                </span>

                <div className="flex items-center gap-2.5">
                  {/* Stop / Berhenti Button */}
                  <button
                    onClick={handleStopJob}
                    disabled={!isExecuting}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg ${
                      isExecuting
                        ? 'bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500/80 shadow-rose-600/30 active:scale-95 animate-pulse'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-40'
                    }`}
                    title={
                      isExecuting
                        ? 'Hentikan proses kerja AI sekarang'
                        : 'Tombol berhenti (aktif saat proses sedang berjalan)'
                    }
                  >
                    <OctagonX className="w-4 h-4 text-rose-200" />
                    <span>Berhenti</span>
                  </button>

                  {/* Jalankan Tim Button */}
                  <button
                    onClick={() => handleRunJob()}
                    disabled={!instruction.trim() || isExecuting || isProcessingFiles}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg ${
                      !instruction.trim() || isExecuting || isProcessingFiles
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-gradient-to-r from-[#fe4c6f] to-rose-600 hover:opacity-90 shadow-[#fe4c6f]/25 active:scale-95'
                    }`}
                  >
                    {isExecuting ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Memproses...
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
            </div>
          </div>
        </div>

        {/* Real-Time Log Panel (1 Column) */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#fe4c6f]" />
              <h3 className="text-xs font-bold text-slate-100">Log Real-Time</h3>
              <span
                className={`w-2 h-2 rounded-full ${
                  isExecuting ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
            </div>
            {onOpenLogs && (
              <button
                onClick={onOpenLogs}
                className="text-[11px] text-[#fe4c6f] hover:text-rose-400 font-medium hover:underline"
              >
                Lihat Semua
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[170px] my-2 space-y-2 pr-1 text-[11px]">
            {logs && logs.length > 0 ? (
              logs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-slate-200 truncate max-w-[110px]">
                      {log.agentName}
                    </span>
                    <span
                      className={`text-[8.5px] uppercase font-bold px-1.5 py-0.2 rounded border ${
                        log.eventType === 'PLAN_WARNING'
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                          : log.eventType === 'TASK_ERROR'
                          ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          : log.eventType === 'TASK_COMPLETED' || log.eventType === 'SYNTHESIS_COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {log.eventType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-slate-400 line-clamp-2 text-[10.5px] leading-snug">
                    {log.message}
                  </p>
                  <div className="text-[9px] text-slate-500 text-right font-mono">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full min-h-[120px] flex flex-col items-center justify-center text-center p-3 text-slate-500 space-y-1">
                <Clock className="w-5 h-5 text-slate-600 mb-1" />
                <p className="text-xs font-semibold text-slate-400">Belum Ada Aktivitas</p>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Log aktivitas orkestrasi tim AI akan muncul di sini secara real-time.
                </p>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
            <span>Aktivitas: {logs?.length || 0} event</span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isExecuting ? 'bg-indigo-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              {isExecuting ? 'Memproses...' : 'Standby'}
            </span>
          </div>
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
              {currentJob.attachmentSummaries && currentJob.attachmentSummaries.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                  <Paperclip className="w-3 h-3 text-slate-500" />
                  {currentJob.attachmentSummaries.length} file dilampirkan:{' '}
                  {currentJob.attachmentSummaries.map((a) => a.name).join(', ')}
                </p>
              )}
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
                  remarkPlugins={[remarkGfm]}
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
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 rounded-xl border border-slate-800 shadow-md">
                        <table className="w-full text-left text-xs border-collapse">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-slate-800/90 text-indigo-300 font-bold border-b border-slate-700/80">{children}</thead>,
                    tbody: ({ children }) => <tbody className="divide-y divide-slate-800/80 text-slate-300">{children}</tbody>,
                    tr: ({ children }) => <tr className="hover:bg-slate-800/40 transition-colors">{children}</tr>,
                    th: ({ children }) => <th className="px-3 py-2.5 font-bold">{children}</th>,
                    td: ({ children }) => <td className="px-3 py-2.5">{children}</td>,
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
