"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getAllProjects, addProject, updateProject, db } from "@/lib/db";
import type { Project } from "@/types";
import { Plus, FolderKanban, Trash2, X, Zap, FileText, AlignLeft } from "lucide-react";
import { useLang } from "@/lib/lang-context";

const PROJECT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#f97316", "#ec4899"];

const STATUS_DOTS: Record<Project["status"], string> = {
  active: "bg-green-400",
  completed: "bg-blue-400",
  archived: "bg-slate-500",
};

const AI_LABELS: Record<string, { name: string; color: string }> = {
  ce:   { name: "Claude",  color: "text-violet-400" },
  mx:   { name: "MiniMax", color: "text-blue-400" },
  user: { name: "User",    color: "text-slate-400" },
};

interface ActivityEntry { id: string; aiId: string; projectId: string | null; action: string; details: string; timestamp: number }
interface NoteEntry     { id: string; title: string; tags: string[]; date: string; preview: string; contentLength: number }

type Tab = "overview" | "activities" | "notes";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0]);
  const [editDesc, setEditDesc] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabCounts, setTabCounts] = useState<{ notes: number | null; activities: number | null }>({ notes: null, activities: null });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = projects.find((p) => p.id === selectedId) ?? null;
  const { t } = useLang();
  const pt = t.projects;

  const STATUS_OPTIONS: { value: Project["status"]; label: string; dot: string }[] = [
    { value: "active",    label: pt.active,    dot: STATUS_DOTS.active },
    { value: "completed", label: pt.completed, dot: STATUS_DOTS.completed },
    { value: "archived",  label: pt.archived,  dot: STATUS_DOTS.archived },
  ];

  function load() { getAllProjects().then(setProjects); }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selected) {
      setEditDesc(selected.description);
      setTab("overview");
      setTabCounts({ notes: null, activities: null });
      const id = selected.id;
      Promise.all([
        fetch(`/api/notes?projectId=${encodeURIComponent(id)}`).then((r) => r.ok ? r.json() : null),
        fetch("/api/activities").then((r) => r.ok ? r.json() : null),
      ]).then(([notesData, actsData]) => {
        setTabCounts({
          notes: notesData ? notesData.notes.length : null,
          activities: actsData ? actsData.activities.filter((a: ActivityEntry) => a.projectId === id).length : null,
        });
      });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { updateProject(selectedId, { description: editDesc }); }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [editDesc, selectedId]);

  const loadTab = useCallback(async (t: Tab, id: string) => {
    if (t === "overview") return;
    setTabLoading(true);
    try {
      if (t === "activities") {
        const res = await fetch("/api/activities");
        if (res.ok) {
          const data = await res.json() as { activities: ActivityEntry[] };
          setActivities(data.activities.filter((a) => a.projectId === id).reverse());
        }
      }
      if (t === "notes") {
        const res = await fetch(`/api/notes?projectId=${encodeURIComponent(id)}`);
        if (res.ok) {
          const data = await res.json() as { notes: NoteEntry[] };
          setNotes(data.notes);
        }
      }
    } finally {
      setTabLoading(false);
    }
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    if (selectedId) loadTab(t, selectedId);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const id = await addProject({ title: newTitle.trim(), description: newDesc.trim(), status: "active", color: newColor });
    setNewTitle(""); setNewDesc(""); setNewColor(PROJECT_COLORS[0]); setShowAdd(false);
    load();
    setTimeout(() => setSelectedId(id), 80);
  }

  async function handleDelete(id: string) {
    await db.projects.delete(id);
    if (selectedId === id) setSelectedId(null);
    load();
  }

  async function handleStatusChange(id: string, status: Project["status"]) {
    await updateProject(id, { status });
    load();
  }

  function fmtDate(ts: number) {
    return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }
  function fmtTime(ts: number) {
    return new Date(ts).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="h-full flex overflow-hidden">
      {/* Projects list */}
      <aside className="w-60 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {pt.panel} <span className="text-slate-700 normal-case">({pt.activeCount(activeCount)})</span>
          </span>
          <button onClick={() => setShowAdd(true)}
            className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {projects.length === 0 && (
            <div className="text-center py-10">
              <FolderKanban className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-700 text-xs">{pt.empty}</p>
            </div>
          )}
          {projects.map((project) => {
            const statusOpt = STATUS_OPTIONS.find((s) => s.value === project.status);
            return (
              <button key={project.id} onClick={() => setSelectedId(project.id)}
                className={`w-full text-left px-3 py-2.5 transition-colors border-r-2 ${selectedId === project.id ? "bg-white/8 border-opacity-80" : "border-transparent hover:bg-white/5"}`}
                style={selectedId === project.id ? { borderRightColor: project.color } : {}}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                  <p className={`text-sm font-medium truncate ${selectedId === project.id ? "text-white" : "text-slate-300"}`}>{project.title}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 pl-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${statusOpt?.dot}`} />
                  <span className="text-xs text-slate-600">{statusOpt?.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Project detail */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <div className="border-b border-white/10 px-8 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker((v) => !v)}
                  className="w-3 h-3 rounded-full flex-shrink-0 hover:ring-2 hover:ring-white/40 hover:ring-offset-1 hover:ring-offset-transparent transition-all"
                  style={{ backgroundColor: selected.color }}
                  title="變更顏色"
                />
                {showColorPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute top-5 left-0 z-20 bg-slate-800 border border-white/15 rounded-xl p-3 shadow-2xl flex gap-2 flex-wrap w-48">
                    {PROJECT_COLORS.map((c) => (
                      <button key={c} type="button"
                        onClick={() => { updateProject(selected.id, { color: c }).then(load); setShowColorPicker(false); }}
                        className={`w-6 h-6 rounded-full transition-all ${selected.color === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110" : "hover:scale-110"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  </>
                )}
              </div>
              <input defaultValue={selected.title} key={selected.id + "_title"}
                onBlur={(e) => updateProject(selected.id, { title: e.target.value }).then(load)}
                className="bg-transparent text-xl font-bold text-white outline-none hover:bg-white/5 focus:bg-white/5 rounded px-1 -ml-1 transition-colors" />
            </div>
            <button onClick={() => handleDelete(selected.id)}
              className="p-1.5 rounded-md text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Meta + Status */}
          <div className="px-8 py-3 border-b border-white/5 flex items-center gap-6 flex-shrink-0">
            <div>
              <p className="text-xs text-slate-600 mb-1.5">{pt.status}</p>
              <div className="flex items-center gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => handleStatusChange(selected.id, opt.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${selected.status === opt.value ? "bg-white/10 text-white border-white/20" : "text-slate-500 border-white/10 hover:border-white/20 hover:text-slate-300"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">{pt.created}</p>
              <p className="text-xs text-slate-400">{fmtDate(selected.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1">{pt.updated}</p>
              <p className="text-xs text-slate-400">{fmtDate(selected.updatedAt)}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-8 border-b border-white/8 flex gap-0 flex-shrink-0">
            {([["overview", AlignLeft, "概覽", null], ["activities", Zap, "活動", tabCounts.activities], ["notes", FileText, "筆記", tabCounts.notes]] as const).map(([id, Icon, label, count]) => (
              <button key={id} onClick={() => switchTab(id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === id ? "border-violet-500 text-violet-300" : "border-transparent text-slate-600 hover:text-slate-400"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
                {count !== null && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tab === id ? "bg-violet-500/20 text-violet-300" : "bg-white/8 text-slate-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto">
            {tab === "overview" && (
              <div className="px-8 py-5 h-full flex flex-col">
                <p className="text-xs text-slate-600 uppercase tracking-wider mb-2">{pt.notesLabel}</p>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                  placeholder={pt.notesPlaceholder}
                  className="flex-1 min-h-[300px] bg-white/3 border border-white/8 rounded-xl px-5 py-4 text-slate-300 placeholder:text-slate-700 text-sm leading-7 outline-none resize-none font-mono focus:border-white/15 transition-colors" />
              </div>
            )}

            {tab === "activities" && (
              <div className="px-8 py-5 space-y-2">
                {tabLoading && <p className="text-slate-600 text-sm">載入中...</p>}
                {!tabLoading && activities.length === 0 && (
                  <p className="text-slate-600 text-sm py-8 text-center">暫無活動記錄</p>
                )}
                {activities.map((a) => {
                  const label = AI_LABELS[a.aiId] ?? { name: a.aiId, color: "text-slate-400" };
                  return (
                    <div key={a.id} className="rounded-lg border border-white/8 bg-white/3 px-4 py-3">
                      <p className="text-sm text-slate-200">{a.action}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                        <span>{fmtTime(a.timestamp)}</span>
                        {a.aiId !== "user" && <span className={label.color}>· {label.name}</span>}
                        {a.details && a.details !== "conversation-log.md" && (
                          <span className="text-slate-700">· {a.details}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "notes" && (
              <div className="px-8 py-5 space-y-2">
                {tabLoading && <p className="text-slate-600 text-sm">載入中...</p>}
                {!tabLoading && notes.length === 0 && (
                  <p className="text-slate-600 text-sm py-8 text-center">暫無筆記</p>
                )}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-white/8 bg-white/3 px-4 py-3">
                    <p className="text-sm text-white font-medium">{n.title}</p>
                    {n.preview && <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">{n.preview}</p>}
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-700">
                      <span>{n.date}</span>
                      <span>·</span>
                      <span>{n.contentLength >= 1000 ? `${Math.round(n.contentLength / 1000)}k chars` : `${n.contentLength} chars`}</span>
                      {n.tags.map((tag) => (
                        <span key={tag} className="bg-white/6 px-1.5 py-0.5 rounded text-slate-600">#{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FolderKanban className="w-16 h-16 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-600 text-sm">{pt.emptyState}</p>
            <button onClick={() => setShowAdd(true)}
              className="mt-4 h-9 px-4 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 text-sm border border-emerald-500/25 transition-colors inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> {pt.newProjectBtn}
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-800/95 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">{pt.newProject}</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">{pt.projectName}</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Project name" required autoFocus
                  className="w-full h-10 rounded-lg bg-white/8 border border-white/15 text-white placeholder:text-slate-600 px-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">{pt.description}</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this project about?"
                  className="w-full h-10 rounded-lg bg-white/8 border border-white/15 text-white placeholder:text-slate-600 px-3 text-sm outline-none focus:border-emerald-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium mb-1.5 block">顏色</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full transition-all ${newColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110" : "hover:scale-110"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button type="submit"
                className="w-full h-10 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:opacity-90 text-white text-sm font-medium transition-opacity">
                {pt.create}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
