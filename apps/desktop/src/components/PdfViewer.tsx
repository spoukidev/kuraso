import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type {
  Annotation,
  AnnotationType,
  HighlightColor,
  PaperStructure,
  PdfRect,
} from "@kuraso/formats";
import {
  createAnnotation,
  getAnnotationAnchors,
  SEMANTIC_LABELS,
} from "@kuraso/annotations";
import {
  pdfToViewport,
  searchPageTexts,
  segmentPagesToStructure,
  viewportToPdf,
  type ExtractedPageLines,
  type PageMetrics,
  type PageTextEntry,
  type SearchMatch,
} from "@kuraso/reader";
import { SEMANTIC_HIGHLIGHT_DEFAULTS } from "@kuraso/ui";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Scissors,
  Search,
  Strikethrough,
  Underline,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { OpenDocumentTab, OutlineNode } from "../state/readerStore";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

interface PendingSelection {
  page: number;
  exact: string;
  pdfRect: PdfRect;
  toolbarX: number;
  toolbarY: number;
}

interface PdfViewerProps {
  doc: OpenDocumentTab;
  annotations: Annotation[];
  jumpToPage: number | null;
  searchOpen: boolean;
  onCloseSearch: () => void;
  onToggleSearch: () => void;
  onZoomChange: (zoom: number) => void;
  onToggleCrop: () => void;
  onPageChange: (page: number) => void;
  onCreateAnnotation: (ann: Annotation, focusNotes?: boolean) => void;
  onExplainSelection?: (text: string) => void;
  onDocumentLoaded: (meta: {
    pageCount: number;
    scanned: boolean;
    outline: OutlineNode[];
    structure: PaperStructure;
  }) => void;
}

interface PositionedSpan {
  text: string;
  left: number;
  top: number;
  fontSize: number;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  marginCrop: boolean;
  pageAnnotations: Annotation[];
  onVisible: (pageNumber: number) => void;
  onTextSelected: (sel: PendingSelection | null) => void;
}

function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  zoom,
  marginCrop,
  pageAnnotations,
  onVisible,
  onTextSelected,
}: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 612, height: 792 });
  const [metrics, setMetrics] = useState<PageMetrics>({
    width: 612,
    height: 792,
    rotation: 0,
    scale: zoom,
  });
  const [spans, setSpans] = useState<PositionedSpan[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.45) {
            onVisible(pageNumber);
          }
        }
      },
      { threshold: [0.45] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, onVisible]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function render() {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: zoom });
      const rot = ((page.rotate % 360) + 360) % 360;
      const safeRot: 0 | 90 | 180 | 270 =
        rot === 90 || rot === 180 || rot === 270 ? rot : 0;

      setSize({ width: viewport.width, height: viewport.height });
      setMetrics({
        width: baseViewport.width,
        height: baseViewport.height,
        rotation: safeRot,
        scale: zoom,
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch {
        // Ignore cancelled render tasks.
      }

      if (cancelled) return;
      const content = await page.getTextContent();
      if (cancelled) return;

      const positioned: PositionedSpan[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.max(8, Math.hypot(tx[2] ?? 0, tx[3] ?? 10));
        positioned.push({
          text: item.str,
          left: tx[4] ?? 0,
          top: (tx[5] ?? 0) - fontSize,
          fontSize,
        });
      }
      setSpans(positioned);
    }

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, zoom]);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const exact = sel.toString().replace(/\s+/g, " ").trim();
    if (!exact || !pageWrapRef.current) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const wrapRect = pageWrapRef.current.getBoundingClientRect();

    if (rect.width < 2 || rect.height < 2) return;
    const vpBox = {
      left: Math.max(0, rect.left - wrapRect.left),
      top: Math.max(0, rect.top - wrapRect.top),
      width: rect.width,
      height: rect.height,
    };

    const pdfRect = viewportToPdf(vpBox, metrics);
    onTextSelected({
      page: pageNumber,
      exact,
      pdfRect,
      toolbarX: rect.left + rect.width / 2,
      toolbarY: Math.max(54, rect.top - 44),
    });
  }

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
    >
      <div
        ref={pageWrapRef}
        className="kuraso-pdf-page-wrapper"
        data-crop={marginCrop ? "true" : "false"}
        style={{ width: size.width, height: size.height }}
        onMouseUp={handleMouseUp}
      >
        <canvas ref={canvasRef} />

        {/* Rendered highlights / underlines / strikethroughs via locked pdfToViewport */}
        <div className="kuraso-annotation-layer" aria-hidden="true">
          {pageAnnotations.map((ann) => {
            const style = SEMANTIC_HIGHLIGHT_DEFAULTS[ann.color];
            const anchors = getAnnotationAnchors(ann).filter((a) => a.page === pageNumber);
            return anchors.map((anchor, idx) => {
              const box = pdfToViewport(anchor.rect, metrics);
              const isUnderline = ann.type === "underline";
              const isStrike = ann.type === "strikethrough";
              return (
                <div
                  key={`${ann.id}-${idx}`}
                  className="kuraso-highlight-box"
                  style={{
                    left: box.left,
                    top: box.top,
                    width: box.width,
                    height: box.height,
                    backgroundColor: isUnderline || isStrike ? "transparent" : style.cssBg,
                    borderBottom: isUnderline
                      ? `2px solid ${style.cssBorder}`
                      : isStrike
                        ? "none"
                        : `1.5px solid ${style.cssBorder}`,
                    borderTop: isStrike ? `2px solid ${style.cssBorder}` : "none",
                    transform: isStrike ? "translateY(50%)" : undefined,
                  }}
                />
              );
            });
          })}
        </div>

        {/* Transparent selectable text layer */}
        <div className="kuraso-text-layer">
          {spans.map((sp, i) => (
            <span
              key={i}
              style={{
                left: sp.left,
                top: sp.top,
                fontSize: `${sp.fontSize}px`,
              }}
            >
              {sp.text}
            </span>
          ))}
        </div>
      </div>
      <span className="kuraso-pdf-page-number">Page {pageNumber}</span>
    </div>
  );
}

