export interface AI {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar?: string;
  emoji?: string;
  status: 'active' | 'idle' | 'busy';
  createdAt: number;
  // Extended profile fields
  provider?: 'claude' | 'minimax' | 'other';
  model?: string;
  description?: string;
  contextMax?: number;
  capabilities?: string[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface Activity {
  id: string;
  aiId: string;
  projectId?: string;
  action: string;
  details: string;
  timestamp: number;
}

export interface AIMessage {
  id: string;
  sender: 'user' | 'mx' | 'ce' | string;
  content: string;
  timestamp: number;
  channelId?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  projectId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'activity' | 'project' | 'ai';
  data: any;
  status: 'pending' | 'synced' | 'failed';
  createdAt: number;
}
