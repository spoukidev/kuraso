import { useMemo, useState } from "react";
import type { Collection, PaperMeta, ReadingStatus } from "@kuraso/formats";
import { formatCitation, type CitationStyle } from "@kuraso/exporters";
import { Copy, Edit3, FileText, FolderPlus, Plus, Search, Table2, Upload, X } from "lucide-react";

interface LibraryViewProps {
  title: string;
  papers: PaperMeta[];
  collections: Collection[];
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onOpenPaper: (paper: PaperMeta) => void;
  onUpdatePaper: (paper: PaperMeta) => void;
  onTogglePaperCollection: (paperId: string, collectionId: string) => void;
  onRequestOpenPdf: () => void;
  onRequestImportById: () => void;
  onRequestImportBibtex?: () => void;
  onOpenCollectionTools?: () => void;
  onNotify?: (msg: string) => void;
  hasBytesMap: Record<string, boolean>;
}

type SortField = "addedAt" | "year" | "title";

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = [
  { value: "to-read", label: "To read" },
  { value: "reading", label: "Reading" },
  { value: "read", label: "Read" },
  { value: "skimmed", label: "Skimmed" },
  { value: "important", label: "Important" },
];

export function LibraryView({
  title,
  papers,
  collections,
  searchQuery,
  onSearchQueryChange,
  onOpenPaper,
  onUpdatePaper,
  onTogglePaperCollection,
  onRequestOpenPdf,
  onRequestImportById,
  onRequestImportBibtex,
  onOpenCollectionTools,
  onNotify,
  hasBytesMap,
}: LibraryViewProps) {
  const [sortBy, setSortBy] = useState<SortField>("addedAt");
  const [citeStyle, setCiteStyle] = useState<CitationStyle>("apa");
  const [editing, setEditing] = useState<PaperMeta | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthors, setEditAuthors] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editDoi, setEditDoi] = useState("");
  const [editTags, setEditTags] = useState("");

  const sorted = useMemo(() => {
    const list = [...papers];
    list.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "year") return (b.year ?? 0) - (a.year ?? 0);
      return b.addedAt.localeCompare(a.addedAt);
    });
    return list;
  }, [papers, sortBy]);

  function startEdit(paper: PaperMeta) {
    setEditing(paper);
    setEditTitle(paper.title);
    setEditAuthors(paper.authors.map((a) => a.name).join(", "));
    setEditYear(paper.year ? String(paper.year) : "");
    setEditVenue(paper.venue ?? "");
    setEditDoi(paper.doi ?? "");
    setEditTags(paper.tags.join(", "));
  }

  function commitEdit() {
    if (!editing) return;
    const parsedYear = editYear.trim() ? Number(editYear.trim()) : null;
    const updated: PaperMeta = {
      ...editing,
      title: editTitle.trim() || editing.title,
      authors: editAuthors
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => ({ name, orcid: null })),
      year: parsedYear && !Number.isNaN(parsedYear) ? parsedYear : null,
      venue: editVenue.trim() || null,
      doi: editDoi.trim() || null,
      tags: Array.from(
        new Set(
          editTags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
      updatedAt: new Date().toISOString(),
    };
    onUpdatePaper(updated);
    setEditing(null);
  }

  return (
    <div className="kuraso-library-view">
      <div className="kuraso-library-header">
        <div>
          <h2 className="kuraso-library-title">{title}</h2>
          <span className="kuraso-library-count">
            {sorted.length} {sorted.length === 1 ? "paper" : "papers"}
          </span>
        </div>

        <div className="kuraso-library-tools">
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <Search
              size={14}
              style={{ position: "absolute", insetInlineStart: 12, color: "var(--kuraso-text-muted)" }}
            />
            <input
              className="kuraso-input"
              style={{ paddingInlineStart: 32, minWidth: 230, borderRadius: 999 }}
              placeholder="Search papers, authors, tags…"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
            />
          </div>

          <select
            className="kuraso-input"
            aria-label="Sort papers"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
          >
            <option value="addedAt">Sort: Recently added</option>
            <option value="year">Sort: Year</option>
            <option value="title">Sort: Title</option>
          </select>

          <button type="button" className="kuraso-icon-btn" onClick={onRequestImportById}>
            <Plus size={15} />
            <span>DOI / arXiv</span>
          </button>

          {onRequestImportBibtex && (
            <button
              type="button"
              className="kuraso-icon-btn"
              title="Import BibTeX / Zotero .bib file"
              onClick={onRequestImportBibtex}
            >
              <Upload size={14} />
              <span>.bib / Zotero</span>
            </button>
          )}

          {onOpenCollectionTools && (
            <button
              type="button"
              className="kuraso-icon-btn"
              title="Compare papers or chat with this collection"
              onClick={onOpenCollectionTools}
            >
              <Table2 size={14} />
              <span>Compare AI</span>
            </button>
          )}

          <select
            className="kuraso-input"
            aria-label="Citation copy style"
            value={citeStyle}
            onChange={(e) => setCiteStyle(e.target.value as CitationStyle)}
          >
            <option value="apa">Cite: APA</option>
            <option value="ieee">Cite: IEEE</option>
            <option value="acm">Cite: ACM</option>
          </select>

          <button type="button" className="kuraso-primary-btn" onClick={onRequestOpenPdf}>
            <FolderPlus size={15} />
            <span>Import PDF</span>
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="kuraso-empty-state">
          {searchQuery ? (
            <>
              <h3 className="kuraso-empty-title">
                Nothing <span className="kuraso-swipe">matches</span> yet.
              </h3>
              <p className="kuraso-empty-text">
                No papers match “{searchQuery}”. Try an author, a tag or a word from the abstract.
              </p>
            </>
          ) : (
            <>
              <span className="kuraso-empty-hand" aria-hidden="true">
                your future self says thanks →
              </span>
              <h3 className="kuraso-empty-title">
                Drop a paper. Start <span className="kuraso-swipe">marking</span>.
              </h3>
              <p className="kuraso-empty-text">
                Drag PDFs anywhere in this window, import one, or add a paper by DOI or arXiv ID.
                Everything stays on your computer.
              </p>
              <div className="kuraso-empty-actions">
                <button type="button" className="kuraso-primary-btn" onClick={onRequestOpenPdf}>
                  <FolderPlus size={16} />
                  <span>Import PDF</span>
                </button>
                <button type="button" className="kuraso-icon-btn" onClick={onRequestImportById}>
                  <Plus size={15} />
                  <span>DOI / arXiv</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="kuraso-table-wrap">
          <table className="kuraso-table">
            <thead>
              <tr>
                <th>Title & Authors</th>
                <th>Year</th>
                <th>Venue</th>
                <th>Status</th>
                <th>Collections</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((paper) => {
                const paperCols = collections.filter((c) => c.paperIds.includes(paper.id));
                const canRead = Boolean(hasBytesMap[paper.id]);
                return (
                  <tr key={paper.id}>
                    <td>
                      <button
                        type="button"
                        className="kuraso-paper-title-btn"
                        onClick={() => onOpenPaper(paper)}
                        title={canRead ? "Open in PDF reader" : "Attach PDF to read"}
                      >
                        <FileText size={14} style={{ flexShrink: 0 }} />
                        <span>{paper.title}</span>
                      </button>
                      <div className="kuraso-paper-meta">
                        {paper.authors.length > 0
                          ? paper.authors.map((a) => a.name).join(", ")
                          : "Unknown authors"}
                        {paper.doi ? ` · DOI: ${paper.doi}` : paper.arxivId ? ` · arXiv:${paper.arxivId}` : ""}
                      </div>
                    </td>
                    <td style={{ fontFamily: "var(--kuraso-font-mono)", fontSize: 12 }}>{paper.year ?? "—"}</td>
                    <td>{paper.venue ?? "—"}</td>
                    <td>
                      <select
                        className="kuraso-input"
                        style={{ paddingBlock: 4, fontSize: 12, borderRadius: 999 }}
                        value={paper.status}
                        onChange={(e) =>
                          onUpdatePaper({
                            ...paper,
                            status: e.target.value as ReadingStatus,
                            updatedAt: new Date().toISOString(),
                          })
                        }
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {collections.length === 0 ? (
                          <span style={{ fontSize: "0.75rem", color: "var(--kuraso-text-muted)" }}>—</span>
                        ) : (
                          collections.map((c) => {
                            const active = paperCols.some((pc) => pc.id === c.id);
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className="kuraso-chip"
                                data-active={active ? "true" : "false"}
                                onClick={() => onTogglePaperCollection(paper.id, c.id)}
                              >
                                {c.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          type="button"
                          className="kuraso-icon-btn"
                          title={`Copy ${citeStyle.toUpperCase()} citation`}
                          onClick={() => {
                            const formatted = formatCitation(paper, citeStyle);
                            void navigator.clipboard?.writeText(formatted);
                            onNotify?.(`Copied ${citeStyle.toUpperCase()} citation.`);
                          }}
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          className="kuraso-icon-btn"
                          title="Edit metadata"
                          onClick={() => startEdit(paper)}
                        >
                          <Edit3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          className="kuraso-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Edit paper metadata"
          onClick={() => setEditing(null)}
        >
          <div className="kuraso-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="kuraso-dialog-header">
              <strong>Edit Paper Metadata</strong>
              <button type="button" className="kuraso-icon-btn" onClick={() => setEditing(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="kuraso-dialog-body">
              <label className="kuraso-field">
                <span>Title</span>
                <input className="kuraso-input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </label>
              <label className="kuraso-field">
                <span>Authors (comma-separated)</span>
                <input className="kuraso-input" value={editAuthors} onChange={(e) => setEditAuthors(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <label className="kuraso-field" style={{ flex: 1 }}>
                  <span>Year</span>
                  <input className="kuraso-input" value={editYear} onChange={(e) => setEditYear(e.target.value)} />
                </label>
                <label className="kuraso-field" style={{ flex: 2 }}>
                  <span>Venue</span>
                  <input className="kuraso-input" value={editVenue} onChange={(e) => setEditVenue(e.target.value)} />
                </label>
              </div>
              <label className="kuraso-field">
                <span>DOI</span>
                <input className="kuraso-input" value={editDoi} onChange={(e) => setEditDoi(e.target.value)} />
              </label>
              <label className="kuraso-field">
                <span>Tags (comma-separated)</span>
                <input
                  className="kuraso-input"
                  placeholder="#ids, #6G, #dataset"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                />
              </label>
            </div>
            <div className="kuraso-dialog-footer">
              <button type="button" className="kuraso-icon-btn" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="kuraso-primary-btn" onClick={commitEdit}>
                Save metadata
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
