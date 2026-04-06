"use client";

import { useEffect } from "react";

function isEditableElement(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return el.matches("input, textarea, select");
}

export default function MobileInputFocusGuard() {
  useEffect(() => {
    const onTouchEnd = (event: TouchEvent) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !isEditableElement(active)) return;

      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target === active || active.contains(target) || isEditableElement(target)) return;

      active.blur();
    };

    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return null;
}
