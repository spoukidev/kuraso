import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KurasoTheme } from "@kuraso/ui";
import { KURASO_FORMAT_VERSION } from "@kuraso/formats";
import {
  BookOpen,
  FileText,
  FolderOpen,
  Inbox,
  Moon,
  PanelLeft,
  PanelRight,
  Search,
  Sparkles,
  Star,
  Sun,
  X,
} from "lucide-react";
import { PdfViewer } from "./components/PdfViewer";
import { CommandPalette, type PaletteCommand } from "./components/CommandPalette";
import {
  loadSavedPositions,
  loadSavedTheme,
  makeDocumentKey,
  saveReadingPosition,
  saveTheme,
  type OpenDocumentTab,
  type OutlineNode,
} from "./state/readerStore";

type RightTab = "outline" | "annotations" | "assistant";

export function App() {
  const [theme, setTheme] = useState<KurasoTheme>(() => loadSavedTheme());
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<RightTab>("outline");
  const [tabs, setTabs] = useState<OpenDocumentTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [jumpToPage, setJumpToPage] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId],
  );

  const openPdfFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) return;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const id = makeDocumentKey(file.name, bytes.byteLength);
    const savedPage = loadSavedPositions()[id] ?? 1;

    setTabs((prev) => {
      if (prev.some((t) => t.id === id)) return prev;
      return [
        ...prev,
        {
          id,
          title: file.name.replace(/\.pdf$/i, ""),
          bytes,
          pageCount: 0,
          currentPage: savedPage,
          zoom: 1.2,
          marginCrop: false,
          scanned: false,
          outline: [],
        },
      ];
    });
    setActiveTabId(id);
    setJumpToPage(null);
  }, []);

  const openFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;
      for (const file of Array.from(fileList)) {
        await openPdfFile(file);
      }
    },
    [openPdfFile],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          setActiveTabId(remaining[remaining.length - 1]?.id ?? null);
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
    (meta: { pageCount: number; scanned: boolean; outline: OutlineNode[] }) => {
      updateActiveTab((t) => ({
        ...t,
        pageCount: meta.pageCount,
        scanned: meta.scanned,
        outline: meta.outline,
      }));
    },
    [updateActiveTab],
  );

  // Global keyboard shortcuts (Section 9.5)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if (mod && e.key.toLowerCase() === "f" && activeTabId) {
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
        if (next) setActiveTabId(next.id);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTabId, tabs]);

  const commands: PaletteCommand[] = useMemo(
    () => [
      {
        id: "open-pdf",
        label: "Open PDF file…",
        shortcut: "Ctrl+O",
        run: () => fileInputRef.current?.click(),
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
              run: () => setSearchOpen(true),
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
            title="Open PDF (Ctrl+O)"
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen size={16} />
            <span>Open</span>
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
              <button type="button" className="kuraso-nav-item" data-active="true">
                <Inbox size={15} />
                <span>Inbox</span>
              </button>
              <button type="button" className="kuraso-nav-item">
                <BookOpen size={15} />
                <span>Reading</span>
              </button>
              <button type="button" className="kuraso-nav-item">
                <Star size={15} />
                <span>Important</span>
              </button>
            </div>

            <div>
              <div className="kuraso-section-label">Open Papers ({tabs.length})</div>
              {tabs.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--kuraso-text-muted)", paddingInline: 8 }}>
                  Drop any PDF here or click Open.
                </p>
              ) : (
                tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className="kuraso-nav-item"
                    data-active={tab.id === activeTabId ? "true" : "false"}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    <FileText size={14} />
                    <span className="kuraso-tab-title">{tab.title}</span>
                  </button>
                ))
              )}
            </div>

            <div style={{ marginBlockStart: "auto", fontSize: "0.74rem", color: "var(--kuraso-text-muted)", paddingInline: 8 }}>
              Format v{KURASO_FORMAT_VERSION} · Phase 1
            </div>
          </aside>
        )}

        {/* Center Reader */}
        <main className="kuraso-center">
          {tabs.length > 0 && (
            <div className="kuraso-tabbar" role="tablist">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={tab.id === activeTabId}
                  className="kuraso-tab"
                  data-active={tab.id === activeTabId ? "true" : "false"}
                  onClick={() => setActiveTabId(tab.id)}
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

          {activeTab ? (
            <PdfViewer
              doc={activeTab}
              jumpToPage={jumpToPage}
              searchOpen={searchOpen}
              onCloseSearch={() => setSearchOpen(false)}
              onToggleSearch={() => setSearchOpen((v) => !v)}
              onZoomChange={(zoom) => updateActiveTab((t) => ({ ...t, zoom }))}
              onToggleCrop={() => updateActiveTab((t) => ({ ...t, marginCrop: !t.marginCrop }))}
              onPageChange={handlePageChange}
              onDocumentLoaded={handleDocumentLoaded}
            />
          ) : (
            <div className="kuraso-empty-state">
              <div className="kuraso-drop-card" data-dragging={dragging ? "true" : "false"}>
                <BookOpen size={36} strokeWidth={1.5} />
                <h2 style={{ margin: 0, fontFamily: "var(--kuraso-font-reading)", fontWeight: 600 }}>
                  A calm room for your research
                </h2>
                <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Drag and drop academic PDFs anywhere in this window, or open a file from disk.
                </p>
                <button
                  type="button"
                  className="kuraso-primary-btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderOpen size={16} />
                  <span>Open PDF (Ctrl+O)</span>
                </button>
              </div>
            </div>
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
                      No embedded outline found in this PDF. Heuristic heading detection arrives in
                      Phase 3.
                    </p>
                  )}
                  {activeTab &&
                    activeTab.outline.map((item, idx) => (
                      <button
                        key={`${item.title}-${idx}`}
                        type="button"
                        className="kuraso-outline-item"
                        style={{ paddingInlineStart: `${(item.level - 1) * 12 + 6}px` }}
                        onClick={() => setJumpToPage(item.page)}
                      >
                        <span>{item.title}</span>
                        <span style={{ color: "var(--kuraso-text-muted)", fontSize: "0.74rem" }}>
                          p.{item.page}
                        </span>
                      </button>
                    ))}
                </div>
              )}

              {rightTab === "annotations" && (
                <p style={{ fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                  Semantic highlights, margin notes, and Annotation Gathering arrive in Phase 3.
                </p>
              )}

              {rightTab === "assistant" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, fontSize: "0.86rem" }}>
                    <Sparkles size={15} />
                    <span>Grounded BYOK AI</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--kuraso-text-muted)" }}>
                    Bring your own API key (including free-tier options) or Ollama in Phase 4.
                  </p>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
