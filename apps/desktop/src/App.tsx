import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KurasoTheme } from "@kuraso/ui";
import {
  KURASO_FORMAT_VERSION,
  type Annotation,
  type Collection,
  type PaperMeta,
  type PaperStructure,
} from "@kuraso/formats";
import type { FetchedMetadata } from "@kuraso/importers";
import {
  BookOpen,
  FileText,
  Folder,
  FolderOpen,
  Inbox,
  Library as LibraryIcon,
  Moon,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  Settings,
  Shield,
  Star,
  Sun,
  X,
} from "lucide-react";
import { PdfViewer } from "./components/PdfViewer";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { LibraryView } from "./components/LibraryView";
import { ImportByIdModal } from "./components/ImportByIdModal";
import { AnnotationPanel } from "./components/AnnotationPanel";
import { NotesEditor } from "./components/NotesEditor";
import { AISettingsModal } from "./components/AISettingsModal";
import { AssistantPanel } from "./components/AssistantPanel";
import {
  loadAISettings,
  saveAISettings,
  type AISettings,
} from "./state/aiStore";
import {
  loadSavedPositions,
  loadSavedTheme,
  saveReadingPosition,
  saveTheme,
  type OpenDocumentTab,
  type OutlineNode,
} from "./state/readerStore";
import {
  loadPaperAnnotations,
  loadPaperNotes,
  savePaperAnnotations,
  savePaperNotes,
} from "./state/annotationsStore";
import {
  createCollectionRecord,
  createPaperRecord,
  filterPapersByQuery,
  findDuplicatePaper,
  loadLibraryCollections,
  loadLibraryPapers,
  saveLibraryCollections,
  saveLibraryPapers,
  sha256Hex,
} from "./state/libraryStore";

type RightTab = "outline" | "annotations" | "notes" | "assistant";
type LibraryFilter =
  | { kind: "all" }
  | { kind: "status"; status: "to-read" | "reading" | "important" }
  | { kind: "collection"; collectionId: string };

