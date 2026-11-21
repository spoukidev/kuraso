import { useEffect, useMemo, useRef, useState } from "react";

export interface PaletteCommand {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div className="kuraso-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="kuraso-palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSelectedIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSelectedIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const cmd = filtered[selectedIdx];
              if (cmd) {
                cmd.run();
                onClose();
              }
            }
          }}
        />
        <div className="kuraso-palette-list">
          {filtered.length === 0 && (
            <div style={{ padding: 16, fontSize: "0.85rem", color: "var(--kuraso-text-muted)" }}>
              No matching commands
            </div>
          )}
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              type="button"
              className="kuraso-palette-item"
              data-selected={idx === selectedIdx ? "true" : "false"}
              onMouseEnter={() => setSelectedIdx(idx)}
              onClick={() => {
                cmd.run();
                onClose();
              }}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && <kbd className="kuraso-kbd">{cmd.shortcut}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
