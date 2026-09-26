"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <div className="space-y-1.5">
        <Label htmlFor="identifier">Email or username</Label>
        <Input id="identifier" name="identifier" autoComplete="username" autoFocus required className="h-10" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="h-10 pr-10" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{state.error}</p>}
      <Button type="submit" className="h-10 w-full" loading={pending}>
        {!pending && <LogIn />} Sign in
      </Button>
    </form>
  );
}
