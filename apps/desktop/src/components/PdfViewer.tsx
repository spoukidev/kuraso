import { useEffect, useMemo, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { searchPageTexts, type PageTextEntry, type SearchMatch } from "@kuraso/reader";
import { AlertTriangle, ChevronDown, ChevronUp, Scissors, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import type { OpenDocumentTab, OutlineNode } from "../state/readerStore";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfViewerProps {
  doc: OpenDocumentTab;
  jumpToPage: number | null;
  searchOpen: boolean;
  onCloseSearch: () => void;
  onToggleSearch: () => void;
  onZoomChange: (zoom: number) => void;
  onToggleCrop: () => void;
  onPageChange: (page: number) => void;
  onDocumentLoaded: (meta: {
    pageCount: number;
    scanned: boolean;
    outline: OutlineNode[];
  }) => void;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  marginCrop: boolean;
  onVisible: (pageNumber: number) => void;
}

function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  zoom,
  marginCrop,
  onVisible,
}: PdfPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 612, height: 792 });

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
      const viewport = page.getViewport({ scale: zoom });
      setSize({ width: viewport.width, height: viewport.height });

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
        // Ignore cancelled render tasks when zooming quickly.
      }
    }

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, zoom]);

  return (
    <div
      ref={containerRef}
      data-page-number={pageNumber}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}
    >
      <div
        className="kuraso-pdf-page-wrapper"
        data-crop={marginCrop ? "true" : "false"}
        style={{ width: size.width, height: size.height }}
      >
        <canvas ref={canvasRef} />
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
  jumpToPage,
  searchOpen,
  onCloseSearch,
  onToggleSearch,
  onZoomChange,
  onToggleCrop,
  onPageChange,
  onDocumentLoaded,
}: PdfViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageTexts, setPageTexts] = useState<PageTextEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoredPositionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setPdfDoc(null);
    setPageTexts([]);

    // Pass a fresh copy of the bytes so pdf.js worker transfer never detaches our tab buffer.
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
        const outline = await flattenOutline(loaded, rawOutline);

        // Extract text layer for search and scanned-PDF detection.
        const texts: PageTextEntry[] = [];
        let totalChars = 0;
        const samplePages = Math.min(loaded.numPages, 200);
        for (let p = 1; p <= samplePages; p++) {
          if (cancelled) return;
          const page = await loaded.getPage(p);
          const content = await page.getTextContent();
          const joined = content.items
            .map((it) => ("str" in it ? it.str : ""))
            .join(" ");
          totalChars += joined.trim().length;
          texts.push({ page: p, text: joined });
        }

        if (!cancelled) {
          setPageTexts(texts);
          onDocumentLoaded({
            pageCount: loaded.numPages,
            scanned: totalChars < 20,
            outline,
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

  // Restore saved reading position once per opened document.
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

  // Jump to page requested by Outline or Command Palette.
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
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="kuraso-reader-toolbar">
        <div className="kuraso-reader-toolbar-group">
          <span>
            p. <strong>{doc.currentPage}</strong> / {doc.pageCount || "…"}
          </span>
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

      <div ref={scrollRef} className="kuraso-pdf-scroll kuraso-pdf-viewport">
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
              onVisible={onPageChange}
            />
          ))}
      </div>
    </div>
  );
}
