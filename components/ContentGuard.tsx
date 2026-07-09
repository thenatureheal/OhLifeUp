"use client";

import { useEffect } from "react";

/**
 * Content protection: deters casual copying by blocking right-click, copy/cut,
 * text selection, image/text dragging, and common view-source / save / devtools
 * shortcuts.
 *
 * NOTE: this is a DETERRENT, not real security — anyone can still read the HTML
 * via devtools or "view-source:". Never rely on it to protect secrets; the
 * server (PayPal amounts, admin data) already enforces the real boundaries.
 *
 * Form fields stay fully usable: any event originating inside an input/textarea/
 * select/contenteditable is allowed through, so typing, pasting, and copying an
 * order number from a form still work.
 */

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest(
    'input, textarea, select, [contenteditable=""], [contenteditable="true"]'
  ) !== null;
}

export default function ContentGuard() {
  useEffect(() => {
    const blockIfNotEditable = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };

    // Always block drag & context menu (right-click / long-press menu).
    const onContextMenu = (e: Event) => e.preventDefault();
    const onDragStart = (e: Event) => e.preventDefault();

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // DevTools / view-source / save / print shortcuts.
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          (key === "i" || key === "j" || key === "c")) ||
        ((e.ctrlKey || e.metaKey) && (key === "u" || key === "s" || key === "p"))
      ) {
        e.preventDefault();
        return;
      }

      // Copy / cut / select-all — allow inside editable fields.
      if (
        (e.ctrlKey || e.metaKey) &&
        (key === "c" || key === "x" || key === "a") &&
        !isEditable(e.target)
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("copy", blockIfNotEditable);
    document.addEventListener("cut", blockIfNotEditable);
    document.addEventListener("selectstart", blockIfNotEditable);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("copy", blockIfNotEditable);
      document.removeEventListener("cut", blockIfNotEditable);
      document.removeEventListener("selectstart", blockIfNotEditable);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
