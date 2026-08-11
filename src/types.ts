export type AgentRole = 
  | 'boss'
  | 'marketing'
  | 'sales'
  | 'research'
  | 'content'
  | 'seo'
  | 'social'
  | 'finance'
  | 'developer'
  | 'cs'
  | 'legal'
  | 'tax'
  | 'ads'
  | 'ecommerce'
  | 'hr'
  | 'admin';

export type AgentStatus = 'IDLE' | 'WORKING' | 'DONE' | 'ERROR' | 'OFFLINE';

// 'inline'  -> gambar & PDF, dikirim sebagai base64 langsung ke Gemini (dibaca native, termasuk isi visualnya)
// 'text'    -> Word/Excel/CSV/TXT, isinya sudah diekstrak jadi teks polos di browser sebelum dikirim
export type AttachmentKind = 'inline' | 'text';

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  data?: string; // base64 (tanpa prefix data:...;base64,) — hanya untuk kind 'inline'
  textContent?: string; // hasil ekstraksi teks — hanya untuk kind 'text'
  previewUrl?: string; // data URL untuk thumbnail gambar di UI (tidak dikirim ke server)
}

export interface AgentConfig {
  id: string;
  type: 'boss' | 'member';
  name: string;
  role: AgentRole;
  roleTitle: string;
  avatar: string;
  color: string;
  systemPrompt: string;
  model: string;
  active: boolean;
}

export interface BossPreset {
  id: string;
  name: string;
  title: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  businessContext?: string;
  boss: AgentConfig;
  members: AgentConfig[];
  createdAt: string;
}

export interface TaskPlan {
  agentId: string;
  agentName: string;
  role: AgentRole;
  instruction: string;
  dependsOn: string[]; // Agent IDs or task indices that must finish first
  reasoning?: string;
}

export interface Task {
  id: string;
  jobId: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  instruction: string;
  dependsOn: string[];
  status: AgentStatus;
  result: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  inputTokens: number;
  outputTokens: number;
  startedAt?: string;
  completedAt?: string;
}

export type JobStatus = 'pending' | 'running' | 'done' | 'error' | 'partial';

export interface Job {
  id: string;
  teamId: string;
  instruction: string;
  status: JobStatus;
  tasks: Task[];
  finalSynthesis: string | null;
  createdAt: string;
  completedAt?: string;
  // Hanya menyimpan metadata ringan (nama & ukuran) untuk ditampilkan di riwayat,
  // BUKAN data base64/teks lengkap — supaya localStorage tidak membengkak.
  attachmentSummaries?: { name: string; size: number }[];
}

export interface ActivityLog {
  id: string;
  jobId: string;
  taskId?: string;
  agentName: string;
  eventType: 
    | 'JOB_CREATED'
    | 'PLANNING_STARTED'
    | 'PLANNING_COMPLETED'
    | 'PLAN_WARNING'
    | 'TASK_STARTED'
    | 'TASK_COMPLETED'
    | 'TASK_RETRY'
    | 'TASK_ERROR'
    | 'TASK_BLOCKED'
    | 'SYNTHESIS_STARTED'
    | 'SYNTHESIS_COMPLETED';
  message: string;
  tokens?: { inputTokens: number; outputTokens: number };
  timestamp: string;
}
