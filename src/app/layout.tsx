import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemedToaster } from "@/components/theme/theme";
import { THEME_INIT_SCRIPT } from "@/components/theme/theme-script";
import { getSettings } from "@/lib/services/settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  return {
    title: { default: s?.systemName ?? "Device Inventory", template: `%s · ${s?.systemName ?? "Device Inventory"}` },
    description: `${s?.organizationName ?? "MPL"} asset inventory & equipment management`,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#0f1b2d" }, { media: "(prefers-color-scheme: dark)", color: "#080f1c" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
