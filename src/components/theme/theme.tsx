"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemePref = "light" | "dark" | "system";
import { THEME_KEY as KEY } from "./theme-script";

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  window.dispatchEvent(new Event("themechange"));
}

export function useTheme() {
  const [pref, setPref] = React.useState<ThemePref>("system");
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    try {
      setPref((localStorage.getItem(KEY) as ThemePref) || "system");
    } catch {}
    const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => {
      let p: ThemePref = "system";
      try {
        p = (localStorage.getItem(KEY) as ThemePref) || "system";
      } catch {}
      if (p === "system") apply("system");
    };
    mq.addEventListener("change", onOs);
    window.addEventListener("themechange", sync);
    return () => {
      mq.removeEventListener("change", onOs);
      window.removeEventListener("themechange", sync);
    };
  }, []);

  const setTheme = React.useCallback((p: ThemePref) => {
    try {
      localStorage.setItem(KEY, p);
    } catch {}
    setPref(p);
    apply(p);
  }, []);

  return { pref, isDark, setTheme };
}

/** Compact segmented control: Light / Dark / System. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { pref, setTheme } = useTheme();
  const opts: { v: ThemePref; icon: React.ElementType; label: string }[] = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "dark", icon: Moon, label: "Dark" },
    { v: "system", icon: Monitor, label: "System" },
  ];
  return (
    <div className={cn("flex rounded-md border bg-muted p-0.5", className)} role="radiogroup" aria-label="Theme">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={pref === o.v}
          onClick={(e) => {
            e.preventDefault();
            setTheme(o.v);
          }}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-[12px] font-medium text-muted-foreground transition",
            pref === o.v && "bg-card text-foreground shadow-sm",
          )}
          data-testid={`theme-${o.v}`}
        >
          <o.icon className="size-3.5" /> {o.label}
        </button>
      ))}
    </div>
  );
}

/** One-click toggle for the top bar. */
export function ThemeToggleButton() {
  const { isDark, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="rounded-md p-2 text-slate-600 hover:bg-muted"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

export function ThemedToaster() {
  const { isDark } = useTheme();
  return <Toaster theme={isDark ? "dark" : "light"} position="top-right" richColors closeButton toastOptions={{ className: "text-[13px]" }} />;
}
