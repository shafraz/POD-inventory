"use client";

import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlays";

/** Export the current view. `query` carries the active filters so the export matches the screen. */
export function ExportMenu({ report, query = "", label = "Export", size = "sm" }: { report: string; query?: string; label?: string; size?: "sm" | "default" }) {
  const href = (format: string) => `/api/export?report=${encodeURIComponent(report)}&format=${format}${query ? `&${query}` : ""}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} data-testid="export-menu">
          <Download /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuLabel>Export {query ? "filtered records" : "all records"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><a href={href("xlsx")} data-testid="export-xlsx"><FileSpreadsheet /> Excel (.xlsx)</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={href("csv")} data-testid="export-csv"><FileType /> CSV</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={href("pdf")} data-testid="export-pdf"><FileText /> PDF</a></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
