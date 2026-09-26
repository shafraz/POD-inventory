"use client";

import * as React from "react";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";

/**
 * Client-side automatic logout after inactivity (mirrors the server-side idle timeout,
 * which is the real enforcement). Warns one minute before signing out.
 */
export function IdleWatcher({ minutes }: { minutes: number }) {
  React.useEffect(() => {
    const limit = minutes * 60_000;
    let last = Date.now();
    let warned = false;
    const bump = () => {
      last = Date.now();
      if (warned) {
        warned = false;
        toast.dismiss("idle-warning");
      }
    };
    const events = ["mousemove", "keydown", "pointerdown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const t = setInterval(() => {
      const idle = Date.now() - last;
      if (idle >= limit) {
        clearInterval(t);
        logoutAction("idle");
      } else if (!warned && idle >= limit - 60_000) {
        warned = true;
        toast.warning("You will be signed out in 1 minute due to inactivity.", { id: "idle-warning", duration: 60_000 });
      }
    }, 10_000);
    return () => {
      clearInterval(t);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [minutes]);
  return null;
}
