import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KurasoTheme } from "@kuraso/ui";
import {
  KURASO_FORMAT_VERSION,
  type AIRecipe,
  type Annotation,
  type Collection,
  type PaperMeta,
  type PaperStructure,
  type Project,
} from "@kuraso/formats";
import { buildBacklinksIndex, normalizeLinkKey } from "@kuraso/annotations";
import { parseBibtex, type FetchedMetadata } from "@kuraso/importers";
import {
  exportCollectionToBibtex,
  exportPaperToBibtex,
  exportPaperToMarkdown,
} from "@kuraso/exporters";
import {
  BookOpen,
  BookOpenText,
  Maximize2,
  Minimize2,
  Briefcase,
  Columns2,
  Download,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  Inbox,
  Library as LibraryIcon,
  Moon,
  Network,
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
import { CleanReadingView } from "./components/CleanReadingView";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import { LibraryView } from "./components/LibraryView";
import { ImportByIdModal } from "./components/ImportByIdModal";
import { AnnotationPanel } from "./components/AnnotationPanel";
import { NotesEditor } from "./components/NotesEditor";
import { AssistantPanel } from "./components/AssistantPanel";
import { OnboardingModal, type OnboardingAIChoice } from "./components/OnboardingModal";
import { loadProjects, loadRecipes, saveProjects } from "./state/knowledgeStore";
import { deleteProviderKey, hasProviderKey, saveProviderKey } from "./state/aiBridge";
import {
  loadAISettings,
  loadCachedSummary,
  PROVIDER_PRESETS,
  saveAISettings,
  type AISettings,
} from "./state/aiStore";
import {
  getLanguageDirection,
  loadUILanguage,
  saveUILanguage,
  TRANSLATIONS,
  type UILanguage,
} from "./i18n/translations.mjs";
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
import { setTrLanguage, tr } from "./i18n/tr";

// Heavy views load on first use: pdf.js only when a paper opens, dialogs only when opened.
type ReaderView = "pdf" | "split" | "reflow";

const PdfViewer = lazy(() => import("./components/PdfViewer").then((m) => ({ default: m.PdfViewer })));
const AISettingsModal = lazy(() => import("./components/AISettingsModal").then((m) => ({ default: m.AISettingsModal })));
const CollectionToolsModal = lazy(() =>
  import("./components/CollectionToolsModal").then((m) => ({ default: m.CollectionToolsModal })),
);
const KnowledgeGraphModal = lazy(() =>
  import("./components/KnowledgeGraphModal").then((m) => ({ default: m.KnowledgeGraphModal })),
);
const ProjectsModal = lazy(() => import("./components/ProjectsModal").then((m) => ({ default: m.ProjectsModal })));

type RightTab = "outline" | "annotations" | "notes" | "assistant";
type LibraryFilter =
  | { kind: "all" }
  | { kind: "status"; status: "to-read" | "reading" | "important" }
  | { kind: "collection"; collectionId: string };

const ONBOARDING_DONE_KEY = "kuraso:onboarding-done:v1";

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function App() {
  const [theme, setTheme] = useState<KurasoTheme>(() => loadSavedTheme());
  const [uiLang, setUiLang] = useState<UILanguage>(() => loadUILanguage());
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_DONE_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const t = TRANSLATIONS[uiLang];
  setTrLanguage(uiLang);
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
  const [availableUpdate, setAvailableUpdate] = useState<{ version: string; body?: string | null } | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);

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
  // Providers whose key is stored in the OS keychain (desktop app).
  const [keychainProviders, setKeychainProviders] = useState<Record<string, boolean>>({});
  const [pendingExplainText, setPendingExplainText] = useState<string | null>(null);
  // How the open paper is shown: the PDF, the reflowed text, or both side by side.
  const [readerView, setReaderView] = useState<ReaderView>("pdf");
  const [readerFullscreen, setReaderFullscreen] = useState(false);
  const [splitNotesView, setSplitNotesView] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [collectionToolsOpen, setCollectionToolsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>(() => loadProjects());
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);
  const [recipes] = useState<AIRecipe[]>(() => loadRecipes());
  const [jumpToPage, setJumpToPage] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bibInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  // Silent background check for desktop app updates (no-op in browser or offline)
  useEffect(() => {
    const tauri = (
      window as { __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } }
    ).__TAURI_INTERNALS__;
    if (!tauri?.invoke) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void tauri
        .invoke!("check_for_update")
        .then((res) => {
          if (cancelled || !res || typeof res !== "object") return;
          const info = res as { version?: string; body?: string | null };
          if (info.version) {
            setAvailableUpdate({ version: info.version, body: info.body });
          }
        })
        .catch(() => {
          // Offline or updater unavailable — stay silent.
        });
    }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    const tauri = (
      window as { __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } }
    ).__TAURI_INTERNALS__;
    if (!tauri?.invoke || installingUpdate) return;
    setInstallingUpdate(true);
    try {
      await tauri.invoke("install_update");
    } catch (err) {
      setInstallingUpdate(false);
      showToast(
        tr("Update failed: {message}", {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }, [installingUpdate, showToast]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = uiLang;
    document.documentElement.dir = getLanguageDirection(uiLang);
    saveUILanguage(uiLang);
  }, [uiLang]);

  useEffect(() => {
    saveLibraryPapers(papers);
  }, [papers]);

  useEffect(() => {
    let cancelled = false;
    void hasProviderKey(aiSettings.providerId).then((stored) => {
      if (!cancelled) setKeychainProviders((prev) => ({ ...prev, [aiSettings.providerId]: stored }));
    });
    return () => {
      cancelled = true;
    };
  }, [aiSettings.providerId]);

  const aiKeyReady =
    aiSettings.local ||
    Boolean(sessionApiKeys[aiSettings.providerId]) ||
    Boolean(keychainProviders[aiSettings.providerId]);

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
        showToast(tr("No local PDF attached yet for this metadata entry — drop or import its PDF."));
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
        showToast(tr("Already in library ({reason}) — opening existing paper.", { reason: tr(dup.reason) }));
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
        showToast(tr("Paper already in library ({reason}).", { reason: tr(dup.reason) }));
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
      showToast(tr("Added “{title}” to library.", { title: paper.title }));
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
      // Pages report visibility often while scrolling; only touch state when the page really changes.
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === activeTabId);
        if (!tab || tab.currentPage === page) return prev;
        saveReadingPosition(activeTabId, page);
        return prev.map((t) => (t.id === activeTabId ? { ...t, currentPage: page } : t));
      });
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

  const backlinksIndex = useMemo(() => {
    const sources = [
      ...papers.map((p) => ({
        id: p.id,
        title: p.title,
        markdown: notesByPaper[p.id] ?? "",
      })),
      ...projects.map((proj) => ({
        id: proj.id,
        title: `Project: ${proj.name}`,
        markdown: proj.draftMarkdown ?? "",
      })),
    ];
    return buildBacklinksIndex(sources);
  }, [papers, notesByPaper, projects]);

  const activeBacklinks = useMemo(() => {
    if (!activeTab) return [];
    const byTitle = backlinksIndex[normalizeLinkKey(activeTab.title)] ?? [];
    return byTitle.filter((b) => b.sourceId !== activeTab.id);
  }, [activeTab, backlinksIndex]);

  const handleFollowWikiLink = useCallback(
    (targetTitle: string) => {
      const key = normalizeLinkKey(targetTitle);
      const match = papers.find((p) => normalizeLinkKey(p.title) === key || p.slug === key);
      if (match) {
        openPaperInReader(match);
      } else {
        setLibrarySearch(targetTitle);
        setCenterMode("library");
        showToast(tr("Filtered library for [[{title}]]", { title: targetTitle }));
      }
    },
    [papers, openPaperInReader, showToast],
  );

  const handleOpenBacklinkSource = useCallback(
    (sourceId: string) => {
      const paper = papers.find((p) => p.id === sourceId);
      if (paper) {
        openPaperInReader(paper);
      } else if (projects.some((p) => p.id === sourceId)) {
        setProjectsOpen(true);
      }
    },
    [papers, projects, openPaperInReader],
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
    if (libraryFilter.kind === "all") return tr("All Papers");
    if (libraryFilter.kind === "status") {
      return libraryFilter.status === "to-read"
        ? tr("Inbox (To Read)")
        : libraryFilter.status === "reading"
          ? tr("Currently Reading")
          : tr("Important Papers");
    }
    return collections.find((c) => c.id === libraryFilter.collectionId)?.name ?? tr("Collection");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryFilter, collections, uiLang]);

  const handleExportMarkdown = useCallback(() => {
    const activePaper = activeTabId ? papers.find((p) => p.id === activeTabId) : null;
    if (!activePaper) {
      showToast(tr("Open a paper first to export its Markdown notes."));
      return;
    }
    const md = exportPaperToMarkdown({
      paper: activePaper,
      annotations: annotationsByPaper[activePaper.id] ?? [],
      notesMarkdown: notesByPaper[activePaper.id] ?? "",
      summary: loadCachedSummary(activePaper.id),
    });
    downloadTextFile(`${activePaper.slug}.md`, md, "text/markdown;charset=utf-8");
    showToast(tr("Exported {file}", { file: `${activePaper.slug}.md` }));
  }, [activeTabId, papers, annotationsByPaper, notesByPaper, showToast]);

  const handleExportBibtex = useCallback(() => {
    if (centerMode === "reader" && activeTabId) {
      const paper = papers.find((p) => p.id === activeTabId);
      if (paper) {
        const bib = exportPaperToBibtex(paper);
        downloadTextFile(`${paper.slug}.bib`, bib, "application/x-bibtex;charset=utf-8");
        showToast(tr("Exported {file}", { file: `${paper.slug}.bib` }));
        return;
      }
    }
    if (visiblePapers.length === 0) {
      showToast(tr("No papers to export to BibTeX."));
      return;
    }
    const bib = exportCollectionToBibtex(visiblePapers);
    downloadTextFile("kuraso-references.bib", bib, "application/x-bibtex;charset=utf-8");
    showToast(tr("Exported {n} BibTeX entries.", { n: visiblePapers.length }));
  }, [centerMode, activeTabId, papers, visiblePapers, showToast]);

  const handleOnboardingComplete = useCallback(
    (choice: OnboardingAIChoice) => {
      try {
        localStorage.setItem(ONBOARDING_DONE_KEY, "1");
      } catch {
        // Ignore.
      }
      setOnboardingOpen(false);
      if (choice === "none") {
        const off: AISettings = { ...aiSettings, enabled: false };
        setAiSettings(off);
        saveAISettings(off);
        return;
      }
      const presetId =
        choice === "free-cloud"
          ? "google-ai-studio"
          : choice === "local"
            ? "ollama"
            : choice === "university"
              ? "custom-openai"
              : "anthropic";
      const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        const next: AISettings = {
          ...aiSettings,
          enabled: true,
          providerId: preset.id,
          kind: preset.kind,
          label: preset.label,
          baseUrl: preset.baseUrl,
          model: preset.defaultModel || aiSettings.model,
          local: Boolean(preset.local),
          answerLanguage: uiLang,
        };
        setAiSettings(next);
        saveAISettings(next);
      }
      setAiSettingsOpen(true);
    },
    [aiSettings, uiLang],
  );

  const handleImportBibtexFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      const raw = await file.text();
      const entries = parseBibtex(raw);
      if (entries.length === 0) {
        showToast(tr("No valid BibTeX entries found in file."));
        return;
      }
      let added = 0;
      for (const entry of entries) {
        const syntheticHash = await sha256Hex(
          new TextEncoder().encode(entry.doi ?? entry.arxivId ?? entry.title),
        );
        if (findDuplicatePaper(papers, syntheticHash, entry.doi)) continue;
        const paper = createPaperRecord({
          title: entry.title,
          authors: entry.authors,
          year: entry.year,
          venue: entry.venue,
          doi: entry.doi,
          arxivId: entry.arxivId,
          url: entry.url,
          abstract: entry.abstract,
          fileHash: syntheticHash,
        });
        setPapers((prev) => [paper, ...prev]);
        added += 1;
      }
      setCenterMode("library");
      showToast(tr("Imported {added} of {total} BibTeX entries.", { added, total: entries.length }));
    },
    [papers, showToast],
  );

  const handleExplainSelection = useCallback((text: string) => {
    setRightOpen(true);
    setRightTab("assistant");
    setPendingExplainText(text);
  }, []);

  // Full-screen reading: hide the app chrome and, when allowed, make the window itself full screen.
  const toggleReaderFullscreen = useCallback(async (force?: boolean) => {
    const next = force ?? !readerFullscreenRef.current;
    readerFullscreenRef.current = next;
    setReaderFullscreen(next);
    const tauri = (window as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } })
      .__TAURI_INTERNALS__;
    try {
      if (tauri) {
        await tauri.invoke("plugin:window|set_fullscreen", { label: "main", value: next });
      } else if (next && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Window-level full screen is optional; the chrome-less layout still applies.
    }
  }, []);
  const readerFullscreenRef = useRef(false);

  useEffect(() => {
    // Leaving browser full screen with Esc should also restore the app chrome.
    function onChange() {
      if (!document.fullscreenElement && readerFullscreenRef.current && !("__TAURI_INTERNALS__" in window)) {
        readerFullscreenRef.current = false;
        setReaderFullscreen(false);
      }
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (centerMode !== "reader" && readerFullscreenRef.current) void toggleReaderFullscreen(false);
  }, [centerMode, toggleReaderFullscreen]);

  const readerControls = (
    <div className="kuraso-view-switch" role="group" aria-label={tr("Reading view")}>
      {(
        [
          ["pdf", FileText, tr("PDF")],
          ["split", Columns2, tr("PDF + Reflow")],
          ["reflow", BookOpenText, tr("Reflow")],
        ] as const
      ).map(([mode, Icon, label]) => (
        <button
          key={mode}
          type="button"
          className="kuraso-view-switch-btn"
          data-active={readerView === mode ? "true" : "false"}
          aria-pressed={readerView === mode}
          title={`${label} (Ctrl+R)`}
          onClick={() => setReaderView(mode)}
        >
          <Icon size={14} />
          <span>{label}</span>
        </button>
      ))}
      <button
        type="button"
        className="kuraso-view-switch-btn"
        data-active={readerFullscreen ? "true" : "false"}
        title={readerFullscreen ? tr("Exit full screen (Esc)") : tr("Full screen (F11)")}
        aria-label={readerFullscreen ? tr("Exit full screen (Esc)") : tr("Full screen (F11)")}
        onClick={() => void toggleReaderFullscreen()}
      >
        {readerFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
    </div>
  );

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
      } else if (mod && e.key.toLowerCase() === "r" && centerMode === "reader" && activeTabId) {
        e.preventDefault();
        setReaderView((v) => (v === "pdf" ? "split" : v === "split" ? "reflow" : "pdf"));
      } else if (e.key === "F11" && centerMode === "reader" && activeTabId) {
        e.preventDefault();
        void toggleReaderFullscreen();
      } else if (e.key === "Escape" && readerFullscreen) {
        void toggleReaderFullscreen(false);
      } else if (e.key === "F11") {
        e.preventDefault();
        setFocusMode((v) => {
          const next = !v;
          setLeftOpen(!next);
          setRightOpen(!next);
          return next;
        });
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
  }, [activeTabId, tabs, centerMode, readerFullscreen, toggleReaderFullscreen]);

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "open-pdf",
        label: tr("Import / Open PDF file…"),
        shortcut: "Ctrl+O",
        run: () => fileInputRef.current?.click(),
      },
      {
        id: "import-doi",
        label: tr("Import paper by DOI or arXiv ID…"),
        run: () => setImportModalOpen(true),
      },
      {
        id: "go-library",
        label: tr("Show Library view"),
        shortcut: "Ctrl+Shift+F",
        run: () => setCenterMode("library"),
      },
      {
        id: "export-md",
        label: t.exportMd,
        run: handleExportMarkdown,
      },
      {
        id: "export-bib",
        label: t.exportBib,
        run: handleExportBibtex,
      },
      {
        id: "switch-lang-en",
        label: "Language: English (LTR)",
        run: () => setUiLang("en"),
      },
      {
        id: "switch-lang-fr",
        label: "Langue : Français (LTR)",
        run: () => setUiLang("fr"),
      },
      {
        id: "switch-lang-ar",
        label: "اللغة: العربية (RTL)",
        run: () => setUiLang("ar"),
      },
      {
        id: "ai-settings",
        label: tr("Configure AI provider (BYOK / Ollama)…"),
        run: () => setAiSettingsOpen(true),
      },
      {
        id: "cycle-theme",
        label: tr("Switch theme (current: {theme})", { theme: tr(theme) }),
        run: cycleTheme,
      },
      {
        id: "toggle-left",
        label: leftOpen ? tr("Hide Library panel") : tr("Show Library panel"),
        shortcut: "Ctrl+[",
        run: () => setLeftOpen((v) => !v),
      },
      {
        id: "toggle-right",
        label: rightOpen ? tr("Hide Context panel") : tr("Show Context panel"),
        shortcut: "Ctrl+]",
        run: () => setRightOpen((v) => !v),
      },
      ...(activeTab
        ? [
            {
              id: "find-in-paper",
              label: tr("Find in current paper"),
              shortcut: "Ctrl+F",
              run: () => {
                setCenterMode("reader");
                setSearchOpen(true);
              },
            },
            {
              id: "toggle-crop",
              label: activeTab.marginCrop ? tr("Disable margin crop") : tr("Enable smart margin crop"),
              run: () => updateActiveTab((t) => ({ ...t, marginCrop: !t.marginCrop })),
            },
          ]
        : []),
    ],
    [
      theme,
      leftOpen,
      rightOpen,
      activeTab,
      cycleTheme,
      updateActiveTab,
      t.exportMd,
      t.exportBib,
      handleExportMarkdown,
      handleExportBibtex,
      uiLang,
    ],
  );

  return (
    <div
      className="kuraso-shell"
      data-reader-fullscreen={readerFullscreen && centerMode === "reader" ? "true" : "false"}
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
      <input
        ref={bibInputRef}
        type="file"
        accept=".bib,application/x-bibtex,text/plain"
        style={{ display: "none" }}
        onChange={(e) => {
          void handleImportBibtexFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {/* Top Bar */}
      <header className="kuraso-topbar">
        <div className="kuraso-brand">
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Toggle Library (Ctrl+[)")}
            onClick={() => setLeftOpen((v) => !v)}
          >
            <PanelLeft size={16} />
          </button>
          <span className="kuraso-brand-tile" aria-hidden="true">
            k
          </span>
          <span className="kuraso-brand-word">kuraso</span>
        </div>

        <button
          type="button"
          className="kuraso-search-trigger"
          onClick={() => setPaletteOpen(true)}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Search size={14} />
            <span>{t.searchOrCommand}</span>
          </span>
          <kbd className="kuraso-kbd">Ctrl+K</kbd>
        </button>

        <div className="kuraso-topbar-actions">
          {centerMode === "reader" && activeTab && (
            <>
              <button
                type="button"
                className="kuraso-icon-btn"
                data-active={splitNotesView ? "true" : "false"}
                title={tr("Toggle Split View (Paper + Notes)")}
                onClick={() => setSplitNotesView((v) => !v)}
              >
                <Columns2 size={14} />
                <span>{tr("Split")}</span>
              </button>
            </>
          )}
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Knowledge Graph")}
            onClick={() => setGraphOpen(true)}
          >
            <Network size={15} />
            <span>{tr("Graph")}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Research Projects (Thesis / Paper Workspaces)")}
            onClick={() => setProjectsOpen(true)}
          >
            <Briefcase size={15} />
            <span>{tr("Projects ({n})", { n: projects.length })}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={t.exportMd}
            onClick={handleExportMarkdown}
          >
            <Download size={15} />
            <bdi dir="ltr">.md</bdi>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={t.exportBib}
            onClick={handleExportBibtex}
          >
            <Download size={15} />
            <bdi dir="ltr">.bib</bdi>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Import by DOI or arXiv ID")}
            onClick={() => setImportModalOpen(true)}
          >
            <Plus size={15} />
            <span>{t.doiArxiv}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Import PDF (Ctrl+O)")}
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen size={16} />
            <span>{t.importPdf}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Switch interface language (EN / FR / العربية)")}
            onClick={() => setUiLang((l) => (l === "en" ? "fr" : l === "fr" ? "ar" : "en"))}
          >
            <Globe size={15} />
            <span>{t.langBadge}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Theme: {theme}", { theme: tr(theme) })}
            onClick={cycleTheme}
          >
            {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
            <span style={{ textTransform: "capitalize" }}>{tr(theme)}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("AI Settings (BYOK / Ollama)")}
            onClick={() => setAiSettingsOpen(true)}
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Toggle Context panel (Ctrl+])")}
            onClick={() => setRightOpen((v) => !v)}
          >
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      {availableUpdate && (
        <div className="kuraso-update-banner" role="status">
          <span>{tr("Kuraso {version} is available.", { version: `v${availableUpdate.version}` })}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              className="kuraso-btn-primary"
              style={{ paddingBlock: 4, paddingInline: 10, fontSize: "0.78rem" }}
              disabled={installingUpdate}
              onClick={() => void handleInstallUpdate()}
            >
              {installingUpdate ? tr("Downloading update…") : tr("Update & Restart")}
            </button>
            <button
              type="button"
              className="kuraso-icon-btn"
              style={{ height: 26, paddingInline: 8, fontSize: "0.78rem" }}
              disabled={installingUpdate}
              onClick={() => setAvailableUpdate(null)}
            >
              {tr("Later")}
            </button>
          </div>
        </div>
      )}

      {/* 3-Pane Workspace */}
      <div className="kuraso-workspace">
        {leftOpen && (
          <aside className="kuraso-sidebar-left" aria-label={tr("Library")}>
            <div>
              <div className="kuraso-section-label">{t.library}</div>
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
                <span>
                  {t.allPapers} ({papers.length})
                </span>
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
                <span>{t.inbox}</span>
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
                <span>{t.reading}</span>
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
                <span>{t.important}</span>
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
                  {t.collections}
                </span>
                <button
                  type="button"
                  className="kuraso-icon-btn"
                  style={{ height: 22, paddingInline: 4 }}
                  title={tr("New collection")}
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
                    placeholder={t.newCollectionPlaceholder}
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
                <p style={{ fontSize: 13, color: "var(--kuraso-text-muted)", paddingInline: 10, margin: 0 }}>
                  {t.clickPlusCollections}
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
                      <bdi className="kuraso-tab-title" dir="auto">{col.name}</bdi>
                      <span style={{ marginInlineStart: "auto", fontFamily: "var(--kuraso-font-mono)", fontSize: 11, opacity: 0.75 }}>
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
                          ? tr("Local AI only (confidential)")
                          : tr("Click to restrict this collection to Local AI only")
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
                <div className="kuraso-section-label">{t.openTabs} ({tabs.length})</div>
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
                    <bdi className="kuraso-tab-title" dir="auto">{tab.title}</bdi>
                  </button>
                ))}
              </div>
            )}

            <div className="kuraso-sidebar-footer">
              <span className="kuraso-hand" aria-hidden="true">
                read · mark · keep
              </span>
              <span dir="ltr">Format v{KURASO_FORMAT_VERSION} · v2.0</span>
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
                <span>{tr("Library")}</span>
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
                  <bdi className="kuraso-tab-title" dir="auto">{tab.title}</bdi>
                  <button
                    type="button"
                    className="kuraso-tab-close"
                    aria-label={tr("Close {title}", { title: tab.title })}
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
            <div className="kuraso-split-reader" data-view={readerView}>
              {readerView !== "reflow" && (
                <div className="kuraso-reader-pane">
                  <Suspense fallback={<div className="kuraso-panel-hint" style={{ padding: 24 }}>{tr("Opening PDF…")}</div>}>
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
                      onUpdateAnnotation={handleUpdateAnnotation}
                      onExplainSelection={handleExplainSelection}
                      onDocumentLoaded={handleDocumentLoaded}
                      toolbarExtra={readerControls}
                      fitWidthKey={`${activeTab.id}:${readerView}:${readerFullscreen}`}
                    />
                  </Suspense>
                </div>
              )}
              {readerView !== "pdf" && (
                <div className="kuraso-reader-pane" data-pane="reflow">
                  <CleanReadingView
                    title={activeTab.title}
                    structure={activeTab.structure}
                    annotations={activeAnnotations}
                    focusMode={focusMode}
                    onToggleFocusMode={() => {
                      setFocusMode((v) => {
                        const next = !v;
                        setLeftOpen(!next);
                        setRightOpen(!next);
                        return next;
                      });
                    }}
                    onExitCleanMode={() => setReaderView("pdf")}
                    compact={readerView === "split"}
                    currentPage={activeTab.currentPage}
                    onJumpToPage={(page) => {
                      if (readerView === "reflow") setReaderView("split");
                      setJumpToPage(page);
                    }}
                    onCreateAnnotation={handleCreateAnnotation}
                    onExplainSelection={handleExplainSelection}
                    toolbarExtra={readerView === "reflow" ? readerControls : null}
                  />
                </div>
              )}
              {splitNotesView && (
                <div className="kuraso-split-notes">
                  <NotesEditor
                    markdown={activeNotes}
                    onChange={handleNotesChange}
                    backlinks={activeBacklinks}
                    onFollowWikiLink={handleFollowWikiLink}
                    onOpenBacklinkSource={handleOpenBacklinkSource}
                  />
                </div>
              )}
            </div>
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
              onRequestImportBibtex={() => bibInputRef.current?.click()}
              onOpenCollectionTools={() => setCollectionToolsOpen(true)}
              onNotify={showToast}
              hasBytesMap={hasBytesMap}
            />
          )}
        </main>

        {/* Right Context Panel */}
        {rightOpen && (
          <aside className="kuraso-sidebar-right" aria-label={tr("Context")}>
            <div className="kuraso-right-tabs">
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "outline" ? "true" : "false"}
                onClick={() => setRightTab("outline")}
              >
                {t.outline}
              </button>
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "annotations" ? "true" : "false"}
                onClick={() => setRightTab("annotations")}
              >
                {t.highlights} ({activeAnnotations.length})
              </button>
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "notes" ? "true" : "false"}
                onClick={() => setRightTab("notes")}
              >
                {t.notes}
              </button>
              <button
                type="button"
                className="kuraso-right-tab"
                data-active={rightTab === "assistant" ? "true" : "false"}
                onClick={() => setRightTab("assistant")}
              >
                {t.ai}
              </button>
            </div>

            <div className="kuraso-right-body">
              {rightTab === "outline" && (
                <div>
                  {!activeTab && (
                    <p className="kuraso-panel-hint">
                      {t.openPdfOutlineHint}
                    </p>
                  )}
                  {activeTab && activeTab.outline.length === 0 && (
                    <p className="kuraso-panel-hint">
                      {t.noOutlineHint}
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
                        <bdi className="kuraso-outline-title" dir="auto">{item.title}</bdi>
                        <span className="kuraso-outline-page" dir="ltr">
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
                  <p className="kuraso-panel-hint">
                    Open a PDF to create and gather highlights.
                  </p>
                ))}

              {rightTab === "notes" &&
                (activeTab ? (
                  <NotesEditor
                    markdown={activeNotes}
                    onChange={handleNotesChange}
                    backlinks={activeBacklinks}
                    onFollowWikiLink={handleFollowWikiLink}
                    onOpenBacklinkSource={handleOpenBacklinkSource}
                  />
                ) : (
                  <p className="kuraso-panel-hint">
                    Open a PDF to edit its Markdown notes (`notes.md`).
                  </p>
                ))}

              {rightTab === "assistant" &&
                (activeTab ? (
                  <AssistantPanel
                    paperId={activeTab.id}
                    paperTitle={activeTab.title}
                    structure={activeTab.structure}
                    annotations={activeAnnotations}
                    recipes={recipes}
                    scanned={activeTab.scanned}
                    localAiOnly={collections.some(
                      (c) => c.localAiOnly && c.paperIds.includes(activeTab.id),
                    )}
                    settings={aiSettings}
                    apiKey={sessionApiKeys[aiSettings.providerId] ?? ""}
                    keyReady={aiKeyReady}
                    pendingExplainText={pendingExplainText}
                    onClearPendingExplain={() => setPendingExplainText(null)}
                    onOpenSettings={() => setAiSettingsOpen(true)}
                    onJumpToPage={(page) => {
                      setCenterMode("reader");
                      setJumpToPage(page);
                    }}
                    onExportAnki={(tsv) => {
                      downloadTextFile(`${activeTab.title}-anki.tsv`, tsv, "text/tab-separated-values;charset=utf-8");
                      showToast(tr("Downloaded Anki flashcards (.tsv)"));
                    }}
                  />
                ) : (
                  <p className="kuraso-panel-hint">
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

      {aiSettingsOpen && (
        <Suspense fallback={null}>
          <AISettingsModal
            open={aiSettingsOpen}
            settings={aiSettings}
            hasKey={
              Boolean(sessionApiKeys[aiSettings.providerId]) || Boolean(keychainProviders[aiSettings.providerId])
            }
            sessionApiKey={sessionApiKeys[aiSettings.providerId]}
            onClose={() => setAiSettingsOpen(false)}
            onSave={(nextSettings, newApiKey) => {
              setAiSettings(nextSettings);
              saveAISettings(nextSettings);
              void (async () => {
                if (newApiKey) {
                  try {
                    const inKeychain = await saveProviderKey(nextSettings.providerId, newApiKey);
                    if (inKeychain) {
                      setKeychainProviders((prev) => ({ ...prev, [nextSettings.providerId]: true }));
                    } else {
                      setSessionApiKeys((prev) => ({ ...prev, [nextSettings.providerId]: newApiKey }));
                    }
                  } catch (err) {
                    // Keychain unavailable: keep the key for this session so AI still works.
                    setSessionApiKeys((prev) => ({ ...prev, [nextSettings.providerId]: newApiKey }));
                    showToast(err instanceof Error ? err.message : tr("Key kept for this session only."));
                    return;
                  }
                } else {
                  const stored = await hasProviderKey(nextSettings.providerId);
                  setKeychainProviders((prev) => ({ ...prev, [nextSettings.providerId]: stored }));
                }
                showToast(
                  nextSettings.enabled ? tr("AI ready: {provider}", { provider: nextSettings.label }) : tr("AI assistant disabled."),
                );
              })();
            }}
            onRemoveKey={() => {
              const providerId = aiSettings.providerId;
              setSessionApiKeys((prev) => {
                const copy = { ...prev };
                delete copy[providerId];
                return copy;
              });
              void deleteProviderKey(providerId)
                .then(() => {
                  setKeychainProviders((prev) => ({ ...prev, [providerId]: false }));
                  showToast(tr("API key removed."));
                })
                .catch((err: unknown) =>
                  showToast(err instanceof Error ? err.message : tr("Could not remove the key.")),
                );
            }}
          />
        </Suspense>
      )}

      {collectionToolsOpen && (
        <Suspense fallback={null}>
          <CollectionToolsModal
            open={collectionToolsOpen}
            collectionName={libraryViewTitle}
            papers={visiblePapers}
            localAiOnly={
              libraryFilter.kind === "collection"
                ? Boolean(collections.find((c) => c.id === libraryFilter.collectionId)?.localAiOnly)
                : collections.some((c) => c.localAiOnly)
            }
            settings={aiSettings}
            apiKey={sessionApiKeys[aiSettings.providerId] ?? ""}
            keyReady={aiKeyReady}
            onClose={() => setCollectionToolsOpen(false)}
            onOpenSettings={() => {
              setCollectionToolsOpen(false);
              setAiSettingsOpen(true);
            }}
          />
        </Suspense>
      )}

      {graphOpen && (
        <Suspense fallback={null}>
          <KnowledgeGraphModal
            open={graphOpen}
            papers={papers}
            collections={collections}
            projects={projects}
            notesByPaper={notesByPaper}
            onClose={() => setGraphOpen(false)}
            onOpenPaper={openPaperInReader}
          />
        </Suspense>
      )}

      {projectsOpen && (
        <Suspense fallback={null}>
          <ProjectsModal
            open={projectsOpen}
            projects={projects}
            collections={collections}
            papers={papers}
            onClose={() => setProjectsOpen(false)}
            onSaveProjects={(next) => {
              setProjects(next);
              saveProjects(next);
            }}
            onExportBibtex={(filename, content) => {
              downloadTextFile(filename, content, "application/x-bibtex;charset=utf-8");
              showToast(tr("Exported {file}", { file: filename }));
            }}
          />
        </Suspense>
      )}

      <OnboardingModal
        open={onboardingOpen}
        language={uiLang}
        onLanguageChange={setUiLang}
        onComplete={handleOnboardingComplete}
      />

      {toast && (
        <div className="kuraso-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
