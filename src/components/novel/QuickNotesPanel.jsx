import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2, StickyNote } from "lucide-react";
import { debounce } from "lodash";

const STORAGE_KEY = (novelId) => `quick_notes_${novelId}`;

function loadNotes(novelId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(novelId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return [{ id: Date.now(), text: "" }];
}

function saveNotes(novelId, notes) {
  try {
    localStorage.setItem(STORAGE_KEY(novelId), JSON.stringify(notes));
  } catch {}
}

export default function QuickNotesPanel({ novelId, onClose }) {
  const [notes, setNotes] = useState(() => loadNotes(novelId));

  const persist = useCallback(
    debounce((updated) => saveNotes(novelId, updated), 600),
    [novelId]
  );

  const updateNote = (id, text) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, text } : n));
    setNotes(updated);
    persist(updated);
  };

  const addNote = () => {
    const updated = [...notes, { id: Date.now(), text: "" }];
    setNotes(updated);
    persist(updated);
  };

  const deleteNote = (id) => {
    const updated = notes.filter((n) => n.id !== id);
    const final = updated.length === 0 ? [{ id: Date.now(), text: "" }] : updated;
    setNotes(final);
    persist(final);
  };

  return (
    <div className="flex flex-col w-72 border-l border-border/60 bg-amber-50/40 h-full shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-amber-50/60">
        <div className="flex items-center gap-2">
          <StickyNote className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-sm font-semibold text-amber-900">บันทึกย่อ</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-700 hover:bg-amber-100" onClick={addNote} title="เพิ่มโน้ต">
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-amber-100" onClick={onClose} title="ปิด">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {notes.map((note, idx) => (
          <div key={note.id} className="group relative">
            <textarea
              autoFocus={idx === notes.length - 1 && note.text === ""}
              value={note.text}
              onChange={(e) => updateNote(note.id, e.target.value)}
              placeholder="จดไอเดีย เกร็ดประวัติศาสตร์ หรือสิ่งที่ต้องการระลึก..."
              rows={4}
              className="w-full rounded-lg border border-amber-200/60 bg-white/70 px-3 py-2.5 text-sm leading-relaxed resize-none outline-none focus:border-amber-400 focus:bg-white placeholder:text-muted-foreground/50 transition-colors"
              style={{ fontFamily: "'Sarabun', sans-serif" }}
            />
            <button
              onClick={() => deleteNote(note.id)}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/60 hover:text-destructive hover:bg-red-50"
              title="ลบโน้ต"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border/40">
        <p className="text-xs text-muted-foreground/50 text-center">บันทึกอัตโนมัติในเบราว์เซอร์</p>
      </div>
    </div>
  );
}