"use client";

import { useEffect } from "react";

/**
 * Locks scroll on `document.body`, `document.documentElement`, and
 * `#app-shell-scroll-root` while `open` is true (App Router shell scrolls
 * inside that element, not the window).
 */
export function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const scrollRoot = document.getElementById("app-shell-scroll-root");
    const prev = {
      body: document.body.style.overflow,
      html: document.documentElement.style.overflow,
      root: scrollRoot?.style.overflow ?? "",
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (scrollRoot) {
      scrollRoot.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = prev.body;
      document.documentElement.style.overflow = prev.html;
      if (scrollRoot) {
        scrollRoot.style.overflow = prev.root;
      }
    };
  }, [open]);
}
