import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  Bell,
  BookText,
  FlaskConical,
  Gauge,
  Inbox,
  Info,
  LogOut,
  Menu,
  Plug,
  Search,
  Timer,
  User,
  Workflow,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/solicitacoes", label: "Solicitações", icon: Inbox },
  { to: "/impacto", label: "Impacto e produtividade", icon: Timer },
  { to: "/avaliacao", label: "Avaliação da IA", icon: FlaskConical },
  { to: "/prompts", label: "Prompts dos agentes", icon: BookText },
  { to: "/integracoes", label: "Integrações", icon: Plug },
  { to: "/notificacoes", label: "Notificações", icon: Bell },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Workflow className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="font-display text-base font-semibold leading-none text-sidebar-accent-foreground">FluxoIA</p>
        <p className="mt-1 text-[11px] text-sidebar-foreground/70">Central de Solicitações</p>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="Navegação principal" className="mt-8 flex flex-col gap-1">
      {NAV.map((item) => {
        const active = path === item.to || path.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <Link
        to="/about"
        onClick={onNavigate}
        className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
      >
        <Info className="h-4 w-4" aria-hidden /> Sobre o produto
      </Link>
    </nav>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: unread } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    navigate({ to: "/solicitacoes", search: { q: q.trim() || undefined } });
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar px-4 py-6 lg:flex">
        <Brand />
        <NavList />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-none bg-sidebar p-4 py-6">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          <NavList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </Button>
          <form onSubmit={onSearch} className="relative max-w-md flex-1" role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar solicitações..."
              aria-label="Buscar solicitações"
              className="pl-9"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" asChild aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}>
              <Link to="/notificacoes" className="relative">
                <Bell className="h-5 w-5" />
                {!!unread && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2" aria-label="Menu do perfil">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {(profile?.full_name ?? "U").slice(0, 2).toUpperCase()}
                  </span>
                  <span className="hidden text-sm font-medium md:inline">{profile?.full_name ?? "Usuário"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate">{profile?.full_name}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/perfil" })}>
                  <User className="mr-2 h-4 w-4" /> Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
