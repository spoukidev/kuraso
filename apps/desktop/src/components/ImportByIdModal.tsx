import { useState } from "react";
import {
  detectIdentifiers,
  fetchMetadataByArxiv,
  fetchMetadataByDoi,
  type FetchedMetadata,
} from "@kuraso/importers";
import { X } from "lucide-react";
import { tr } from "../i18n/tr";
import { useEscapeToClose } from "./useEscapeToClose";
import { metadataFetch } from "../state/diskStore";

/** Turn fetch / HTTP failures into a sentence a reader can act on. */
function friendlyLookupError(err: unknown, service: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const status = Number(/\((\d{3})\)/.exec(message)?.[1] ?? 0);
  if (status === 404) return tr("{service} has no record for this identifier. Check it and try again.", { service });
  if (status === 429 || status === 503) return tr("{service} is busy right now. Try again in a minute.", { service });
  if (status >= 500) return tr("{service} had a server error. Try again later.", { service });
  if (/failed to fetch|network|load failed|timed? ?out|dns|connect/i.test(message)) {
    return tr("Couldn't reach {service}. Check your internet connection and try again.", { service });
  }
  if (/no arxiv entry/i.test(message)) return tr("arXiv has no paper with this ID.");
  return tr("Metadata lookup failed. Check your connection or add manually.");
}

interface ImportByIdModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (meta: FetchedMetadata) => void;
}

export function ImportByIdModal({ open, onClose, onImported }: ImportByIdModalProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeToClose(open, onClose);

  if (!open) return null;

  async function handleLookup() {
    setError(null);
    const detected = detectIdentifiers(input);
    if (!detected.doi && !detected.arxivId) {
      setError(tr("Could not recognize a DOI (e.g. 10.1109/...) or arXiv ID (e.g. 1706.03762)."));
      return;
    }

    setLoading(true);
    const service = detected.arxivId ? "arXiv" : "Crossref";
    try {
      const meta = detected.arxivId
        ? await fetchMetadataByArxiv(detected.arxivId, metadataFetch)
        : await fetchMetadataByDoi(detected.doi!, metadataFetch);
      onImported(meta);
      setInput("");
      onClose();
    } catch (err: unknown) {
      setError(friendlyLookupError(err, service));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr("Import by DOI or arXiv ID")}
      onClick={onClose}
    >
      <div className="kuraso-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="kuraso-dialog-header">
          <strong>{tr("Import by DOI or arXiv ID")}</strong>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="kuraso-dialog-body">
          <p style={{ margin: 0, fontSize: "0.83rem", color: "var(--kuraso-text-secondary)" }}>
            {tr("Paste a DOI, arXiv ID, or URL. Kuraso fetches metadata directly from Crossref or arXiv.")}
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
            {tr("Cancel")}
          </button>
          <button
            type="button"
            className="kuraso-primary-btn"
            disabled={loading || !input.trim()}
            onClick={() => void handleLookup()}
          >
            {loading ? tr("Looking up…") : tr("Fetch & Add")}
          </button>
        </div>
      </div>
    </div>
  );
}
