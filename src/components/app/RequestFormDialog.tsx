import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, PRIORITIES, STATUSES, type RequestRow } from "@/lib/domain";
import { dispatchAutomationFn } from "@/lib/automation/automation.functions";
import { analyzeRequestFn } from "@/lib/ai/ai.functions";
import { useIntegrationStatus } from "@/hooks/use-profile";

export const requestFormSchema = z.object({
  title: z.string().trim().min(3, "Mínimo de 3 caracteres").max(200, "Máximo de 200 caracteres"),
  description: z.string().trim().min(10, "Descreva com pelo menos 10 caracteres").max(5000, "Máximo de 5000 caracteres"),
  requester: z.string().trim().min(2, "Informe o solicitante").max(120),
  source: z.string().min(1),
  assignee: z.string().trim().max(120).optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
});
type FormValues = z.infer<typeof requestFormSchema>;

const NONE = "__none";
const SOURCES = ["Formulário web", "E-mail", "Chat", "Telefone", "API"];

export function RequestFormDialog({
  open,
  onOpenChange,
  request,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  request?: RequestRow | null;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const dispatch = useServerFn(dispatchAutomationFn);
  const analyze = useServerFn(analyzeRequestFn);
  const { data: integ } = useIntegrationStatus();
  const isEdit = !!request;
  const f = useForm<FormValues>({ resolver: zodResolver(requestFormSchema) });

  useEffect(() => {
    if (!open) return;
    f.reset({
      title: request?.title ?? "",
      description: request?.description ?? "",
      requester: request?.requester ?? "",
      source: request?.source ?? "Formulário web",
      assignee: request?.assignee ?? "",
      category: request?.category ?? NONE,
      priority: request?.priority ?? NONE,
      status: request?.status ?? "Nova",
    });
  }, [open, request, f]);

  const onSubmit = f.handleSubmit(async (v) => {
    const payload = {
      title: v.title,
      description: v.description,
      requester: v.requester,
      source: v.source,
      assignee: v.assignee || null,
      category: (v.category && v.category !== NONE ? v.category : null) as RequestRow["category"],
      priority: (v.priority && v.priority !== NONE ? v.priority : null) as RequestRow["priority"],
      status: (v.status ?? "Nova") as RequestRow["status"],
    };
    if (isEdit) {
      const { error } = await supabase.from("requests").update(payload).eq("id", request!.id);
      if (error) return toast.error(error.message);
      toast.success(
        request!.description !== v.description && request!.ai_status === "concluida"
          ? "Solicitação atualizada. A descrição mudou: considere reanalisar com IA."
          : "Solicitação atualizada.",
      );
      qc.invalidateQueries();
      onOpenChange(false);
      return;
    }
    const { data, error } = await supabase.from("requests").insert(payload).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Solicitação registrada.");
    qc.invalidateQueries();
    onOpenChange(false);
    onCreated?.(data.id);
    // Event flow: n8n when configured; otherwise direct AI analysis when configured.
    if (integ?.n8n.configured) {
      const r = await dispatch({ data: { requestId: data.id } });
      if (r.ok) toast.info("Evento enviado ao n8n.");
      else toast.error(`Automação n8n: ${r.error}`);
    } else if (integ?.ai.configured) {
      toast.info("Analisando com IA...");
      const r = await analyze({ data: { requestId: data.id } });
      if (r.ok) toast.success("Análise de IA concluída.");
      else toast.error(`Análise de IA: ${r.error}`);
    }
    qc.invalidateQueries();
  });

  const err = f.formState.errors;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar solicitação" : "Nova solicitação"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Alterações ficam registradas no histórico." : "Categoria e prioridade podem ficar em branco para a IA sugerir."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="rf-title">Título *</Label>
            <Input id="rf-title" {...f.register("title")} aria-invalid={!!err.title} />
            {err.title && <p className="text-xs text-destructive">{err.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rf-desc">Descrição original *</Label>
            <Textarea id="rf-desc" rows={5} {...f.register("description")} aria-invalid={!!err.description} />
            {err.description && <p className="text-xs text-destructive">{err.description.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rf-req">Solicitante *</Label>
              <Input id="rf-req" {...f.register("requester")} />
              {err.requester && <p className="text-xs text-destructive">{err.requester.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rf-as">Responsável</Label>
              <Input id="rf-as" {...f.register("assignee")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField control={f.control} name="source" label="Origem" options={SOURCES} />
            <SelectField control={f.control} name="status" label="Status" options={STATUSES} />
            <SelectField control={f.control} name="category" label="Categoria" options={CATEGORIES} allowNone />
            <SelectField control={f.control} name="priority" label="Prioridade" options={PRIORITIES} allowNone />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={f.formState.isSubmitting}>
              {f.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SelectField({
  control,
  name,
  label,
  options,
  allowNone,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"];
  name: keyof FormValues;
  label: string;
  options: readonly string[];
  allowNone?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value ?? (allowNone ? NONE : undefined)} onValueChange={field.onChange}>
            <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowNone && <SelectItem value={NONE}>Deixar para a IA sugerir</SelectItem>}
              {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}
