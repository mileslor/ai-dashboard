"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Note, Project } from "@/types";
import { Plus, Search, FileText, Eye, Edit3, Trash2, X, Hash, Link, FolderKanban, ChevronDown } from "lucide-react";
import { useLang } from "@/lib/lang-context";

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[(.+?)\]\]/g, "$1")
    .replace(/^[-*>\s]+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

function renderMarkdown(raw: string, noteTitles?: Set<string>): string {
  if (!raw.trim()) return '<p style="color:#475569;font-style:italic">Start writing...</p>';

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s: string): string {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[\[(.+?)\]\]/g, (_, title) => {
        const exists = !noteTitles || noteTitles.has(title.toLowerCase());
        return `<span class="wikilink${exists ? "" : " broken"}" data-title="${title}">${title}</span>`;
      });
  }

  // Split into lines and handle code blocks first
  const lines = raw.split("\n");
  const parts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    // Code block: ```...```
    if (lines[i].startsWith("```")) {
      const lang = lines[i].slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      i++; // skip closing ```
      parts.push(`<pre class="code-block"><code${lang ? ` class="language-${esc(lang)}"` : ""}>${codeLines.join("\n")}</code></pre>`);
      continue;
    }

    if (lines[i].startsWith("# ")) {
      parts.push(`<h1>${inline(lines[i].slice(2))}</h1>`);
    } else if (lines[i].startsWith("## ")) {
      parts.push(`<h2>${inline(lines[i].slice(3))}</h2>`);
    } else if (lines[i].startsWith("### ")) {
      parts.push(`<h3>${inline(lines[i].slice(4))}</h3>`);
    } else if (lines[i].startsWith("> ")) {
      parts.push(`<blockquote>${inline(lines[i].slice(2))}</blockquote>`);
    } else if (lines[i] === "---") {
      parts.push("<hr />");
    } else if (/^[-*] /.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        const text = lines[i].slice(2);
        const taskMatch = text.match(/^\[([ xX])\] (.*)/);
        if (taskMatch) {
          const checked = taskMatch[1].toLowerCase() === "x";
          items.push(`<li class="task-item${checked ? " task-checked" : ""}"><span class="task-box">${checked ? "✓" : ""}</span>${inline(taskMatch[2])}</li>`);
        } else {
          items.push(`<li>${inline(text)}</li>`);
        }
        i++;
      }
      parts.push(`<ul>${items.join("")}</ul>`);
      continue;
    } else if (/^\d+\. /.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\. /, ""))}</li>`);
        i++;
      }
      parts.push(`<ol>${items.join("")}</ol>`);
      continue;
    } else if (lines[i].trim() === "") {
      // skip empty lines (paragraphs handled below)
    } else {
      parts.push(`<p>${inline(lines[i])}</p>`);
    }
    i++;
  }

  return parts.join("");
}

export default function NotesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>(""); // "" = all
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const { t } = useLang();
  const nt = t.notes;

  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().toArray(), []);
  const projects = useLiveQuery(() => db.projects.orderBy("title").toArray(), []) as Project[] | undefined;

  const noteTitles = useMemo(() => {
    const s = new Set<string>();
    (notes ?? []).forEach((n) => s.add(n.title.toLowerCase()));
    return s;
  }, [notes]);

  const wordCount = useMemo(() => {
    const text = content.trim();
    if (!text) return { words: 0, chars: 0 };
    return { words: text.split(/\s+/).length, chars: text.length };
  }, [content]);

  const backlinks = useMemo(() => {
    if (!selectedId || !notes) return [] as Note[];
    const currentNote = notes.find((n) => n.id === selectedId);
    if (!currentNote) return [] as Note[];
    const pattern = `[[${currentNote.title}]]`;
    return notes.filter((n) => n.id !== selectedId && n.content.includes(pattern));
  }, [selectedId, notes]);

  const backlinksMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!notes) return map;
    notes.forEach((note) => {
      const matches = note.content.match(/\[\[(.+?)\]\]/g) ?? [];
      matches.forEach((m) => {
        const title = m.slice(2, -2).toLowerCase();
        const target = notes.find((n) => n.id !== note.id && n.title.toLowerCase() === title);
        if (target) map.set(target.id, (map.get(target.id) ?? 0) + 1);
      });
    });
    return map;
  }, [notes]);

  const projectMap = useMemo(() => {
    const m = new Map<string, Project>();
    (projects ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  function handlePreviewClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.classList.contains("wikilink") && !target.classList.contains("broken")) {
      const linkTitle = target.dataset.title;
      if (linkTitle && notes) {
        const linked = notes.find((n) => n.title.toLowerCase() === linkTitle.toLowerCase());
        if (linked) loadNote(linked, true);
      }
    }
  }

  const filtered = (notes ?? []).filter((n) => {
    if (filterProject && n.projectId !== filterProject) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.includes(q))
    );
  });

  function loadNote(note: Note, preserveMode = false) {
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags);
    setProjectId(note.projectId ?? null);
    setTagInput("");
    if (!preserveMode) setMode("edit");
  }

  async function newNote() {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.notes.add({ id, title: "Untitled", content: "", tags: [], createdAt: now, updatedAt: now });
    loadNote({ id, title: "Untitled", content: "", tags: [], createdAt: now, updatedAt: now });
    setTimeout(() => { titleInputRef.current?.select(); titleInputRef.current?.focus(); }, 50);
  }

  // Cmd+N: new note
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        newNote();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-save on change
  useEffect(() => {
    if (!selectedId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      db.notes.update(selectedId, { title: title || "Untitled", content, tags, projectId: projectId ?? undefined, updatedAt: Date.now() });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 800);
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, content, tags, projectId, selectedId]);

  function addTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      const tag = tagInput.trim().replace(/^#/, "");
      if (tag && !tags.includes(tag)) setTags([...tags, tag]);
      setTagInput("");
    }
  }

  async function deleteNote() {
    if (!selectedId) return;
    await db.notes.delete(selectedId);
    setSelectedId(null);
    setTitle(""); setContent(""); setTags([]);
  }

  function fmtDate(ts: number) {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Notes list */}
      <aside className="w-60 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/20">
        <div className="p-3 border-b border-white/10 flex flex-col gap-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{nt.panel}</span>
              {search && filtered.length > 0 && (
                <span className="text-xs text-blue-400/70 bg-blue-500/10 rounded-full px-1.5 py-0.5 leading-none">{filtered.length}</span>
              )}
              {!search && (notes?.length ?? 0) > 0 && (
                <span className="text-xs text-slate-600 tabular-nums">{notes?.length}</span>
              )}
            </div>
            <button
              onClick={newNote}
              className="w-6 h-6 rounded-md hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title={nt.newNote}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={nt.search}
              className="w-full h-7 pl-7 pr-3 rounded-md bg-white/5 border border-white/10 text-slate-300 placeholder:text-slate-700 text-xs outline-none focus:border-blue-500/40 transition-colors"
            />
          </div>
          {(projects ?? []).filter((p) => p.status === "active").length > 0 && (
            <div className="relative">
              <FolderKanban className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600 pointer-events-none" />
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full h-7 pl-7 pr-6 rounded-md bg-white/5 border border-white/10 text-xs outline-none appearance-none transition-colors cursor-pointer"
                style={{ color: filterProject ? "#94a3b8" : "#475569" }}
              >
                <option value="" style={{ background: "#1e293b" }}>所有項目</option>
                {(projects ?? []).filter((p) => p.status === "active").map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#1e293b" }}>{p.title}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-600 pointer-events-none" />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-700 text-xs">
                {search || filterProject ? nt.noResults : nt.empty}
              </p>
              {!search && !filterProject && (
                <button onClick={newNote} className="mt-2 text-xs text-blue-500/60 hover:text-blue-400 transition-colors">
                  {nt.createOne}
                </button>
              )}
            </div>
          )}
          {filtered.map((note) => (
            <button
              key={note.id}
              onClick={() => loadNote(note)}
              className={`w-full text-left px-3 py-2.5 transition-colors border-r-2 ${
                selectedId === note.id
                  ? "bg-blue-500/10 border-blue-500/60"
                  : "border-transparent hover:bg-white/5"
              }`}
            >
              <p className={`text-sm font-medium truncate ${selectedId === note.id ? "text-blue-300" : "text-slate-300"}`}>
                {note.title || nt.untitled}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs text-slate-600">{fmtDate(note.updatedAt)}</span>
                {note.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs text-blue-500/60">#{tag}</span>
                ))}
                {(backlinksMap.get(note.id) ?? 0) > 0 && (
                  <span className="text-xs text-indigo-400/70">🔗{backlinksMap.get(note.id)}</span>
                )}
                {note.projectId && projectMap.has(note.projectId) && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-slate-600 flex-shrink-0 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectMap.get(note.projectId)!.color }} />
                    <span className="truncate max-w-[64px]">{projectMap.get(note.projectId)!.title}</span>
                  </span>
                )}
              </div>
              {note.content && (
                <p className="text-xs text-slate-600 mt-0.5 truncate leading-relaxed">
                  {stripMarkdown(note.content).substring(0, 60)}
                </p>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* Editor / Empty state */}
      {selectedId ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="border-b border-white/10 px-5 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setMode("edit")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  mode === "edit" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Edit3 className="w-3 h-3" /> {nt.edit}
              </button>
              <button
                onClick={() => setMode("preview")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  mode === "preview" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Eye className="w-3 h-3" /> {nt.preview}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {savedFlash && (
                <span className="text-xs text-emerald-500/70 transition-opacity">已儲存</span>
              )}
              {content.trim() && (
                <span className="text-xs text-slate-700 tabular-nums">
                  {wordCount.words}w · {wordCount.chars}c
                </span>
              )}
              <button
                onClick={deleteNote}
                className="p-1.5 rounded-md text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="px-8 pt-7 pb-1 flex-shrink-0">
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={nt.untitled}
              className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-slate-700 outline-none"
            />
          </div>

          {/* Tags */}
          <div className="px-8 pb-2 flex items-center gap-1.5 flex-wrap flex-shrink-0 min-h-[28px]">
            <Hash className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTags(tags.filter((tg) => tg !== tag))}
                className="flex items-center gap-1 text-xs text-blue-400/70 hover:text-red-400 bg-blue-500/10 hover:bg-red-500/10 rounded-full px-2 py-0.5 transition-colors"
              >
                #{tag} <X className="w-2.5 h-2.5" />
              </button>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
              placeholder={tags.length === 0 ? nt.addTag : "+"}
              className="bg-transparent text-xs text-slate-600 placeholder:text-slate-700 outline-none w-28"
            />
          </div>

          {/* Project link */}
          <div className="px-8 pb-3 flex items-center gap-2 flex-shrink-0">
            <FolderKanban className={`w-3.5 h-3.5 flex-shrink-0 ${projectId ? "text-slate-500" : "text-slate-700"}`} />
            <div className="relative flex items-center">
              <select
                value={projectId ?? ""}
                onChange={(e) => setProjectId(e.target.value || null)}
                className={`bg-transparent text-xs outline-none cursor-pointer pr-4 transition-colors ${projectId ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-400"}`}
                style={{ appearance: "none" }}
              >
                <option value="" style={{ background: "#1e293b" }}>無項目</option>
                {(projects ?? []).filter((p) => p.status === "active").map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "#1e293b" }}>{p.title}</option>
                ))}
              </select>
              <ChevronDown className="w-2.5 h-2.5 text-slate-600 absolute right-0 pointer-events-none" />
            </div>
            {projectId && (
              <button
                onClick={() => setProjectId(null)}
                className="text-slate-700 hover:text-slate-500 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          <div className="border-t border-white/5 flex-1 overflow-auto flex flex-col">
            <div className="flex-1">
              {mode === "edit" ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={nt.placeholder}
                  className="w-full h-full px-8 py-5 bg-transparent text-slate-300 placeholder:text-slate-700 text-sm leading-7 outline-none resize-none font-mono"
                />
              ) : (
                <div
                  className="md-preview px-8 py-5"
                  onClick={handlePreviewClick}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content, noteTitles) }}
                />
              )}
            </div>

            {/* Backlinks panel */}
            {backlinks.length > 0 && (
              <div className="border-t border-white/5 px-8 py-4 flex-shrink-0">
                <div className="flex items-center gap-1.5 mb-2">
                  <Link className="w-3 h-3 text-slate-600" />
                  <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">Backlinks</span>
                  <span className="text-xs text-slate-700">({backlinks.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {backlinks.map((bl) => (
                    <button
                      key={bl.id}
                      onClick={() => loadNote(bl)}
                      className="text-xs text-indigo-400/70 bg-indigo-500/10 hover:bg-indigo-500/20 hover:text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-0.5 transition-colors"
                    >
                      {bl.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="w-16 h-16 text-slate-800 mx-auto mb-4" />
            <p className="text-slate-600 text-sm">{nt.emptyState}</p>
            <button
              onClick={newNote}
              className="mt-4 h-9 px-4 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 text-sm border border-blue-500/25 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {nt.newNote}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
