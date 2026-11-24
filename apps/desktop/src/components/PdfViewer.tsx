import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  getAnnotationQuote,
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
import { tr } from "../i18n/tr";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const HIGHLIGHT_COLORS: HighlightColor[] = ["yellow", "green", "blue", "red", "purple"];

interface PendingSelection {
  page: number;
  exact: string;
  /** One rectangle per line of selected text (never one box around the whole selection). */
  pdfRects: PdfRect[];
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
  onUpdateAnnotation?: (ann: Annotation) => void;
  onExplainSelection?: (text: string) => void;
  /** Extra controls at the end of the toolbar (view switch, full screen). */
  toolbarExtra?: ReactNode;
  /** When this value changes, shrink the zoom so a page fits the pane width (e.g. entering side by side). */
  fitWidthKey?: string;
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
  /** Horizontal stretch so the invisible text lines up glyph-for-glyph with the rendered PDF. */
  scaleX: number;
}

const TEXT_LAYER_FONT = "sans-serif";

interface ViewportBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Turn a DOM text range into one box per visual line, relative to the page wrapper.
 * getClientRects() returns a rect per text run (plus element boxes for fully-selected
 * spans); runs that share a line and touch are merged, but separate columns stay apart.
 */
function lineBoxesFromRange(range: Range, wrap: DOMRect, layer?: HTMLElement | null): ViewportBox[] {
  const raw = Array.from(range.getClientRects())
    .map((r) => ({
      left: Math.max(r.left, wrap.left) - wrap.left,
      top: Math.max(r.top, wrap.top) - wrap.top,
      right: Math.min(r.right, wrap.right) - wrap.left,
      bottom: Math.min(r.bottom, wrap.bottom) - wrap.top,
    }))
    .filter((r) => r.right - r.left > 1 && r.bottom - r.top > 1);
  if (raw.length === 0) return [];

  const heights = raw.map((r) => r.bottom - r.top).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? 0;
  // Drop container-sized boxes (taller than ~2 lines) that would paint a block.
  const runs = raw
    .filter((r) => r.bottom - r.top <= median * 1.8)
    .sort((a, b) => a.top - b.top || a.left - b.left);

  // Text runs on the whole page, to tell a wide justified word space (other lines have
  // text there) from a column gutter (no line crosses it).
  const pageRuns = layer
    ? Array.from(layer.children).map((el) => {
        const b = el.getBoundingClientRect();
        return { left: b.left - wrap.left, right: b.right - wrap.left, top: b.top - wrap.top, bottom: b.bottom - wrap.top };
      })
    : [];
  const gapIsText = (left: number, right: number, top: number, bottom: number, h: number) =>
    pageRuns.some(
      (p) =>
        p.left < right - 1 &&
        p.right > left + 1 &&
        p.bottom > top - h * 6 &&
        p.top < bottom + h * 6 &&
        !(p.top >= top - 1 && p.bottom <= bottom + 1),
    );

  const lines: typeof runs = [];
  for (const r of runs) {
    const h = r.bottom - r.top;
    const line = lines.find((g) => {
      const overlap = Math.min(g.bottom, r.bottom) - Math.max(g.top, r.top);
      if (overlap <= 0.5 * Math.min(h, g.bottom - g.top)) return false;
      const gap = Math.max(r.left - g.right, g.left - r.right);
      if (gap < h * 0.9) return true;
      if (gap > h * 4) return false;
      const gl = r.left > g.right ? g.right : r.right;
      const gr = r.left > g.right ? r.left : g.left;
      return gapIsText(gl, gr, Math.min(g.top, r.top), Math.max(g.bottom, r.bottom), h);
    });
    if (line) {
      line.left = Math.min(line.left, r.left);
      line.right = Math.max(line.right, r.right);
      line.top = Math.min(line.top, r.top);
      line.bottom = Math.max(line.bottom, r.bottom);
    } else {
      lines.push({ ...r });
    }
  }
  return lines.map((l) => ({ left: l.left, top: l.top, width: l.right - l.left, height: l.bottom - l.top }));
}

/**
 * Find `exact` in the page's text layer and return a DOM Range over it, preferring the
 * occurrence that starts inside `near` (page-wrapper coordinates). Whitespace is
 * normalised the same way selections are, and spans are joined with a space.
 */
