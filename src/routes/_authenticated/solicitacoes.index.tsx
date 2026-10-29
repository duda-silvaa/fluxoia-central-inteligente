import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowDownUp, Download, Plus } from "lucide-react";
import { useRequests } from "@/hooks/use-data";
import { CATEGORIES, PRIORITIES, STATUSES, type RequestRow } from "@/lib/domain";
import { downloadFile, toCsv } from "@/lib/metrics";
import { AiBadge, AutomationBadge, DemoTag, EmptyState, ErrorState, Loading, PageHeader, PriorityBadge, StatusBadge, fmtDate } from "@/components/app/common";
import { RequestFormDialog } from "@/components/app/RequestFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const searchSchema = z.object({ q: z.string().optional(), new: z.boolean().optional() });

export const Route = createFileRoute("/_authenticated/solicitacoes/")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Solicitações — FluxoIA" },
      { name: "description", content: "Cadastre, filtre e acompanhe solicitações da equipe." },
      { property: "og:title", content: "Solicitações — FluxoIA" },
      { property: "og:description", content: "Cadastre, filtre e acompanhe solicitações da equipe." },
    ],
  }),
  component: RequestsPage,
});

const ALL = "__all";
const PAGE = 15;
type SortKey = "created_at" | "updated_at" | "priority" | "title";
const PRI_ORDER: Record<string, number> = { Baixa: 1, Média: 2, Alta: 3, Crítica: 4 };

function RequestsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading, error } = useRequests();
  const [q, setQ] = useState(search.q ?? "");
  const [cat, setCat] = useState(ALL);
  const [pri, setPri] = useState(ALL);
  const [st, setSt] = useState(ALL);
  const [ai, setAi] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("created_at");
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(!!search.new);

  useEffect(() => setQ(search.q ?? ""), [search.q]);
  useEffect(() => { if (search.new) setFormOpen(true); }, [search.new]);
  useEffect(() => setPage(0), [q, cat, pri, st, ai]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = (data ?? []).filter(
      (r) =>
        (!term || [r.title, r.description, r.requester, r.assignee ?? "", String(r.code)].some((s) => s.toLowerCase().includes(term))) &&
        (cat === ALL || r.category === cat) &&
        (pri === ALL || r.priority === pri) &&
        (st === ALL || r.status === st) &&
        (ai === ALL || r.ai_status === ai),
    );
    const val = (r: RequestRow) => (sort === "priority" ? PRI_ORDER[r.priority ?? ""] ?? 0 : r[sort]);
    return rows.sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = va < vb ? -1 : va > vb ? 1 : 0;
      return desc ? -c : c;
    });
  }, [data, q, cat, pri, st, ai, sort, desc]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  function exportCsv() {
    const rows = filtered.map((r) => ({
      id: r.code, titulo: r.title, solicitante: r.requester, categoria: r.category, prioridade: r.priority, status: r.status,
      responsavel: r.assignee, origem: r.source, analise_ia: r.ai_status, categoria_ia: r.ai_category, prioridade_ia: r.ai_priority,
      revisao_humana_necessaria: r.ai_requires_review, corrigida_por_humano: r.human_corrected, automacao: r.automation_status,
      demonstracao: r.is_demo, criada_em: r.created_at, atualizada_em: r.updated_at,
    }));
    downloadFile(`fluxoia-solicitacoes-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
  }

  function toggleSort(k: SortKey) {
    if (sort === k) setDesc(!desc);
    else { setSort(k); setDesc(true); }
  }

  return (
    <div>
      <PageHeader
        title="Solicitações"
        description="Pesquise, filtre e gerencie as demandas da equipe. A exportação inclui apenas os registros filtrados (sem descrições completas)."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
            <Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova solicitação</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-2 rounded-xl border bg-card p-3 md:grid-cols-6">
        <Input className="md:col-span-2" placeholder="Buscar por título, descrição, solicitante ou nº" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisa textual" />
        <F label="Categoria" value={cat} set={setCat} opts={CATEGORIES} all="Todas as categorias" />
        <F label="Prioridade" value={pri} set={setPri} opts={PRIORITIES} all="Todas as prioridades" />
        <F label="Status" value={st} set={setSt} opts={STATUSES} all="Todos os status" />
        <Select value={ai} onValueChange={setAi}>
          <SelectTrigger aria-label="Estado da análise"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toda análise IA</SelectItem>
            <SelectItem value="nao_analisada">Não analisada</SelectItem>
            <SelectItem value="concluida">Analisada</SelectItem>
            <SelectItem value="falhou">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <Loading /> : error ? <ErrorState error={error} /> : filtered.length === 0 ? (
        <EmptyState
          title={data?.length ? "Nenhum resultado para os filtros" : "Nenhuma solicitação ainda"}
          description={data?.length ? "Ajuste a busca ou os filtros." : "Registre a primeira solicitação da equipe."}
          action={!data?.length && <Button onClick={() => setFormOpen(true)}>Nova solicitação</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Nº</TableHead>
                  <SortHead label="Título" k="title" sort={sort} onSort={toggleSort} />
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Categoria</TableHead>
                  <SortHead label="Prioridade" k="priority" sort={sort} onSort={toggleSort} />
                  <TableHead>Status</TableHead>
                  <TableHead>IA</TableHead>
                  <TableHead>Automação</TableHead>
                  <SortHead label="Criada" k="created_at" sort={sort} onSort={toggleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate({ to: "/solicitacoes/$id", params: { id: r.id } })}>
                    <TableCell className="text-xs text-muted-foreground">#{r.code}</TableCell>
                    <TableCell className="max-w-xs">
                      <Link to="/solicitacoes/$id" params={{ id: r.id }} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{r.title}</Link>
                      {r.is_demo && <span className="ml-2"><DemoTag /></span>}
                    </TableCell>
                    <TableCell className="text-sm">{r.requester}</TableCell>
                    <TableCell className="text-sm">{r.category ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><PriorityBadge value={r.priority} /></TableCell>
                    <TableCell><StatusBadge value={r.status} /></TableCell>
                    <TableCell><AiBadge value={r.ai_status} /></TableCell>
                    <TableCell><AutomationBadge value={r.automation_status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">{filtered.length} resultado(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
              <span>{page + 1} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
            </div>
          </div>
        </div>
      )}
      <RequestFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o && search.new) navigate({ to: "/solicitacoes", search: { q: search.q }, replace: true }); }}
      />
    </div>
  );
}

function F({ label, value, set, opts, all }: { label: string; value: string; set: (v: string) => void; opts: readonly string[]; all: string }) {
  return (
    <Select value={value} onValueChange={set}>
      <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function SortHead({ label, k, sort, onSort }: { label: string; k: SortKey; sort: SortKey; onSort: (k: SortKey) => void }) {
  return (
    <TableHead>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 ${sort === k ? "text-foreground" : ""}`}>
        {label} <ArrowDownUp className="h-3 w-3" />
      </button>
    </TableHead>
  );
}
