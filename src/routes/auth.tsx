import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — FluxoIA" },
      { name: "description", content: "Acesse sua central de solicitações FluxoIA." },
      { property: "og:title", content: "Entrar — FluxoIA" },
      { property: "og:description", content: "Acesse sua central de solicitações FluxoIA." },
    ],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});
const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome").max(100),
  organization: z.string().trim().min(2, "Informe o nome da equipe").max(100),
});

function FieldError({ msg }: { msg?: string }) {
  return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Workflow className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold text-sidebar-accent-foreground">FluxoIA</span>
        </div>
        <div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-sidebar-accent-foreground">
            Triagem de solicitações com IA supervisionada.
          </h1>
          <p className="mt-4 max-w-md text-sidebar-foreground/80">
            Três agentes classificam, resumem e planejam cada demanda. Sua equipe aprova ou corrige — e cada decisão fica registrada.
          </p>
        </div>
        <Link to="/about" className="text-sm text-sidebar-primary hover:underline">
          Conheça o projeto →
        </Link>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Bem-vindo</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Entre ou crie a conta da sua equipe.</p>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              <TabsTrigger value="forgot">Recuperar</TabsTrigger>
            </TabsList>
            <TabsContent value="login"><LoginForm /></TabsContent>
            <TabsContent value="signup"><SignupForm onDone={() => setTab("login")} /></TabsContent>
            <TabsContent value="forgot"><ForgotForm /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const f = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  const onSubmit = f.handleSubmit(async (v) => {
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
    if (error) return toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
    navigate({ to: "/dashboard", replace: true });
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="l-email">E-mail</Label>
        <Input id="l-email" type="email" autoComplete="email" {...f.register("email")} />
        <FieldError msg={f.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="l-pass">Senha</Label>
        <Input id="l-pass" type="password" autoComplete="current-password" {...f.register("password")} />
        <FieldError msg={f.formState.errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>
        {f.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
      </Button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const f = useForm<z.infer<typeof signupSchema>>({ resolver: zodResolver(signupSchema) });
  const onSubmit = f.handleSubmit(async (v) => {
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: v.fullName, organization_name: v.organization },
      },
    });
    if (error) return toast.error(error.message);
    if (!data.session) {
      toast.success("Conta criada! Confirme seu e-mail pelo link enviado e depois entre.");
      onDone();
    }
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="s-name">Nome completo</Label>
        <Input id="s-name" autoComplete="name" {...f.register("fullName")} />
        <FieldError msg={f.formState.errors.fullName?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-org">Nome da equipe / organização</Label>
        <Input id="s-org" {...f.register("organization")} />
        <FieldError msg={f.formState.errors.organization?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-email">E-mail</Label>
        <Input id="s-email" type="email" autoComplete="email" {...f.register("email")} />
        <FieldError msg={f.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="s-pass">Senha</Label>
        <Input id="s-pass" type="password" autoComplete="new-password" {...f.register("password")} />
        <FieldError msg={f.formState.errors.password?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>
        {f.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Criar conta
      </Button>
    </form>
  );
}

function ForgotForm() {
  const f = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: z.string().trim().email("Informe um e-mail válido") })) });
  const onSubmit = f.handleSubmit(async (v) => {
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return toast.error(error.message);
    toast.success("Se o e-mail estiver cadastrado, você receberá um link de recuperação.");
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="f-email">E-mail</Label>
        <Input id="f-email" type="email" {...f.register("email")} />
        <FieldError msg={f.formState.errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>Enviar link</Button>
    </form>
  );
}
