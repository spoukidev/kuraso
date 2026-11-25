import { useEffect, useRef } from "react";

/**
 * Close a dialog with Esc. Uses the capture phase and stops the event, so the
 * app-wide Esc handlers (search bar, full screen) don't also react to it.
 */
export function useEscapeToClose(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();
      closeRef.current();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);
}
