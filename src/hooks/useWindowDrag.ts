import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";

export function useWindowDrag(targetId: string) {
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) {
      return;
    }

    const handler = (event: MouseEvent) => {
      if (!isTauri()) {
        return;
      }
      if (event.buttons !== 1) {
        return;
      }
      void getCurrentWindow().startDragging();
    };

    el.addEventListener("mousedown", handler);
    return () => {
      el.removeEventListener("mousedown", handler);
    };
  }, [targetId]);
}
