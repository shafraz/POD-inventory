"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ImportUpload() {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return void toast.error(json.error ?? "Upload failed");
    router.push(`/import/${json.id}`);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition", drag ? "border-primary bg-blue-50/60" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50")}
        >
          <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} data-testid="import-file" />
          {file ? (
            <>
              <FileSpreadsheet className="size-9 text-emerald-600" />
              <div className="mt-2 text-sm font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB · click to choose another file</div>
            </>
          ) : (
            <>
              <UploadCloud className="size-9 text-slate-400" />
              <div className="mt-2 text-sm font-medium">Drop the .xlsx workbook here, or click to browse</div>
              <div className="text-xs text-muted-foreground">e.g. Inventory TEst.xlsx · max 10 MB</div>
            </>
          )}
        </label>
        <div className="mt-4 flex justify-end">
          <Button onClick={upload} disabled={!file} loading={busy} data-testid="import-analyse">Analyse workbook</Button>
        </div>
      </CardContent>
    </Card>
  );
}
