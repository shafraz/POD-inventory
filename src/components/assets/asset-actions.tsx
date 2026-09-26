"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftRight, PackageOpen, Undo2, Wrench, CircleCheck, ShieldCheck, TriangleAlert, MoreHorizontal, Pencil, QrCode, Trash2,
  SearchX, RefreshCw, RotateCcw, FlagOff, Send, Printer, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, ConfirmDialog } from "@/components/ui/overlays";
import { useApp, type OperationKind } from "@/components/app/app-context";
import { AssetFormDialog, type AssetFormValues } from "./asset-form-dialog";
import { ExportMenu } from "@/components/shared/export-menu";
import { deleteAssetAction, resolveReviewAction, restoreAssetAction } from "@/app/actions/assets";

export function AssetActions({
  asset,
  formInitial,
  canExport,
}: {
  asset: { id: string; assetId: string; statusCode: string; archived: boolean; needsReview: boolean; hasOs: boolean };
  formInitial: AssetFormValues;
  canExport: boolean;
}) {
  const { can, openOperation } = useApp();
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [qr, setQr] = React.useState(false);
  const [del, setDel] = React.useState(false);
  const [pending, start] = React.useTransition();
  const op = (kind: OperationKind) => () => openOperation({ kind, assetId: asset.id });
  const code = asset.statusCode;

  if (asset.archived) {
    return can("asset.delete") ? (
      <Button variant="outline" size="sm" onClick={() => start(async () => { const r = await restoreAssetAction({ id: asset.id }); if (r.ok) { toast.success("Asset restored"); router.refresh(); } else toast.error(r.error); })} loading={pending}>
        <RotateCcw /> Restore asset
      </Button>
    ) : null;
  }

  // Primary contextual action based on current status
  const primary: { kind: OperationKind; label: string; icon: React.ElementType } | null = can("movement.record") || can("repair.manage")
    ? code === "UNDER_REPAIR"
      ? can("repair.manage") ? { kind: "REPAIR_IN", label: "Repair In", icon: CircleCheck } : null
      : code === "IN_STOCK" || code === "NOT_IN_USE" || code === "UNVERIFIED"
        ? can("movement.record") ? { kind: "ISSUE", label: "Issue", icon: PackageOpen } : null
        : code === "IN_USE" && can("movement.record") ? { kind: "TRANSFER", label: "Transfer", icon: ArrowLeftRight } : null
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="asset-actions">
      {primary && <Button size="sm" onClick={op(primary.kind)} data-testid={`action-${primary.kind}`}><primary.icon /> {primary.label}</Button>}
      {can("verify") && code !== "DISPOSED" && <Button size="sm" variant="outline" onClick={op("VERIFY")} data-testid="action-VERIFY"><ShieldCheck /> Verify</Button>}
      {can("asset.edit") && <Button size="sm" variant="outline" onClick={() => setEdit(true)} data-testid="action-edit"><Pencil /> Edit</Button>}
      {canExport && <ExportMenu report="asset-record" query={`asset=${encodeURIComponent(asset.assetId)}`} />}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" aria-label="More actions" data-testid="more-actions"><MoreHorizontal /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52">
          {can("movement.record") && code !== "UNDER_REPAIR" && code !== "DISPOSED" && code !== "LOST" && (
            <>
              {code !== "IN_USE" && <DropdownMenuItem onSelect={op("TRANSFER")} data-testid="menu-TRANSFER"><ArrowLeftRight /> Transfer</DropdownMenuItem>}
              {code !== "IN_STOCK" && <DropdownMenuItem onSelect={op("RETURN")} data-testid="menu-RETURN"><Undo2 /> Return to stock</DropdownMenuItem>}
            </>
          )}
          {can("repair.manage") && code !== "UNDER_REPAIR" && code !== "DISPOSED" && code !== "LOST" && <DropdownMenuItem onSelect={op("REPAIR_OUT")} data-testid="menu-REPAIR_OUT"><Wrench /> Send for repair</DropdownMenuItem>}
          {can("damage.report") && code !== "DISPOSED" && code !== "LOST" && <DropdownMenuItem onSelect={op("MARK_DAMAGED")}><TriangleAlert /> Report damage</DropdownMenuItem>}
          {can("os.update") && asset.hasOs && code !== "DISPOSED" && <DropdownMenuItem onSelect={op("OS_UPDATE")}><RefreshCw /> Record OS update</DropdownMenuItem>}
          {!can("movement.record") && can("movement.request") && <DropdownMenuItem onSelect={op("REQUEST")}><Send /> Request movement / repair</DropdownMenuItem>}
          <DropdownMenuItem onSelect={() => setQr(true)} data-testid="menu-qr"><QrCode /> Generate QR code</DropdownMenuItem>
          {asset.needsReview && can("asset.edit") && (
            <DropdownMenuItem onSelect={() => start(async () => { const r = await resolveReviewAction({ id: asset.id }); if (r.ok) { toast.success("Review resolved"); router.refresh(); } })}>
              <FlagOff /> Mark review resolved
            </DropdownMenuItem>
          )}
          {can("movement.record") && code !== "DISPOSED" && (
            <>
              <DropdownMenuSeparator />
              {code !== "LOST" && <DropdownMenuItem onSelect={op("MARK_LOST")}><SearchX /> Mark as lost</DropdownMenuItem>}
              {code !== "UNDER_REPAIR" && <DropdownMenuItem onSelect={op("DISPOSE")} destructive><Trash2 /> Dispose</DropdownMenuItem>}
            </>
          )}
          {can("asset.delete") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDel(true)} destructive><Trash2 /> Delete (archive)</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AssetFormDialog open={edit} onOpenChange={setEdit} initial={formInitial} />

      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>QR code · {asset.assetId}</DialogTitle>
            <DialogDescription>Encodes the Asset ID. Scanning it opens this asset profile.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col items-center gap-2 print:block" id="qr-label">
            <img src={`/api/qr/${encodeURIComponent(asset.assetId)}`} alt={`QR code for ${asset.assetId}`} className="size-56" data-testid="qr-image" />
            <div className="font-mono text-lg font-semibold">{asset.assetId}</div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" asChild><a href={`/api/qr/${encodeURIComponent(asset.assetId)}?format=png&download=1`}><Download /> PNG</a></Button>
            <Button variant="outline" asChild><a href={`/api/qr/${encodeURIComponent(asset.assetId)}?format=svg&download=1`}><Download /> SVG</a></Button>
            <Button onClick={() => { const w = window.open("", "_blank", "width=400,height=480"); if (w) { w.document.write(`<html><body style="font-family:sans-serif;text-align:center;padding:24px"><img src="/api/qr/${encodeURIComponent(asset.assetId)}" style="width:240px"/><div style="font:600 20px monospace;margin-top:8px">${asset.assetId}</div><script>window.onload=()=>{window.print()}<\/script></body></html>`); w.document.close(); } }}>
              <Printer /> Print label
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`Delete ${asset.assetId}?`}
        description="The asset will be archived and removed from the register, dashboard and reports. Its movement history and audit trail are retained, and an administrator can restore it."
        confirmLabel="Delete asset"
        destructive
        loading={pending}
        onConfirm={() => start(async () => {
          const r = await deleteAssetAction({ id: asset.id });
          setDel(false);
          if (!r.ok) return void toast.error(r.error);
          toast.success(`${asset.assetId} archived`);
          router.push("/assets");
        })}
      />
    </div>
  );
}
