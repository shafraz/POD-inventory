"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, CalendarClock, ImagePlus, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/primitives";
import { Field } from "@/components/forms/field";
import { saveSettingsAction } from "@/app/actions/admin";
import type { AppSettings } from "@/lib/services/settings";

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [v, setV] = React.useState(initial);
  const [recalc, setRecalc] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  const onLogo = (f?: File) => {
    if (!f) return;
    if (f.size > 300 * 1024) return void toast.error("Logo must be under 300 KB");
    const r = new FileReader();
    r.onload = () => setV((p) => ({ ...p, logo: String(r.result) }));
    r.readAsDataURL(f);
  };

  const save = () =>
    start(async () => {
      const res = await saveSettingsAction({ ...v, recalculate: recalc });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        return void toast.error(res.error);
      }
      toast.success(res.data.recalculated ? `Settings saved · ${res.data.recalculated} next-verification dates recalculated` : "Settings saved");
      router.refresh();
    });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><Building2 className="size-4 text-slate-400" /><CardTitle>General</CardTitle></div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Organisation name" required error={errors.organizationName}><Input value={v.organizationName} onChange={(e) => setV({ ...v, organizationName: e.target.value })} /></Field>
          <Field label="System name" required error={errors.systemName}><Input value={v.systemName} onChange={(e) => setV({ ...v, systemName: e.target.value })} /></Field>
          <Field label="Logo" hint="PNG, JPEG, SVG or WebP, under 300 KB">
            <div className="flex items-center gap-3">
              {v.logo ? <img src={v.logo} alt="Logo" className="size-12 rounded-md border object-contain p-1" /> : <div className="grid size-12 place-items-center rounded-md border border-dashed text-slate-300"><ImagePlus className="size-5" /></div>}
              <Input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onLogo(e.target.files?.[0])} className="max-w-xs" />
              {v.logo && <Button variant="ghost" size="icon-sm" onClick={() => setV({ ...v, logo: null })} aria-label="Remove logo"><X /></Button>}
            </div>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <div>
            <div className="flex items-center gap-2"><CalendarClock className="size-4 text-slate-400" /><CardTitle>Verification</CardTitle></div>
            <CardDescription>The workbook used a 90-day verification cycle.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Verification interval (days)" required error={errors.verificationIntervalDays}><Input type="number" min={1} value={v.verificationIntervalDays} onChange={(e) => setV({ ...v, verificationIntervalDays: Number(e.target.value) })} data-testid="setting-interval" /></Field>
            <Field label="Due-soon threshold (days)" required error={errors.dueSoonDays}><Input type="number" min={0} value={v.dueSoonDays} onChange={(e) => setV({ ...v, dueSoonDays: Number(e.target.value) })} /></Field>
          </div>
          <label className="flex items-start gap-2 text-[13px]">
            <Switch checked={recalc} onCheckedChange={setRecalc} className="mt-0.5" />
            <span>When the interval changes, recalculate every asset’s next verification date from its last verification.</span>
          </label>
        </CardContent>
      </Card>
      <div className="lg:col-span-2 flex justify-end">
        <Button onClick={save} loading={pending} data-testid="save-settings">Save settings</Button>
      </div>
    </div>
  );
}