function findQuoteRange(layer: HTMLElement, exact: string, near: ViewportBox, wrap: DOMRect): Range | null {
  // Compare with all whitespace removed: older quotes were saved with line breaks glued
  // together ("confidencedrop"), newer ones with a space, and both must match.
  const target = exact.replace(/\s+/g, "").toLowerCase();
  if (!target) return null;
  const chars: string[] = [];
  const map: { node: Text; offset: number }[] = [];
  for (const span of Array.from(layer.children)) {
    const node = span.firstChild;
    if (!(node instanceof Text)) continue;
    const text = node.data;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i] ?? "";
      if (/\s/.test(ch)) continue;
      chars.push(ch.toLowerCase());
      map.push({ node, offset: i });
    }
  }
  const haystack = chars.join("");
  let best: Range | null = null;
  for (let from = haystack.indexOf(target); from !== -1; from = haystack.indexOf(target, from + 1)) {
    const start = map[from];
    const end = map[from + target.length - 1];
    if (!start || !end) continue;
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset + 1);
    const first = range.getClientRects()[0];
    if (!best) best = range;
    if (first) {
      const x = first.left - wrap.left;
      const y = first.top - wrap.top;
      const pad = 24;
      if (x >= near.left - pad && x <= near.left + near.width + pad && y >= near.top - pad && y <= near.top + near.height + pad) {
        return range;
      }
    }
  }
  return best;
}

/** Replace a single block anchor on `page` with per-line anchors, and fix the quote text. */
function withLineAnchors(ann: Annotation, page: number, rects: PdfRect[], exact: string): Annotation {
  const selector = ann.target.selector.map((sel) => {
    if (sel.type === "PdfRectSelector") {
      const others = sel.anchors.filter((a) => a.page !== page);
      return { ...sel, anchors: [...rects.map((rect) => ({ page, rect })), ...others] };
    }
    if (sel.type === "TextQuoteSelector" && exact) return { ...sel, exact };
    return sel;
  });
  return { ...ann, target: { ...ann.target, selector }, modified: new Date().toISOString() };
}

/**
 * The text of a range over the PDF text layer. Selection.toString() glues the end of one
 * line to the start of the next ("confidencedrop"); join text runs with a space instead.
 */
function textOfRange(range: Range, layer: HTMLElement): string {
  const parts: string[] = [];
  for (const span of Array.from(layer.children)) {
    const node = span.firstChild;
    if (!(node instanceof Text) || !range.intersectsNode(node)) continue;
    const from = node === range.startContainer ? range.startOffset : 0;
    const to = node === range.endContainer ? range.endOffset : node.data.length;
    const piece = node.data.slice(from, to);
    if (piece.trim()) parts.push(piece);
  }
  return parts
    .reduce((acc, p) => (acc === "" ? p : /[-\u00ad]$/.test(acc) || /\s$/.test(acc) ? acc + p : `${acc} ${p}`), "")
    .replace(/\s+/g, " ")
    .trim();
}
let measureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, fontSize: number): number {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return 0;
  measureCtx.font = `${fontSize}px ${TEXT_LAYER_FONT}`;
  return measureCtx.measureText(text).width;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  /** Unscaled size used for the placeholder until this page is actually rendered. */
  fallbackSize: { width: number; height: number };
  scrollRoot: HTMLDivElement | null;
  zoom: number;
  marginCrop: boolean;
  pageAnnotations: Annotation[];
  onVisible: (pageNumber: number) => void;
  onTextSelected: (sel: PendingSelection | null) => void;
  /** Persist a highlight whose saved geometry/quote was rebuilt from the text layer. */
  onRepairAnnotation?: (ann: Annotation) => void;
}