async function flattenOutline(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  items: Awaited<ReturnType<pdfjsLib.PDFDocumentProxy["getOutline"]>> | null,
  level = 1,
): Promise<OutlineNode[]> {
  if (!items || items.length === 0) return [];
  const result: OutlineNode[] = [];

  for (const item of items) {
    let page = 1;
    try {
      let dest = item.dest;
      if (typeof dest === "string") {
        dest = await pdfDoc.getDestination(dest);
      }
      if (Array.isArray(dest) && dest[0]) {
        const idx = await pdfDoc.getPageIndex(dest[0]);
        page = idx + 1;
      }
    } catch {
      page = 1;
    }

    result.push({
      title: item.title.trim() || "Untitled section",
      page,
      level,
      source: "toc",
    });

    if (item.items && item.items.length > 0) {
      const children = await flattenOutline(pdfDoc, item.items, Math.min(level + 1, 4));
      result.push(...children);
    }
  }

  return result;
}

export function PdfViewer({
  doc,
  annotations,
  jumpToPage,
  searchOpen,
  onCloseSearch,
  onToggleSearch,
  onZoomChange,
  onToggleCrop,
  onPageChange,
  onCreateAnnotation,
  onExplainSelection,
  onDocumentLoaded,
}: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageTexts, setPageTexts] = useState<PageTextEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [pendingSel, setPendingSel] = useState<PendingSelection | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoredPositionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setPdfDoc(null);
    setPageTexts([]);
    setPendingSel(null);

    const dataCopy = new Uint8Array(doc.bytes);
    const loadingTask = pdfjsLib.getDocument({
      data: dataCopy,
      isEvalSupported: false,
      disableFontFace: false,
    });

    void loadingTask.promise
      .then(async (loaded) => {
        if (cancelled) {
          void loaded.destroy();
          return;
        }
        setPdfDoc(loaded);

        const rawOutline = await loaded.getOutline().catch(() => null);
        const tocOutline = await flattenOutline(loaded, rawOutline);

        const texts: PageTextEntry[] = [];
        const extractedPages: ExtractedPageLines[] = [];
        let totalChars = 0;
        const samplePages = Math.min(loaded.numPages, 200);

        for (let p = 1; p <= samplePages; p++) {
          if (cancelled) return;
          const page = await loaded.getPage(p);
          const content = await page.getTextContent();
          const lines: ExtractedPageLines["lines"] = [];
          const lineParts: string[] = [];

          for (const it of content.items) {
            if (!("str" in it)) continue;
            const s = it.str.trim();
            if (!s) continue;
            lineParts.push(s);
            const h = Math.abs(it.height || it.transform[3] || 10);
            const x = it.transform[4] ?? 0;
            const y = it.transform[5] ?? 0;
            const w = Math.max(4, it.width || s.length * h * 0.5);
            lines.push({
              text: s,
              fontHeight: h,
              rect: [x, y, x + w, y + h],
            });
          }

          const joined = lineParts.join(" ");
          totalChars += joined.length;
          texts.push({ page: p, text: joined });
          extractedPages.push({ page: p, lines });
        }

        if (!cancelled) {
          const structure = segmentPagesToStructure(extractedPages);
          const mergedOutline: OutlineNode[] =
            tocOutline.length > 0
              ? tocOutline
              : structure.headings.map((h) => ({
                  title: h.title,
                  page: h.page,
                  level: h.level,
                  source: "heuristic" as const,
                }));

          setPageTexts(texts);
          onDocumentLoaded({
            pageCount: loaded.numPages,
            scanned: totalChars < 20,
            outline: mergedOutline,
            structure,
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to open PDF");
        }
      });

    return () => {
      cancelled = true;
      void loadingTask.destroy();
    };
  }, [doc.id, doc.bytes, onDocumentLoaded]);

  useEffect(() => {
    if (!pdfDoc || restoredPositionRef.current === doc.id) return;
    restoredPositionRef.current = doc.id;
    if (doc.currentPage > 1) {
      const target = scrollRef.current?.querySelector(
        `[data-page-number="${doc.currentPage}"]`,
      );
      target?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [pdfDoc, doc.id, doc.currentPage]);

  useEffect(() => {
    if (!jumpToPage || !scrollRef.current) return;
    const target = scrollRef.current.querySelector(`[data-page-number="${jumpToPage}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [jumpToPage]);

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  const commitSelection = useCallback(
    (color: HighlightColor, type: AnnotationType = "highlight", focusNotes = false) => {
      if (!pendingSel) return;
      const matchedParagraph =
        doc.structure?.paragraphs.find((p) =>
          p.text.toLowerCase().includes(pendingSel.exact.toLowerCase()),
        )?.id ?? null;

      const ann = createAnnotation({
        type,
        color,
        exact: pendingSel.exact,
        anchors: [{ page: pendingSel.page, rect: pendingSel.pdfRect }],
        paragraph: matchedParagraph,
      });

      onCreateAnnotation(ann, focusNotes);
      window.getSelection()?.removeAllRanges();
      setPendingSel(null);
    },
    [pendingSel, doc.structure, onCreateAnnotation],
  );

  // Keyboard shortcuts 1–5 (semantic highlight colors) and N (highlight + margin note)
  useEffect(() => {
    if (!pendingSel) return;
    const activeSel = pendingSel;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const color = HIGHLIGHT_COLORS[Number(e.key) - 1] ?? "yellow";
        commitSelection(color, "highlight", false);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        commitSelection("yellow", "highlight", true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e" && onExplainSelection) {
        e.preventDefault();
        onExplainSelection(activeSel.exact);
        window.getSelection()?.removeAllRanges();
        setPendingSel(null);
      } else if (e.key === "Escape") {
        setPendingSel(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingSel, commitSelection, onExplainSelection]);

  const matches: SearchMatch[] = useMemo(
    () => searchPageTexts(pageTexts, searchQuery),
    [pageTexts, searchQuery],
  );

  useEffect(() => {
    setActiveMatchIdx(0);
    const first = matches[0];
    if (first && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-page-number="${first.page}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [matches]);

  function stepMatch(delta: number) {
    if (matches.length === 0) return;
    const next = (activeMatchIdx + delta + matches.length) % matches.length;
    setActiveMatchIdx(next);
    const match = matches[next];
    if (match && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-page-number="${match.page}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const pageNumbers = useMemo(() => {
    if (!pdfDoc) return [];
    return Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);
  }, [pdfDoc]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
      <div className="kuraso-reader-toolbar">
        <div className="kuraso-reader-toolbar-group">
          <span>
            p. <strong>{doc.currentPage}</strong> / {doc.pageCount || "…"}
          </span>
          {doc.structure && (
            <span style={{ color: "var(--kuraso-text-muted)", fontSize: "0.75rem" }}>
              · {doc.structure.paragraphs.length} paragraphs
            </span>
          )}
        </div>

        <div className="kuraso-reader-toolbar-group">
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Zoom out"
            onClick={() => onZoomChange(Math.max(0.5, Number((doc.zoom - 0.15).toFixed(2))))}
          >
            <ZoomOut size={15} />
          </button>
          <span style={{ minWidth: 44, textAlign: "center" }}>{Math.round(doc.zoom * 100)}%</span>
          <button
            type="button"
            className="kuraso-icon-btn"
            title="Zoom in"
            onClick={() => onZoomChange(Math.min(2.5, Number((doc.zoom + 0.15).toFixed(2))))}
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            data-active={doc.marginCrop ? "true" : "false"}
            title="Toggle smart margin crop"
            onClick={onToggleCrop}
          >
            <Scissors size={15} />
            <span>Crop</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            data-active={searchOpen ? "true" : "false"}
            title="Search in document (Ctrl+F)"
            onClick={onToggleSearch}
          >
            <Search size={15} />
          </button>
        </div>
      </div>

      {doc.scanned && (
        <div className="kuraso-banner-warning" role="status">
          <AlertTriangle size={16} />
          <span>No selectable text found. Highlights and AI are off for this file.</span>
        </div>
      )}

      {searchOpen && (
        <div className="kuraso-search-bar">
          <Search size={15} />
          <input
            ref={searchInputRef}
            className="kuraso-input"
            style={{ flex: 1, maxWidth: 320 }}
            placeholder="Find in paper…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") stepMatch(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") onCloseSearch();
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--kuraso-text-muted)" }}>
            {matches.length > 0 ? `${activeMatchIdx + 1} / ${matches.length}` : "0 matches"}
          </span>
          <button type="button" className="kuraso-icon-btn" onClick={() => stepMatch(-1)}>
            <ChevronUp size={15} />
          </button>
          <button type="button" className="kuraso-icon-btn" onClick={() => stepMatch(1)}>
            <ChevronDown size={15} />
          </button>
          <button type="button" className="kuraso-icon-btn" onClick={onCloseSearch}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Floating Selection Toolbar */}
      {pendingSel && (
        <div
          className="kuraso-selection-toolbar"
          style={{ left: pendingSel.toolbarX, top: pendingSel.toolbarY }}
          role="toolbar"
          aria-label="Highlight selection"
        >
          {HIGHLIGHT_COLORS.map((c, idx) => {
            const st = SEMANTIC_HIGHLIGHT_DEFAULTS[c];
            return (
              <button
                key={c}
                type="button"
                className="kuraso-color-dot"
                title={`${SEMANTIC_LABELS[c]} (key ${idx + 1})`}
                style={{ backgroundColor: st.cssBg, borderColor: st.cssBorder }}
                onClick={() => commitSelection(c, "highlight", false)}
              />
            );
          })}
          <button
            type="button"
            className="kuraso-icon-btn"
            style={{ height: 24, paddingInline: 5 }}
            title="Underline"
            onClick={() => commitSelection("blue", "underline", false)}
          >
            <Underline size={13} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            style={{ height: 24, paddingInline: 5 }}
            title="Strikethrough"
            onClick={() => commitSelection("red", "strikethrough", false)}
          >
            <Strikethrough size={13} />
          </button>
          <button
            type="button"
            className="kuraso-chip"
            title="Highlight & add margin note (key N)"
            onClick={() => commitSelection("yellow", "highlight", true)}
          >
            + Note
          </button>
          {onExplainSelection && (
            <button
              type="button"
              className="kuraso-chip"
              data-active="true"
              title="Explain selection with your AI (Ctrl+E)"
              onClick={() => {
                onExplainSelection(pendingSel.exact);
                window.getSelection()?.removeAllRanges();
                setPendingSel(null);
              }}
            >
              Explain
            </button>
          )}
          <button
            type="button"
            className="kuraso-icon-btn"
            style={{ height: 22, paddingInline: 4 }}
            onClick={() => setPendingSel(null)}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="kuraso-pdf-scroll kuraso-pdf-viewport"
        onMouseDown={() => setPendingSel(null)}
      >
        {loadError && (
          <div style={{ color: "var(--kuraso-hl-red-border)", padding: 24 }}>
            Could not open PDF: {loadError}
          </div>
        )}
        {!loadError && !pdfDoc && (
          <div style={{ color: "var(--kuraso-text-muted)", padding: 24 }}>Opening PDF…</div>
        )}
        {pdfDoc &&
          pageNumbers.map((pageNum) => (
            <PdfPageCanvas
              key={`${doc.id}-${pageNum}`}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              zoom={doc.zoom}
              marginCrop={doc.marginCrop}
              pageAnnotations={annotations.filter((a) =>
                getAnnotationAnchors(a).some((an) => an.page === pageNum),
              )}
              onVisible={onPageChange}
              onTextSelected={setPendingSel}
            />
          ))}
      </div>
    </div>
  );
}
