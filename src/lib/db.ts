import Dexie, { type EntityTable } from "dexie";
import type { AI, Project, Activity, AIMessage, SyncQueueItem, Note } from "@/types";

interface TokenSnapshot {
  id?: number;
  provider: "minimax" | "claude";
  tokens_used: number;
  context_used: number;
  timestamp: number;
}

const db = new Dexie("AIDashboardDB") as Dexie & {
  ais: EntityTable<AI, "id">;
  projects: EntityTable<Project, "id">;
  activities: EntityTable<Activity, "id">;
  messages: EntityTable<AIMessage, "id">;
  syncQueue: EntityTable<SyncQueueItem, "id">;
  notes: EntityTable<Note, "id">;
  tokenHistory: EntityTable<TokenSnapshot, "id">;
};

db.version(1).stores({
  ais: "id, name, status",
  projects: "id, status, createdAt",
  activities: "id, aiId, projectId, timestamp",
  messages: "id, sender, timestamp, channelId",
  syncQueue: "id, type, status, createdAt",
});

db.version(2).stores({
  ais: "id, name, status",
  projects: "id, status, createdAt",
  activities: "id, aiId, projectId, timestamp",
  messages: "id, sender, timestamp, channelId",
  syncQueue: "id, type, status, createdAt",
  notes: "id, title, projectId, updatedAt, createdAt",
});

db.version(3).stores({
  ais: "id, name, status",
  projects: "id, status, createdAt",
  activities: "id, aiId, projectId, timestamp",
  messages: "id, sender, timestamp, channelId",
  syncQueue: "id, type, status, createdAt",
  notes: "id, title, projectId, updatedAt, createdAt",
  tokenHistory: "++id, provider, timestamp",
});

export { db };

// Helper functions
export async function addActivity(activity: Omit<Activity, "id" | "timestamp">) {
  const id = crypto.randomUUID();
  const timestamp = Date.now();
  await db.activities.add({ ...activity, id, timestamp });
  await queueSync("activity", { ...activity, id, timestamp });
  return id;
}

export async function addProject(project: Omit<Project, "id" | "createdAt" | "updatedAt">) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.projects.add({ ...project, id, createdAt: now, updatedAt: now });
  await queueSync("project", { ...project, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateProject(id: string, updates: Partial<Project>) {
  await db.projects.update(id, { ...updates, updatedAt: Date.now() });
}

export async function addAI(ai: Omit<AI, "id" | "createdAt">) {
  const id = crypto.randomUUID();
  await db.ais.add({ ...ai, id, createdAt: Date.now() });
  await queueSync("ai", { ...ai, id, createdAt: Date.now() });
  return id;
}

export async function addMessage(message: Omit<AIMessage, "id" | "timestamp">) {
  const id = crypto.randomUUID();
  await db.messages.add({ ...message, id, timestamp: Date.now() });
  return id;
}

export async function queueSync(type: SyncQueueItem["type"], data: any) {
  const id = crypto.randomUUID();
  await db.syncQueue.add({
    id,
    type,
    data,
    status: "pending",
    createdAt: Date.now(),
  });
}

export async function getPendingSyncs() {
  return db.syncQueue.where("status").equals("pending").toArray();
}

export async function markSynced(id: string) {
  await db.syncQueue.update(id, { status: "synced" });
}

export async function getRecentActivities(limit = 50) {
  return db.activities.orderBy("timestamp").reverse().limit(limit).toArray();
}

export async function getAllProjects() {
  return db.projects.toArray();
}

export async function getAllAIs() {
  return db.ais.toArray();
}

export async function addNote(note: Omit<Note, "id" | "createdAt" | "updatedAt">) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.notes.add({ ...note, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateNote(id: string, updates: Partial<Note>) {
  await db.notes.update(id, { ...updates, updatedAt: Date.now() });
}

export async function getAllNotes() {
  return db.notes.orderBy("updatedAt").reverse().toArray();
}
