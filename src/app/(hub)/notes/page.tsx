"use client";

import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Note } from "@/types";
import { Plus, Search, FileText, Eye, Edit3, Trash2, X, Hash } from "lucide-react";
import { useLang } from "@/lib/lang-context";

function renderMarkdown(raw: string): string {
  if (!raw.trim()) return '<p style="color:#475569;font-style:italic">Start writing...</p>';

  function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function inline(s: string): string {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
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
        items.push(`<li>${inline(lines[i].slice(2))}</li>`);
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
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useLang();
  const nt = t.notes;

  const notes = useLiveQuery(() => db.notes.orderBy("updatedAt").reverse().toArray(), []);

  const filtered = (notes ?? []).filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.includes(q))
    );
  });

  function loadNote(note: Note) {
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags);
    setTagInput("");
    setMode("edit");
  }

  async function newNote() {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.notes.add({ id, title: "Untitled", content: "", tags: [], createdAt: now, updatedAt: now });
    loadNote({ id, title: "Untitled", content: "", tags: [], createdAt: now, updatedAt: now });
  }

  // Auto-save on change
  useEffect(() => {
    if (!selectedId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      db.notes.update(selectedId, { title: title || "Untitled", content, tags, updatedAt: Date.now() });
    }, 600);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [title, content, tags, selectedId]);

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
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{nt.panel}</span>
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
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-700 text-xs">
                {search ? nt.noResults : nt.empty}
              </p>
              {!search && (
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
              </div>
              {note.content && (
                <p className="text-xs text-slate-600 mt-0.5 truncate leading-relaxed">
                  {note.content.replace(/^#+\s/gm, "").substring(0, 55)}
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
            <button
              onClick={deleteNote}
              className="p-1.5 rounded-md text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Title */}
          <div className="px-8 pt-7 pb-1 flex-shrink-0">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={nt.untitled}
              className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-slate-700 outline-none"
            />
          </div>

          {/* Tags */}
          <div className="px-8 pb-3 flex items-center gap-1.5 flex-wrap flex-shrink-0 min-h-[28px]">
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

          <div className="border-t border-white/5 flex-1 overflow-auto">
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
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
              />
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