const PdfPageCanvas = memo(function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  fallbackSize,
  scrollRoot,
  zoom,
  marginCrop,
  pageAnnotations,
  onVisible,
  onTextSelected,
  onRepairAnnotation,
}: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pageWrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [baseSize, setBaseSize] = useState(fallbackSize);
  const measuredRef = useRef(false);
  useEffect(() => {
    if (!measuredRef.current) setBaseSize(fallbackSize);
  }, [fallbackSize]);
  const size = { width: baseSize.width * zoom, height: baseSize.height * zoom };
  // Only pages near the viewport get a canvas and a text layer; far pages are released.
  const [near, setNear] = useState(false);
  const [pageMetrics, setMetrics] = useState<PageMetrics>({
    width: fallbackSize.width,
    height: fallbackSize.height,
    rotation: 0,
    scale: 1,
  });
  // Scale always follows the current zoom, even before this page re-renders.
  const metrics = useMemo(() => ({ ...pageMetrics, scale: zoom }), [pageMetrics, zoom]);
  const [spans, setSpans] = useState<PositionedSpan[]>([]);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  /** Line boxes recomputed for highlights saved by older versions as one big rectangle. */
  const [repaired, setRepaired] = useState<Record<string, ViewportBox[]>>({});
  const repairedIds = useRef(new Set<string>());

  useLayoutEffect(() => {
    const layer = textLayerRef.current;
    const wrap = pageWrapRef.current;
    if (!layer || !wrap || spans.length === 0) return;
    const sizes = spans.map((s) => s.fontSize).sort((a, b) => a - b);
    const lineHeight = (sizes[Math.floor(sizes.length / 2)] ?? 12) * 1.25;
    const wrapRect = wrap.getBoundingClientRect();
    const next: Record<string, ViewportBox[]> = {};
    for (const ann of pageAnnotations) {
      const anchors = getAnnotationAnchors(ann).filter((a) => a.page === pageNumber);
      if (anchors.length !== 1 || !anchors[0]) continue;
      const box = pdfToViewport(anchors[0].rect, metrics);
      if (box.height <= lineHeight * 1.8) continue; // a single line is already right
      const range = findQuoteRange(layer, getAnnotationQuote(ann), box, wrapRect);
      const lines = range ? lineBoxesFromRange(range, wrapRect, layer) : [];
      if (!range || lines.length === 0) continue;
      next[ann.id] = lines;
      if (onRepairAnnotation && !repairedIds.current.has(ann.id)) {
        repairedIds.current.add(ann.id);
        onRepairAnnotation(withLineAnchors(ann, pageNumber, lines.map((l) => viewportToPdf(l, metrics)), textOfRange(range, layer)));
      }
    }
    setRepaired(next);
  }, [spans, pageAnnotations, metrics, pageNumber, onRepairAnnotation]);

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
    const el = containerRef.current;
    if (!el) return;
    // Wait briefly before rendering so pages that fly past during a fast scroll are skipped.
    let timer: number | undefined;
    const enter = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => setNear(true), 90);
        } else {
          window.clearTimeout(timer);
        }
      },
      { root: scrollRoot, rootMargin: "120% 0px" },
    );
    const leave = new IntersectionObserver(
      (entries) => {
        if (entries.every((e) => !e.isIntersecting)) setNear(false);
      },
      { root: scrollRoot, rootMargin: "350% 0px" },
    );
    enter.observe(el);
    leave.observe(el);
    return () => {
      window.clearTimeout(timer);
      enter.disconnect();
      leave.disconnect();
    };
  }, [scrollRoot]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;
    const canvasEl = canvasRef.current;

    if (!near) {
      // Free the bitmap and text layer of pages far from view.
      if (canvasEl) {
        canvasEl.width = 0;
        canvasEl.height = 0;
      }
      setSpans([]);
      return;
    }

    async function render() {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: zoom });
      const rot = ((page.rotate % 360) + 360) % 360;
      const safeRot: 0 | 90 | 180 | 270 =
        rot === 90 || rot === 180 || rot === 270 ? rot : 0;

      measuredRef.current = true;
      setBaseSize((prev) =>
        prev.width === baseViewport.width && prev.height === baseViewport.height
          ? prev
          : { width: baseViewport.width, height: baseViewport.height },
      );
      setMetrics((prev) =>
        prev.width === baseViewport.width && prev.height === baseViewport.height && prev.rotation === safeRot
          ? prev
          : { width: baseViewport.width, height: baseViewport.height, rotation: safeRot, scale: 1 },
      );

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
        // item.width is in PDF units; scale it into viewport pixels and stretch the span to match.
        const targetWidth = (item.width ?? 0) * viewport.scale;
        const naturalWidth = measureTextWidth(item.str, fontSize);
        const scaleX = targetWidth > 0 && naturalWidth > 0 ? targetWidth / naturalWidth : 1;
        positioned.push({
          text: item.str,
          left: tx[4] ?? 0,
          top: (tx[5] ?? 0) - fontSize,
          fontSize,
          scaleX,
        });
      }
      setSpans(positioned);
    }

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, zoom, near]);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    if (!pageWrapRef.current || !textLayerRef.current) return;
    const range = sel.getRangeAt(0);
    const exact = textOfRange(range, textLayerRef.current) || sel.toString().replace(/\s+/g, " ").trim();
    if (!exact) return;

    const rect = range.getBoundingClientRect();
    const wrapRect = pageWrapRef.current.getBoundingClientRect();

    if (rect.width < 2 || rect.height < 2) return;
    const boxes = lineBoxesFromRange(range, wrapRect, textLayerRef.current);
    if (boxes.length === 0) return;

    onTextSelected({
      page: pageNumber,
      exact,
      pdfRects: boxes.map((b) => viewportToPdf(b, metrics)),
      toolbarX: rect.left + rect.width / 2,
      toolbarY: Math.max(54, rect.top - 44),
    });
  }

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      style={{ display: "flex", flexDirection: "column", alignItems: "safe center", gap: 10 }}
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
            const boxes = repaired[ann.id] ?? anchors.map((anchor) => pdfToViewport(anchor.rect, metrics));
            return boxes.map((box, idx) => {
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
                        : "none",
                    borderTop: isStrike ? `2px solid ${style.cssBorder}` : "none",
                    transform: isStrike ? "translateY(50%)" : undefined,
                  }}
                />
              );
            });
          })}
        </div>

        {/* Transparent selectable text layer */}
        <div className="kuraso-text-layer" ref={textLayerRef}>
          {spans.map((sp, i) => (
            <span
              key={i}
              style={{
                left: sp.left,
                top: sp.top,
                fontSize: `${sp.fontSize}px`,
                fontFamily: TEXT_LAYER_FONT,
                transform: sp.scaleX !== 1 ? `scaleX(${sp.scaleX})` : undefined,
              }}
            >
              {sp.text}
            </span>
          ))}
        </div>
      </div>
      <span className="kuraso-pdf-page-number">{tr("Page {n}", { n: pageNumber })}</span>
    </div>
  );
});

