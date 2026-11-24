import { useState } from "react";
import type { Collection, PaperMeta, Project } from "@kuraso/formats";
import { exportCollectionToBibtex } from "@kuraso/exporters";
import { Briefcase, Download, Plus, X } from "lucide-react";
import { createProjectRecord } from "../state/knowledgeStore";
import { tr } from "../i18n/tr";

interface ProjectsModalProps {
  open: boolean;
  projects: Project[];
  collections: Collection[];
  papers: PaperMeta[];
  onClose: () => void;
  onSaveProjects: (next: Project[]) => void;
  onExportBibtex: (filename: string, content: string) => void;
}

export function ProjectsModal({
  open,
  projects,
  collections,
  papers,
  onClose,
  onSaveProjects,
  onExportBibtex,
}: ProjectsModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id ?? null);
  const [newName, setNewName] = useState("");

  if (!open) return null;

  const active = projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;

  function handleCreate() {
    if (!newName.trim()) return;
    const proj = createProjectRecord(newName);
    const next = [proj, ...projects];
    onSaveProjects(next);
    setSelectedId(proj.id);
    setNewName("");
  }

  function updateActive(patch: Partial<Project>) {
    if (!active) return;
    const next = projects.map((p) =>
      p.id === active.id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
    );
    onSaveProjects(next);
  }

  function toggleCollection(colId: string) {
    if (!active) return;
    const exists = active.collectionIds.includes(colId);
    updateActive({
      collectionIds: exists
        ? active.collectionIds.filter((id) => id !== colId)
        : [...active.collectionIds, colId],
    });
  }

  const projectPapers = active
    ? papers.filter((paper) =>
        collections.some(
          (c) => active.collectionIds.includes(c.id) && c.paperIds.includes(paper.id),
        ),
      )
    : [];

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={tr("Research Projects")}
      onClick={onClose}
    >
      <div
        className="kuraso-dialog"
        style={{ width: "min(760px, 95vw)", maxHeight: "84vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kuraso-dialog-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Briefcase size={16} />
            <strong>{tr("Research Projects (Thesis / Paper Workspaces)")}</strong>
          </div>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="kuraso-dialog-body" style={{ overflowY: "auto", gap: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="kuraso-input"
              style={{ flex: 1 }}
              placeholder={tr("New project name (e.g. PFE Thesis — 6G Intrusion Detection)…")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <button type="button" className="kuraso-primary-btn" onClick={handleCreate}>
              <Plus size={14} />
              <span>{tr("Create")}</span>
            </button>
          </div>

          {projects.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {projects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="kuraso-chip"
                  data-active={active?.id === p.id ? "true" : "false"}
                  onClick={() => setSelectedId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {active ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--kuraso-text-secondary)" }}>
                  {tr("Linked collections ({n})", { n: active.collectionIds.length })} · {tr("{n} papers", { n: projectPapers.length })}
                </span>
                <button
                  type="button"
                  className="kuraso-chip"
                  disabled={projectPapers.length === 0}
                  onClick={() =>
                    onExportBibtex(
                      `${active.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.bib`,
                      exportCollectionToBibtex(projectPapers),
                    )
                  }
                >
                  <Download size={12} /> {tr("Export Project BibTeX")}
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {collections.length === 0 ? (
                  <span style={{ fontSize: "0.78rem", color: "var(--kuraso-text-muted)" }}>
                    {tr("Create collections in the sidebar to link them to this project.")}
                  </span>
                ) : (
                  collections.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="kuraso-chip"
                      data-active={active.collectionIds.includes(c.id) ? "true" : "false"}
                      onClick={() => toggleCollection(c.id)}
                    >
                      <bdi dir="auto">{c.name}</bdi> ({c.paperIds.length})
                    </button>
                  ))
                )}
              </div>

              <label className="kuraso-field">
                <span>{tr("Project Draft (`draft.md` — supports `[[Paper Title]]` wiki-links)")}</span>
                <textarea
                  className="kuraso-notes-textarea"
                  dir="auto"
                  style={{ minHeight: 220 }}
                  value={active.draftMarkdown ?? ""}
                  onChange={(e) => updateActive({ draftMarkdown: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "0.84rem", color: "var(--kuraso-text-muted)" }}>
              {tr("Create a project to group related collections, draft your related-work chapter with `[[wiki-links]]`, and export its bibliography in one click.")}
            </p>
          )}
        </div>

        <div className="kuraso-dialog-footer">
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            {tr("Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
