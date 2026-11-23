import { useMemo } from "react";
import type { Collection, PaperMeta, Project } from "@kuraso/formats";
import { extractWikiLinks, normalizeLinkKey } from "@kuraso/annotations";
import { Network, X } from "lucide-react";

interface KnowledgeGraphModalProps {
  open: boolean;
  papers: PaperMeta[];
  collections: Collection[];
  projects: Project[];
  notesByPaper: Record<string, string>;
  onClose: () => void;
  onOpenPaper: (paper: PaperMeta) => void;
}

interface GraphNode {
  id: string;
  label: string;
  kind: "paper" | "collection" | "project";
  x: number;
  y: number;
  paper?: PaperMeta;
}

interface GraphEdge {
  from: string;
  to: string;
  kind: "membership" | "wikilink";
}

export function KnowledgeGraphModal({
  open,
  papers,
  collections,
  projects,
  notesByPaper,
  onClose,
  onOpenPaper,
}: KnowledgeGraphModalProps) {
  const { nodes, edges } = useMemo(() => {
    const cx = 340;
    const cy = 220;
    const nodeList: GraphNode[] = [];
    const edgeList: GraphEdge[] = [];
    const paperByKey = new Map<string, PaperMeta>();

    papers.forEach((p, idx) => {
      paperByKey.set(normalizeLinkKey(p.title), p);
      const angle = (idx / Math.max(1, papers.length)) * Math.PI * 2;
      const radius = 155;
      nodeList.push({
        id: p.id,
        label: p.title.length > 26 ? `${p.title.slice(0, 25)}…` : p.title,
        kind: "paper",
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        paper: p,
      });
    });

    collections.forEach((c, idx) => {
      const angle = (idx / Math.max(1, collections.length)) * Math.PI * 2 + 0.4;
      const radius = 78;
      nodeList.push({
        id: c.id,
        label: c.name,
        kind: "collection",
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
      for (const pid of c.paperIds) {
        edgeList.push({ from: c.id, to: pid, kind: "membership" });
      }
    });

    projects.forEach((proj, idx) => {
      const angle = (idx / Math.max(1, projects.length)) * Math.PI * 2;
      nodeList.push({
        id: proj.id,
        label: proj.name,
        kind: "project",
        x: cx + Math.cos(angle) * 28,
        y: cy + Math.sin(angle) * 28,
      });
      for (const cid of proj.collectionIds) {
        edgeList.push({ from: proj.id, to: cid, kind: "membership" });
      }
      for (const link of extractWikiLinks(proj.draftMarkdown ?? "")) {
        const target = paperByKey.get(link.key);
        if (target) edgeList.push({ from: proj.id, to: target.id, kind: "wikilink" });
      }
    });

    for (const p of papers) {
      const md = notesByPaper[p.id] ?? "";
      for (const link of extractWikiLinks(md)) {
        const target = paperByKey.get(link.key);
        if (target && target.id !== p.id) {
          edgeList.push({ from: p.id, to: target.id, kind: "wikilink" });
        }
      }
    }

    return { nodes: nodeList, edges: edgeList };
  }, [papers, collections, projects, notesByPaper]);

  if (!open) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div
      className="kuraso-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Knowledge Graph"
      onClick={onClose}
    >
      <div className="kuraso-dialog" style={{ width: "min(740px, 95vw)" }} onClick={(e) => e.stopPropagation()}>
        <div className="kuraso-dialog-header">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Network size={16} />
            <strong>
              Knowledge Graph ({papers.length} papers · {collections.length} collections ·{" "}
              {edges.length} links)
            </strong>
          </div>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="kuraso-dialog-body">
          {nodes.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--kuraso-text-muted)" }}>
              Import papers, create collections, or link notes with `[[Paper Title]]` to populate
              your knowledge graph.
            </p>
          ) : (
            <svg
              viewBox="0 0 680 440"
              style={{
                width: "100%",
                height: 420,
                backgroundColor: "var(--kuraso-bg-surface)",
                borderRadius: 10,
                border: "1px solid var(--kuraso-border)",
              }}
            >
              {edges.map((e, i) => {
                const a = nodeMap.get(e.from);
                const b = nodeMap.get(e.to);
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={e.kind === "wikilink" ? "var(--kuraso-accent)" : "var(--kuraso-border)"}
                    strokeWidth={e.kind === "wikilink" ? 1.8 : 1.1}
                    strokeDasharray={e.kind === "wikilink" ? "4 3" : undefined}
                  />
                );
              })}

              {nodes.map((node) => {
                const fill =
                  node.kind === "paper"
                    ? "var(--kuraso-accent)"
                    : node.kind === "collection"
                      ? "var(--kuraso-hl-green-border)"
                      : "var(--kuraso-hl-purple-border)";
                const r = node.kind === "project" ? 10 : node.kind === "collection" ? 8 : 7;
                return (
                  <g
                    key={node.id}
                    style={{ cursor: node.paper ? "pointer" : "default" }}
                    onClick={() => {
                      if (node.paper) {
                        onOpenPaper(node.paper);
                        onClose();
                      }
                    }}
                  >
                    <circle cx={node.x} cy={node.y} r={r} fill={fill} />
                    <text
                      x={node.x}
                      y={node.y + r + 12}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--kuraso-text-primary)"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        <div className="kuraso-dialog-footer">
          <span style={{ marginInlineEnd: "auto", fontSize: "0.75rem", color: "var(--kuraso-text-muted)" }}>
            Blue: Papers · Green: Collections · Purple: Projects · Dashed: [[wiki-links]]
          </span>
          <button type="button" className="kuraso-icon-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
