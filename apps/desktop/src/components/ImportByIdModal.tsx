import { useState } from "react";
import {
  detectIdentifiers,
  fetchMetadataByArxiv,
  fetchMetadataByDoi,
  type FetchedMetadata,
} from "@kuraso/importers";
import { X } from "lucide-react";

interface ImportByIdModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (meta: FetchedMetadata) => void;
}

export function ImportByIdModal({ open, onClose, onImported }: ImportByIdModalProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleLookup() {
    setError(null);
    const detected = detectIdentifiers(input);
    if (!detected.doi && !detected.arxivId) {
      setError("Could not recognize a DOI (e.g. 10.1109/...) or arXiv ID (e.g. 1706.03762).");
      return;
    }

    setLoading(true);
    try {
      const meta = detected.arxivId
        ? await fetchMetadataByArxiv(detected.arxivId)
        : await fetchMetadataByDoi(detected.doi!);
      onImported(meta);
      setInput("");
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Metadata lookup failed. Check your connection or add manually.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Import by DOI or arXiv ID"
      onClick={onClose}
    >
      <div className="kuraso-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="kuraso-dialog-header">
          <strong>Import by DOI or arXiv ID</strong>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="kuraso-dialog-body">
          <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--kuraso-text-secondary)" }}>
            Paste a DOI, arXiv ID, or URL. Kuraso fetches metadata directly from Crossref or arXiv.
          </p>
          <input
            className="kuraso-input"
            placeholder="e.g. 1706.03762 or 10.1145/3292500.3330701"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleLookup();
            }}
            autoFocus
          />
          {error && (
            <div style={{ fontSize: "0.8rem", color: "var(--kuraso-hl-red-border)" }}>{error}</div>
          )}
        </div>
        <div className="kuraso-dialog-footer">
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="kuraso-primary-btn"
            disabled={loading || !input.trim()}
            onClick={() => void handleLookup()}
          >
            {loading ? "Looking up…" : "Fetch & Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
