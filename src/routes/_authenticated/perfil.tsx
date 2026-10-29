import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { ErrorState, Loading, PageHeader } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil — FluxoIA" },
      { name: "description", content: "Dados do usuário e da organização." },
      { property: "og:title", content: "Perfil — FluxoIA" },
      { property: "og:description", content: "Dados do usuário e da organização." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useProfile();
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const [org, setOrg] = useState("");
  useEffect(() => {
    if (!data) return;
    setName(data.full_name ?? "");
    setJob(data.job_title ?? "");
    setOrg((data.organizations as { name: string } | null)?.name ?? "");
  }, [data]);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error ?? "Perfil não encontrado"} />;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || org.trim().length < 2) { toast.error("Nome e organização precisam de ao menos 2 caracteres."); return; }
    const a = await supabase.from("profiles").update({ full_name: name.trim(), job_title: job.trim() || null }).eq("id", data!.id);
    const b = await supabase.from("organizations").update({ name: org.trim() }).eq("id", data!.organization_id);
    if (a.error || b.error) { toast.error((a.error ?? b.error)!.message); return; }
    toast.success("Perfil atualizado.");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Perfil" description="Seus dados e da organização. Os dados da organização são isolados de outras equipes." />
      <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-5">
        <div className="space-y-1.5"><Label>E-mail</Label><Input value={data.email} disabled /></div>
        <div className="space-y-1.5"><Label htmlFor="p-name">Nome</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="p-job">Cargo</Label><Input id="p-job" value={job} onChange={(e) => setJob(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="p-org">Organização</Label><Input id="p-org" value={org} onChange={(e) => setOrg(e.target.value)} /></div>
        <Button type="submit">Salvar</Button>
      </form>
    </div>
  );
}
