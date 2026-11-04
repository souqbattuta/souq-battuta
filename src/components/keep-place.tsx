import { useEffect } from "react";

export function KeepPlace() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("button, a");
      if (!control) return;
      const tab = control.getAttribute("role") === "tab" || control.closest("[role='tablist']");
      if (!tab) return;
      const y = window.scrollY;
      const restore = () => {
        if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
      };
      requestAnimationFrame(restore);
      window.setTimeout(restore, 0);
      window.setTimeout(restore, 80);
      window.setTimeout(restore, 200);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