export function App() {
  const [theme, setTheme] = useState<KurasoTheme>(() => loadSavedTheme());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>("outline");

  // Phase 2: Library & Collections state
  const [papers, setPapers] = useState<PaperMeta[]>(() => loadLibraryPapers());
  const [collections, setCollections] = useState<Collection[]>(() => loadLibraryCollections());
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>({ kind: "all" });
  const [librarySearch, setLibrarySearch] = useState("");
  const [centerMode, setCenterMode] = useState<"library" | "reader">("library");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [addingCollection, setAddingCollection] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // In-memory PDF bytes keyed by paper.id (in desktop Tauri, bytes live in <Library>/papers/<slug>/paper.pdf)
  const pdfBytesRef = useRef<Record<string, Uint8Array>>({});
  const [hasBytesMap, setHasBytesMap] = useState<Record<string, boolean>>({});
  const extractedTextsRef = useRef<Record<string, string>>({});

  // Reader tabs
  const [tabs, setTabs] = useState<OpenDocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [annotationsByPaper, setAnnotationsByPaper] = useState<Record<string, Annotation[]>>({});
  const [notesByPaper, setNotesByPaper] = useState<Record<string, string>>({});
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadAISettings());
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [sessionApiKeys, setSessionApiKeys] = useState<Record<string, string>>({});
  const [pendingExplainText, setPendingExplainText] = useState<string | null>(null);
  const [jumpToPage, setJumpToPage] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveLibraryPapers(papers);
  }, [papers]);

  useEffect(() => {
    saveLibraryCollections(collections);
  }, [collections]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  const openPaperInReader = useCallback(
    (paper: PaperMeta) => {
      const bytes = pdfBytesRef.current[paper.id];
      if (!bytes) {
        showToast("No local PDF attached yet for this metadata entry — drop or import its PDF.");
        return;
      }
      const savedPage = loadSavedPositions()[paper.id] ?? paper.readingPosition?.page ?? 1;
      setAnnotationsByPaper((prev) =>
        prev[paper.id] ? prev : { ...prev, [paper.id]: loadPaperAnnotations(paper.id) },
      );
      setNotesByPaper((prev) =>
        prev[paper.id] !== undefined
          ? prev
          : { ...prev, [paper.id]: loadPaperNotes(paper.id, paper.title) },
      );
      setTabs((prev) => {
        if (prev.some((t) => t.id === paper.id)) return prev;
        return [
          ...prev,
          {
            id: paper.id,
            title: paper.title,
            bytes,
            pageCount: paper.pageCount ?? 0,
            currentPage: savedPage,
            zoom: 1.2,
            marginCrop: false,
            scanned: paper.scanned,
            outline: [],
          },
        ];
      });
      setActiveTabId(paper.id);
      setCenterMode("reader");
      setJumpToPage(null);
    },
    [showToast],
  );

  const importPdfFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".pdf")) return;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const fileHash = await sha256Hex(bytes);

      const dup = findDuplicatePaper(papers, fileHash, null);
      if (dup) {
        pdfBytesRef.current[dup.paper.id] = bytes;
        setHasBytesMap((m) => ({ ...m, [dup.paper.id]: true }));
        showToast(`Already in library (${dup.reason}) — opening existing paper.`);
        openPaperInReader(dup.paper);
        return;
      }

      const paper = createPaperRecord({
        title: file.name.replace(/\.pdf$/i, ""),
        fileHash,
      });

      pdfBytesRef.current[paper.id] = bytes;
      setHasBytesMap((m) => ({ ...m, [paper.id]: true }));
      setPapers((prev) => [paper, ...prev]);

      // If currently viewing a collection, assign the imported paper to it.
      if (libraryFilter.kind === "collection") {
        const colId = libraryFilter.collectionId;
        setCollections((prev) =>
          prev.map((c) =>
            c.id === colId && !c.paperIds.includes(paper.id)
              ? { ...c, paperIds: [...c.paperIds, paper.id], updatedAt: new Date().toISOString() }
              : c,
          ),
        );
      }

      openPaperInReader(paper);
    },
    [papers, libraryFilter, openPaperInReader, showToast],
  );

  const openFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      for (const file of Array.from(fileList)) {
        await importPdfFile(file);
      }
    },
    [importPdfFile],
  );

  const handleImportedById = useCallback(
    async (meta: FetchedMetadata) => {
      const syntheticHash = await sha256Hex(
        new TextEncoder().encode(meta.doi ?? meta.arxivId ?? meta.title),
      );
      const dup = findDuplicatePaper(papers, syntheticHash, meta.doi);
      if (dup) {
        showToast(`Paper already in library (${dup.reason}).`);
        return;
      }
      const paper = createPaperRecord({
        title: meta.title,
        authors: meta.authors,
        year: meta.year,
        venue: meta.venue,
        doi: meta.doi,
        arxivId: meta.arxivId,
        url: meta.url,
        abstract: meta.abstract,
        fileHash: syntheticHash,
      });
      setPapers((prev) => [paper, ...prev]);
      setCenterMode("library");
      showToast(`Added "${paper.title}" to library.`);
    },
    [papers, showToast],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          const nextId = remaining[remaining.length - 1]?.id ?? null;
          setActiveTabId(nextId);
          if (!nextId) setCenterMode("library");
        }
        return remaining;
      });
    },
    [activeTabId],
  );

  const cycleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "sepia" : t === "sepia" ? "dark" : "light"));
  }, []);

  const updateActiveTab = useCallback(
    (updater: (tab: OpenDocumentTab) => OpenDocumentTab) => {
      if (!activeTabId) return;
      setTabs((prev) => prev.map((t) => (t.id === activeTabId ? updater(t) : t)));
    },
    [activeTabId],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      if (!activeTabId) return;
      saveReadingPosition(activeTabId, page);
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId && t.currentPage !== page ? { ...t, currentPage: page } : t)),
      );
    },
    [activeTabId],
  );

  const handleDocumentLoaded = useCallback(
    (meta: {
      pageCount: number;
      scanned: boolean;
      outline: OutlineNode[];
      structure: PaperStructure;
    }) => {
      updateActiveTab((t) => ({
        ...t,
        pageCount: meta.pageCount,
        scanned: meta.scanned,
        outline: meta.outline,
        structure: meta.structure,
      }));
      if (activeTabId) {
        setPapers((prev) =>
          prev.map((p) =>
            p.id === activeTabId
              ? { ...p, pageCount: meta.pageCount, scanned: meta.scanned }
              : p,
          ),
        );
      }
    },
    [updateActiveTab, activeTabId],
  );

  const activeAnnotations = useMemo(
    () => (activeTabId ? (annotationsByPaper[activeTabId] ?? []) : []),
    [annotationsByPaper, activeTabId],
  );

  const activeNotes = useMemo(
    () => (activeTabId ? (notesByPaper[activeTabId] ?? "") : ""),
    [notesByPaper, activeTabId],
  );

  const handleCreateAnnotation = useCallback(
    (ann: Annotation, focusNotes = false) => {
      if (!activeTabId) return;
      setAnnotationsByPaper((prev) => {
        const next = [ann, ...(prev[activeTabId] ?? [])];
        savePaperAnnotations(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
      if (focusNotes) {
        setRightOpen(true);
        setRightTab("annotations");
      }
    },
    [activeTabId],
  );

  const handleUpdateAnnotation = useCallback(
    (updated: Annotation) => {
      if (!activeTabId) return;
      setAnnotationsByPaper((prev) => {
        const next = (prev[activeTabId] ?? []).map((a) => (a.id === updated.id ? updated : a));
        savePaperAnnotations(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
    },
    [activeTabId],
  );

  const handleDeleteAnnotation = useCallback(
    (annId: string) => {
      if (!activeTabId) return;
      setAnnotationsByPaper((prev) => {
        const next = (prev[activeTabId] ?? []).filter((a) => a.id !== annId);
        savePaperAnnotations(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
    },
    [activeTabId],
  );

  const handleNotesChange = useCallback(
    (markdown: string) => {
      if (!activeTabId) return;
      setNotesByPaper((prev) => {
        savePaperNotes(activeTabId, markdown);
        return { ...prev, [activeTabId]: markdown };
      });
    },
    [activeTabId],
  );

  const handleCreateCollection = useCallback(() => {
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    const col = createCollectionRecord(trimmed);
    setCollections((prev) => [...prev, col]);
    setNewCollectionName("");
    setAddingCollection(false);
    setLibraryFilter({ kind: "collection", collectionId: col.id });
    setCenterMode("library");
  }, [newCollectionName]);

  const handleTogglePaperCollection = useCallback((paperId: string, collectionId: string) => {
    setCollections((prev) =>
      prev.map((c) => {
        if (c.id !== collectionId) return c;
        const exists = c.paperIds.includes(paperId);
        return {
          ...c,
          paperIds: exists ? c.paperIds.filter((id) => id !== paperId) : [...c.paperIds, paperId],
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }, []);

  const handleToggleCollectionLocalOnly = useCallback((collectionId: string) => {
    setCollections((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? { ...c, localAiOnly: !c.localAiOnly, updatedAt: new Date().toISOString() }
          : c,
      ),
    );
  }, []);

  const visiblePapers = useMemo(() => {
    let subset = papers;
    if (libraryFilter.kind === "status") {
      subset = papers.filter((p) => p.status === libraryFilter.status);
    } else if (libraryFilter.kind === "collection") {
      const col = collections.find((c) => c.id === libraryFilter.collectionId);
      const idSet = new Set(col?.paperIds ?? []);
      subset = papers.filter((p) => idSet.has(p.id));
    }
    return filterPapersByQuery(subset, librarySearch, extractedTextsRef.current);
  }, [papers, collections, libraryFilter, librarySearch]);

  const libraryViewTitle = useMemo(() => {
    if (libraryFilter.kind === "all") return "All Papers";
    if (libraryFilter.kind === "status") {
      return libraryFilter.status === "to-read"
        ? "Inbox (To Read)"
        : libraryFilter.status === "reading"
          ? "Currently Reading"
          : "Important Papers";
    }
    return collections.find((c) => c.id === libraryFilter.collectionId)?.name ?? "Collection";
  }, [libraryFilter, collections]);

  // Global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setCenterMode("library");
      } else if (mod && e.key.toLowerCase() === "f" && centerMode === "reader" && activeTabId) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (mod && e.key === "[") {
        e.preventDefault();
        setLeftOpen((v) => !v);
      } else if (mod && e.key === "]") {
        e.preventDefault();
        setRightOpen((v) => !v);
      } else if (e.ctrlKey && e.key === "Tab" && tabs.length > 1 && activeTabId) {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = e.shiftKey
          ? (idx - 1 + tabs.length) % tabs.length
          : (idx + 1) % tabs.length;
        const next = tabs[nextIdx];
        if (next) {
          setActiveTabId(next.id);
          setCenterMode("reader");
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTabId, tabs, centerMode]);

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "open-pdf",
        label: "Import / Open PDF file…",
        shortcut: "Ctrl+O",
        run: () => fileInputRef.current?.click(),
      },
      {
        id: "import-doi",
        label: "Import paper by DOI or arXiv ID…",
        run: () => setImportModalOpen(true),
      },
      {
        id: "go-library",
        label: "Show Library view",
        shortcut: "Ctrl+Shift+F",
        run: () => setCenterMode("library"),
      },
      {
        id: "ai-settings",
        label: "Configure AI provider (BYOK / Ollama)…",
        run: () => setAiSettingsOpen(true),
      },
      {
        id: "cycle-theme",
        label: `Switch theme (current: ${theme})`,
        run: cycleTheme,
      },
      {
        id: "toggle-left",
        label: leftOpen ? "Hide Library panel" : "Show Library panel",
        shortcut: "Ctrl+[",
        run: () => setLeftOpen((v) => !v),
      },
      {
        id: "toggle-right",
        label: rightOpen ? "Hide Context panel" : "Show Context panel",
        shortcut: "Ctrl+]",
        run: () => setRightOpen((v) => !v),
      },
      ...(activeTab
        ? [
            {
              id: "find-in-paper",
              label: "Find in current paper",
              shortcut: "Ctrl+F",
              run: () => {
                setCenterMode("reader");
                setSearchOpen(true);
              },
            },
            {
              id: "toggle-crop",
              label: activeTab.marginCrop ? "Disable margin crop" : "Enable smart margin crop",
              run: () => updateActiveTab((t) => ({ ...t, marginCrop: !t.marginCrop })),
            },
          ]
        : []),
    ],
    [theme, leftOpen, rightOpen, activeTab, cycleTheme, updateActiveTab],
  );

  return (
    <div
      className="kuraso-shell"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void openFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          void openFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Top Bar */}
      <header className="kuraso-topbar">
        <div className="kuraso-brand">
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Toggle Library (Ctrl+[)"
            onClick={() => setLeftOpen((v) => !v)}
          >
            <PanelLeft size={16} />
          </button>
          <BookOpen size={18} />
          <span>Kuraso</span>
        </div>

        <button
          type="button"
          className="kuraso-search-trigger"
          onClick={() => setPaletteOpen(true)}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Search size={14} />
            <span>Search or run a command…</span>
          </span>
          <kbd className="kuraso-kbd">Ctrl+K</kbd>
        </button>

        <div className="kuraso-topbar-actions">
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Import by DOI or arXiv ID"
            onClick={() => setImportModalOpen(true)}
          >
            <Plus size={15} />
            <span>DOI / arXiv</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Import PDF (Ctrl+O)"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen size={16} />
            <span>Import</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={`Theme: ${theme}`}
            onClick={cycleTheme}
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            <span style={{ textTransform: "capitalize" }}>{theme}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title="AI Settings (BYOK / Ollama)"
            onClick={() => setAiSettingsOpen(true)}
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Toggle Context panel (Ctrl+])"
            onClick={() => setRightOpen((v) => !v)}
          >
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      {/* 3-Pane Workspace */}
      <div className="kuraso-workspace">
        {leftOpen && (
          <aside className="kuraso-sidebar-left" aria-label="Library">
            <div>
              <div className="kuraso-section-label">Library</div>
              <button
                type="button"
                className="kuraso-nav-item"
                data-active={centerMode === "library" && libraryFilter.kind === "all" ? "true" : "false"}
                onClick={() => {
                  setLibraryFilter({ kind: "all" });
                  setCenterMode("library");
                }}
              >
                <LibraryIcon size={15} />
                <span>All Papers ({papers.length})</span>
              </button>
              <button
                type="button"
                className="kuraso-nav-item"
                data-active={
                  centerMode === "library" &&
                  libraryFilter.kind === "status" &&
                  libraryFilter.status === "to-read"
                    ? "true"
                    : "false"
                }
                onClick={() => {
                  setLibraryFilter({ kind: "status", status: "to-read" });
                  setCenterMode("library");
                }}
              >
                <Inbox size={15} />
                <span>Inbox</span>
              </button>
              <button
                type="button"
                className="kuraso-nav-item"
                data-active={
                  centerMode === "library" &&
                  libraryFilter.kind === "status" &&
                  libraryFilter.status === "reading"
                    ? "true"
                    : "false"
                }
                onClick={() => {
                  setLibraryFilter({ kind: "status", status: "reading" });
                  setCenterMode("library");
                }}
              >
                <BookOpen size={15} />
                <span>Reading</span>
              </button>
              <button
                type="button"
                className="kuraso-nav-item"
                data-active={
                  centerMode === "library" &&
                  libraryFilter.kind === "status" &&
                  libraryFilter.status === "important"
                    ? "true"
                    : "false"
                }
                onClick={() => {
                  setLibraryFilter({ kind: "status", status: "important" });
                  setCenterMode("library");
                }}
              >
                <Star size={15} />
                <span>Important</span>
              </button>
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBlockEnd: 6,
                }}
              >
                <span className="kuraso-section-label" style={{ margin: 0 }}>
                  Collections
                </span>
                <button
                  type="button"
                  className="kuraso-icon-btn"
                  style={{ height: 22, paddingInline: 4 }}
                  title="New collection"
                  onClick={() => setAddingCollection((v) => !v)}
                >
                  <Plus size={14} />
                </button>
              </div>

              {addingCollection && (
                <div style={{ display: "flex", gap: 4, marginBlockEnd: 8 }}>
                  <input
                    className="kuraso-input"
                    style={{ flex: 1, minWidth: 0, paddingBlock: 4, fontSize: "0.8rem" }}
                    placeholder="Collection name…"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCollection();
                      if (e.key === "Escape") setAddingCollection(false);
                    }}
                    autoFocus
                  />
                </div>
              )}

              {collections.length === 0 ? (
                <p style={{ fontSize: "0.78rem", color: "var(--kuraso-text-muted)", paddingInline: 8, margin: 0 }}>
                  Click + to organize papers.
                </p>
              ) : (
                collections.map((col) => (
                  <div
                    key={col.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}
                  >
                    <button
                      type="button"
                      className="kuraso-nav-item"
                      data-active={
                        centerMode === "library" &&
                        libraryFilter.kind === "collection" &&
                        libraryFilter.collectionId === col.id
                          ? "true"
                          : "false"
                      }
                      onClick={() => {
                        setLibraryFilter({ kind: "collection", collectionId: col.id });
                        setCenterMode("library");
                      }}
                    >
                      <Folder size={14} />
                      <span className="kuraso-tab-title">{col.name}</span>
                      <span style={{ marginInlineStart: "auto", fontSize: "0.72rem", opacity: 0.7 }}>
                        {col.paperIds.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="kuraso-icon-btn"
                      style={{ height: 24, paddingInline: 4 }}
                      data-active={col.localAiOnly ? "true" : "false"}
                      title={
                        col.localAiOnly
                          ? "Local AI only (confidential)"
                          : "Click to restrict this collection to Local AI only"
                      }
                      onClick={() => handleToggleCollectionLocalOnly(col.id)}
                    >
                      <Shield size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {tabs.length > 0 && (
              <div>
                <div className="kuraso-section-label">Open Tabs ({tabs.length})</div>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className="kuraso-nav-item"
                    data-active={centerMode === "reader" && tab.id === activeTabId ? "true" : "false"}
                    onClick={() => {
                      setActiveTabId(tab.id);
                      setCenterMode("reader");
                    }}
                  >
                    <FileText size={14} />
                    <span className="kuraso-tab-title">{tab.title}</span>
                  </button>
                ))}
              </div>
            )}

            <div
              style={{
                marginBlockStart: "auto",
                fontSize: "0.74rem",
                color: "var(--kuraso-text-muted)",
                paddingInline: 8,
              }}
            >
              Format v{KURASO_FORMAT_VERSION} · Phase 4
            </div>
          </aside>
        )}

        {/* Center Pane: Library View or Tabbed Reader */}
        <main className="kuraso-center" data-dragging={dragging ? "true" : "false"}>
          {tabs.length > 0 && (
            <div className="kuraso-tabbar" role="tablist">
              <div
                role="tab"
                aria-selected={centerMode === "library"}
                className="kuraso-tab"
                data-active={centerMode === "library" ? "true" : "false"}
                onClick={() => setCenterMode("library")}
              >
                <LibraryIcon size={14} />
                <span>Library</span>
              </div>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={centerMode === "reader" && tab.id === activeTabId}
                  className="kuraso-tab"
                  data-active={centerMode === "reader" && tab.id === activeTabId ? "true" : "false"}
                  onClick={() => {
                    setActiveTabId(tab.id);
                    setCenterMode("reader");
                  }}
                >
                  <FileText size={14} />
                  <span className="kuraso-tab-title">{tab.title}</span>
                  <button
                    type="button"
                    className="kuraso-tab-close"
                    aria-label={`Close ${tab.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {centerMode === "reader" && activeTab ? (
            <PdfViewer
              doc={activeTab}
              annotations={activeAnnotations}
              jumpToPage={jumpToPage}
              searchOpen={searchOpen}
              onCloseSearch={() => setSearchOpen(false)}
              onToggleSearch={() => setSearchOpen((v) => !v)}
              onZoomChange={(zoom) => updateActiveTab((t) => ({ ...t, zoom }))}
              onToggleCrop={() => updateActiveTab((t) => ({ ...t, marginCrop: !t.marginCrop }))}
              onPageChange={handlePageChange}
              onCreateAnnotation={handleCreateAnnotation}
              onExplainSelection={(text) => {
                setRightOpen(true);
                setRightTab("assistant");
                setPendingExplainText(text);
              }}
              onDocumentLoaded={handleDocumentLoaded}
            />
          ) : (
            <LibraryView
              title={libraryViewTitle}
              papers={visiblePapers}
              collections={collections}
              searchQuery={librarySearch}
              onSearchQueryChange={setLibrarySearch}
              onOpenPaper={openPaperInReader}
              onUpdatePaper={(updated) =>
                setPapers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
              }
              onTogglePaperCollection={handleTogglePaperCollection}
              onRequestOpenPdf={() => fileInputRef.current?.click()}
              onRequestImportById={() => setImportModalOpen(true)}
              hasBytesMap={hasBytesMap}
            />
          )}
        </main>

        {/* Right Context Panel */}
        {rightOpen && (
          <aside className="kuraso-sidebar-right" aria-label="Context">
            <div className="kuraso-right-tabs">
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "outline" ? "true" : "false"}
                onClick={() => setRightTab("outline")}
              >
                Outline
              </button>
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "annotations" ? "true" : "false"}
                onClick={() => setRightTab("annotations")}
              >
                Highlights ({activeAnnotations.length})
              </button>
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "notes" ? "true" : "false"}
                onClick={() => setRightTab("notes")}
              >
                Notes
              </button>
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "assistant" ? "true" : "false"}
                onClick={() => setRightTab("assistant")}
              >
                AI
              </button>
            </div>

            <div className="kuraso-right-body">
              {rightTab === "outline" && (
                <div>
                  {!activeTab && (
                    <p style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                      Open a PDF to browse its outline.
                    </p>
                  )}
                  {activeTab && activeTab.outline.length === 0 && (
                    <p style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                      No embedded outline or headings detected for this PDF.
                    </p>
                  )}
                  {activeTab &&
                    activeTab.outline.map((item, idx) => (
                      <button
                        key={`${item.title}-${idx}`}
                        type="button"
                        className="kuraso-outline-item"
                        style={{ paddingInlineStart: `${(item.level - 1) * 12 + 6}px` }}
                        onClick={() => {
                          setCenterMode("reader");
                          setJumpToPage(item.page);
                        }}
                      >
                        <span>{item.title}</span>
                        <span style={{ color: "var(--kuraso-text-muted)", fontSize: "0.74rem" }}>
                          p.{item.page}
                        </span>
                      </button>
                    ))}
                </div>
              )}

              {rightTab === "annotations" &&
                (activeTab ? (
                  <AnnotationPanel
                    annotations={activeAnnotations}
                    onJumpToPage={(page) => {
                      setCenterMode("reader");
                      setJumpToPage(page);
                    }}
                    onUpdateAnnotation={handleUpdateAnnotation}
                    onDeleteAnnotation={handleDeleteAnnotation}
                  />
                ) : (
                  <p style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                    Open a PDF to create and gather highlights.
                  </p>
                ))}

              {rightTab === "notes" &&
                (activeTab ? (
                  <NotesEditor markdown={activeNotes} onChange={handleNotesChange} />
                ) : (
                  <p style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                    Open a PDF to edit its Markdown notes (`notes.md`).
                  </p>
                ))}

              {rightTab === "assistant" &&
                (activeTab ? (
                  <AssistantPanel
                    paperId={activeTab.id}
                    paperTitle={activeTab.title}
                    structure={activeTab.structure}
                    scanned={activeTab.scanned}
                    localAiOnly={collections.some(
                      (c) => c.localAiOnly && c.paperIds.includes(activeTab.id),
                    )}
                    settings={aiSettings}
                    apiKey={sessionApiKeys[aiSettings.providerId] ?? ""}
                    pendingExplainText={pendingExplainText}
                    onClearPendingExplain={() => setPendingExplainText(null)}
                    onOpenSettings={() => setAiSettingsOpen(true)}
                    onJumpToPage={(page) => {
                      setCenterMode("reader");
                      setJumpToPage(page);
                    }}
                  />
                ) : (
                  <p style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                    Open a PDF to summarize or ask grounded questions with your own AI.
                  </p>
                ))}
            </div>
          </aside>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />

      <ImportByIdModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={(meta) => void handleImportedById(meta)}
      />

      <AISettingsModal
        open={aiSettingsOpen}
        settings={aiSettings}
        hasKey={Boolean(sessionApiKeys[aiSettings.providerId])}
        onClose={() => setAiSettingsOpen(false)}
        onSave={(nextSettings, newApiKey) => {
          setAiSettings(nextSettings);
          saveAISettings(nextSettings);
          if (newApiKey) {
            setSessionApiKeys((prev) => ({ ...prev, [nextSettings.providerId]: newApiKey }));
          }
          showToast(
            nextSettings.enabled
              ? `AI ready: ${nextSettings.label}`
              : "AI assistant disabled.",
          );
        }}
        onRemoveKey={() => {
          setSessionApiKeys((prev) => {
            const copy = { ...prev };
            delete copy[aiSettings.providerId];
            return copy;
          });
          showToast("API key removed from session.");
        }}
      />

      {toast && (
        <div className="kuraso-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
