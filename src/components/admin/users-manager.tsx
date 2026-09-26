"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { Plus, Pencil, Check, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, NativeSelect, Switch } from "@/components/ui/primitives";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/overlays";
import { Field } from "@/components/forms/field";
import { saveUserAction } from "@/app/actions/admin";
import { ROLE_LABELS } from "@/lib/constants";
import { permissionsFor, type Permission } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/utils";

type Row = { id: string; name: string; email: string; username: string | null; role: Role; active: boolean; lastLoginAt: string | null; createdAt: string };
const ROLE_COLOR: Record<Role, string> = { ADMIN: "dark", INVENTORY_OFFICER: "blue", OPERATIONS_USER: "teal", VIEWER: "gray" };

const MATRIX_ROWS: { label: string; perm: Permission }[] = [
  { label: "View assets & dashboard", perm: "asset.view" },
  { label: "Add / edit assets", perm: "asset.edit" },
  { label: "Delete assets", perm: "asset.delete" },
  { label: "Record movements (issue / transfer / return)", perm: "movement.record" },
  { label: "Submit movement / repair requests", perm: "movement.request" },
  { label: "Manage repairs", perm: "repair.manage" },
  { label: "Report damage", perm: "damage.report" },
  { label: "Verify assets", perm: "verify" },
  { label: "View reports & export", perm: "report.view" },
  { label: "View audit trail", perm: "audit.view" },
  { label: "Manage locations, types, statuses", perm: "reference.manage" },
  { label: "Manage users", perm: "users.manage" },
  { label: "Manage settings & import", perm: "settings.manage" },
];
const ROLES: Role[] = ["ADMIN", "INVENTORY_OFFICER", "OPERATIONS_USER", "VIEWER"];

export function UsersManager({ rows, meId }: { rows: Row[]; meId: string }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState<(Partial<Row> & { password?: string }) | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  const save = () =>
    start(async () => {
      const res = await saveUserAction({
        id: edit?.id ?? null, name: edit?.name ?? "", email: edit?.email ?? "", username: edit?.username ?? null,
        role: edit?.role ?? "VIEWER", active: edit?.active ?? true, password: edit?.password || null,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success("User saved");
      setEdit(null);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className="flex justify-end border-b p-3">
          <Button size="sm" onClick={() => { setErrors({}); setEdit({ role: "OPERATIONS_USER", active: true }); }} data-testid="add-user"><Plus /> Add user</Button>
        </div>
        <Table>
          <THead><TR><TH>Name</TH><TH>Email</TH><TH>Username</TH><TH>Role</TH><TH>Status</TH><TH>Last sign-in</TH><TH /></TR></THead>
          <TBody>
            {rows.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">{u.name}{u.id === meId && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</TD>
                <TD className="text-slate-600">{u.email}</TD>
                <TD className="text-slate-600">{u.username ?? "—"}</TD>
                <TD><Badge color={ROLE_COLOR[u.role]}>{ROLE_LABELS[u.role]}</Badge></TD>
                <TD>{u.active ? <Badge color="green">Active</Badge> : <Badge color="gray">Deactivated</Badge>}</TD>
                <TD className="whitespace-nowrap text-slate-600">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</TD>
                <TD className="text-right"><Button size="icon-sm" variant="ghost" onClick={() => { setErrors({}); setEdit(u); }} aria-label={`Edit ${u.name}`}><Pencil /></Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader><CardTitle>Role permissions</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-[13px]">
            <thead className="border-y bg-slate-50 text-[11.5px] uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-2 text-left font-semibold">Capability</th>{ROLES.map((r) => <th key={r} className="px-3 py-2 text-center font-semibold">{ROLE_LABELS[r]}</th>)}</tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((m) => (
                <tr key={m.perm} className="border-b last:border-0">
                  <td className="px-4 py-2">{m.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">
                      {permissionsFor(r).includes(m.perm) ? <Check className="mx-auto size-4 text-emerald-600" /> : <Minus className="mx-auto size-4 text-slate-300" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent size="sm" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{edit?.id ? `Edit ${edit.name}` : "Add user"}</DialogTitle></DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="Full name" required error={errors.name}><Input value={edit?.name ?? ""} onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))} /></Field>
            <Field label="Email" required error={errors.email}><Input type="email" value={edit?.email ?? ""} onChange={(e) => setEdit((p) => ({ ...p, email: e.target.value }))} /></Field>
            <Field label="Username" error={errors.username} hint="Optional — can be used to sign in"><Input value={edit?.username ?? ""} onChange={(e) => setEdit((p) => ({ ...p, username: e.target.value }))} /></Field>
            <Field label="Role" required>
              <NativeSelect value={edit?.role ?? "VIEWER"} onChange={(e) => setEdit((p) => ({ ...p, role: e.target.value as Role }))}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </NativeSelect>
            </Field>
            <Field label={edit?.id ? "Reset password" : "Password"} required={!edit?.id} error={errors.password} hint={edit?.id ? "Leave blank to keep the current password" : "At least 8 characters, letters and numbers"}>
              <Input type="password" autoComplete="new-password" value={edit?.password ?? ""} onChange={(e) => setEdit((p) => ({ ...p, password: e.target.value }))} />
            </Field>
            <label className="flex items-center gap-2 text-[13px]"><Switch checked={edit?.active ?? true} onCheckedChange={(c) => setEdit((p) => ({ ...p, active: c }))} disabled={edit?.id === meId} /> Active (can sign in)</label>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} loading={pending}>Save user</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
