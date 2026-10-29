import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha — FluxoIA" },
      { name: "description", content: "Defina uma nova senha para sua conta FluxoIA." },
      { property: "og:title", content: "Redefinir senha — FluxoIA" },
      { property: "og:description", content: "Defina uma nova senha para sua conta FluxoIA." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setErr("Mínimo de 6 caracteres");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">Redefinir senha</h1>
        {!ready && <p className="text-sm text-muted-foreground">Abra esta página pelo link enviado ao seu e-mail.</p>}
        <div className="space-y-1.5">
          <Label htmlFor="np">Nova senha</Label>
          <Input id="np" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} disabled={!ready} />
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={!ready}>Salvar nova senha</Button>
      </form>
    </div>
  );
}