const NO_ANNOTATIONS: Annotation[] = [];

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
  onUpdateAnnotation,
  onExplainSelection,
  onDocumentLoaded,
  toolbarExtra,
  fitWidthKey,
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
          // Yield to the UI every few pages so the first pages paint and scrolling stays smooth.
          if (p % 4 === 0) await new Promise((r) => setTimeout(r, 0));
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
          setLoadError(err instanceof Error ? err.message : tr("Failed to open PDF"));
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
        anchors: pendingSel.pdfRects.map((rect) => ({ page: pendingSel.page, rect })),
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

  // Page 1's size stands in for unrendered pages (papers almost always use one page size).
  const [fallbackSize, setFallbackSize] = useState({ width: 612, height: 792 });
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    void pdfDoc.getPage(1).then((p) => {
      const vp = p.getViewport({ scale: 1 });
      if (!cancelled) setFallbackSize({ width: vp.width, height: vp.height });
    });
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  // One stable array per page so unchanged pages skip re-rendering.
  const annotationsByPage = useMemo(() => {
    const map = new Map<number, Annotation[]>();
    for (const a of annotations) {
      const pages = new Set(getAnnotationAnchors(a).map((an) => an.page));
      for (const p of pages) {
        const list = map.get(p);
        if (list) list.push(a);
        else map.set(p, [a]);
      }
    }
    return map;
  }, [annotations]);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);

  const lastFitKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!scrollRoot || !pdfDoc || fitWidthKey === undefined || lastFitKey.current === fitWidthKey) return;
    lastFitKey.current = fitWidthKey;
    const available = scrollRoot.clientWidth - 40;
    if (available <= 0 || fallbackSize.width * doc.zoom <= available) return;
    onZoomChange(Math.max(0.5, Math.floor((available / fallbackSize.width) * 100) / 100));
  }, [scrollRoot, pdfDoc, fitWidthKey, fallbackSize.width, doc.zoom, onZoomChange]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
      <div className="kuraso-reader-toolbar">
        <div className="kuraso-reader-toolbar-group">
          <span dir="ltr">
            p. <strong>{doc.currentPage}</strong> / {doc.pageCount || "…"}
          </span>
          {doc.structure && (
            <span className="kuraso-toolbar-meta" style={{ color: "var(--kuraso-text-muted)", fontSize: "0.75rem" }}>
              · {tr("{n} paragraphs", { n: doc.structure.paragraphs.length })}
            </span>
          )}
        </div>

        <div className="kuraso-reader-toolbar-group">
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Zoom out")}
            onClick={() => onZoomChange(Math.max(0.5, Number((doc.zoom - 0.15).toFixed(2))))}
          >
            <ZoomOut size={15} />
          </button>
          <span style={{ minWidth: 44, textAlign: "center" }}>{Math.round(doc.zoom * 100)}%</span>
          <button
            type="button"
            className="kuraso-icon-btn"
            title={tr("Zoom in")}
            onClick={() => onZoomChange(Math.min(2.5, Number((doc.zoom + 0.15).toFixed(2))))}
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            data-active={doc.marginCrop ? "true" : "false"}
            title={tr("Toggle smart margin crop")}
            onClick={onToggleCrop}
          >
            <Scissors size={15} />
            <span>{tr("Crop")}</span>
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            data-active={searchOpen ? "true" : "false"}
            title={tr("Search in document (Ctrl+F)")}
            onClick={onToggleSearch}
          >
            <Search size={15} />
          </button>
          {toolbarExtra}
        </div>
      </div>

      {doc.scanned && (
        <div className="kuraso-banner-warning" role="status">
          <AlertTriangle size={16} />
          <span>{tr("No selectable text found. Highlights and AI are off for this file.")}</span>
        </div>
      )}

      {searchOpen && (
        <div className="kuraso-search-bar">
          <Search size={15} />
          <input
            ref={searchInputRef}
            className="kuraso-input"
            style={{ flex: 1, maxWidth: 320 }}
            placeholder={tr("Find in paper…")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") stepMatch(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") onCloseSearch();
            }}
          />
          <span style={{ fontSize: "0.8rem", color: "var(--kuraso-text-muted)" }}>
            <bdi dir="ltr">{matches.length > 0 ? `${activeMatchIdx + 1} / ${matches.length}` : tr("0 matches")}</bdi>
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
          aria-label={tr("Highlight selection")}
        >
          {HIGHLIGHT_COLORS.map((c, idx) => {
            const st = SEMANTIC_HIGHLIGHT_DEFAULTS[c];
            return (
              <button
                key={c}
                type="button"
                className="kuraso-color-dot"
                title={tr("{label} (key {n})", { label: tr(SEMANTIC_LABELS[c]), n: idx + 1 })}
                aria-label={tr("Highlight as {label} (key {n})", { label: tr(SEMANTIC_LABELS[c]), n: idx + 1 })}
                style={{ backgroundColor: st.cssMarker }}
                onClick={() => commitSelection(c, "highlight", false)}
              >
                {idx + 1}
              </button>
            );
          })}
          <span className="kuraso-toolbar-sep" aria-hidden="true" />
          <button
            type="button"
            className="kuraso-icon-btn"
            style={{ height: 26, paddingInline: 5 }}
            title={tr("Underline")}
            aria-label={tr("Underline")}
            onClick={() => commitSelection("blue", "underline", false)}
          >
            <Underline size={13} />
          </button>
          <button
            type="button"
            className="kuraso-icon-btn"
            style={{ height: 26, paddingInline: 5 }}
            title={tr("Strikethrough")}
            aria-label={tr("Strikethrough")}
            onClick={() => commitSelection("red", "strikethrough", false)}
          >
            <Strikethrough size={13} />
          </button>
          <button
            type="button"
            className="kuraso-chip"
            title={tr("Highlight & add margin note (key N)")}
            onClick={() => commitSelection("yellow", "highlight", true)}
          >
            + {tr("Note")}
          </button>
          {onExplainSelection && (
            <button
              type="button"
              className="kuraso-chip"
              data-active="true"
              title={tr("Explain selection with your AI (Ctrl+E)")}
              onClick={() => {
                onExplainSelection(pendingSel.exact);
                window.getSelection()?.removeAllRanges();
                setPendingSel(null);
              }}
            >
              {tr("Explain")}
            </button>
          )}
          <button
            type="button"
            className="kuraso-icon-btn"
            style={{ height: 26, paddingInline: 5 }}
            aria-label={tr("Close")}
            onClick={() => setPendingSel(null)}
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div
        ref={(el) => {
          scrollRef.current = el;
          if (el !== scrollRoot) setScrollRoot(el);
        }}
        className="kuraso-pdf-scroll kuraso-pdf-viewport"
        dir="ltr"
        onMouseDown={() => setPendingSel(null)}
      >
        {loadError && (
          <div style={{ color: "var(--kuraso-hl-red-border)", padding: 24 }}>
            Could not open PDF: {loadError}
          </div>
        )}
        {!loadError && !pdfDoc && (
          <div style={{ color: "var(--kuraso-text-muted)", padding: 24 }}>{tr("Opening PDF…")}</div>
        )}
        {pdfDoc &&
          pageNumbers.map((pageNum) => (
            <PdfPageCanvas
              key={`${doc.id}-${pageNum}`}
              pdfDoc={pdfDoc}
              pageNumber={pageNum}
              fallbackSize={fallbackSize}
              scrollRoot={scrollRoot}
              zoom={doc.zoom}
              marginCrop={doc.marginCrop}
              pageAnnotations={annotationsByPage.get(pageNum) ?? NO_ANNOTATIONS}
              onVisible={onPageChange}
              onTextSelected={setPendingSel}
              onRepairAnnotation={onUpdateAnnotation}
            />
          ))}
      </div>
    </div>
  );
}
