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
  | 'cs';

export type AgentStatus = 'IDLE' | 'WORKING' | 'DONE' | 'ERROR' | 'OFFLINE';

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
