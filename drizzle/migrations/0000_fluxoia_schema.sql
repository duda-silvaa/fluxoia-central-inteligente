-- Enums
CREATE TYPE public.request_category AS ENUM ('Suporte técnico','Acesso e permissões','Dados e relatórios','Sistemas e aplicações','Infraestrutura','Administrativo','Outros');
CREATE TYPE public.request_priority AS ENUM ('Baixa','Média','Alta','Crítica');
CREATE TYPE public.request_status AS ENUM ('Nova','Em triagem','Pendente de revisão','Em andamento','Aguardando informação','Concluída','Cancelada');
CREATE TYPE public.ai_state AS ENUM ('nao_analisada','analisando','concluida','falhou');
CREATE TYPE public.automation_state AS ENUM ('nenhuma','pendente','executando','concluida','falhou');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Organizations
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text,
  job_title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_org_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

CREATE POLICY "org members read org" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id());
CREATE POLICY "org members update org" ON public.organizations FOR UPDATE TO authenticated USING (id = public.current_org_id()) WITH CHECK (id = public.current_org_id());
CREATE POLICY "read profiles in org" ON public.profiles FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND organization_id = public.current_org_id());
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profile_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid; nm text;
BEGIN
  nm := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1));
  INSERT INTO public.organizations(name) VALUES (COALESCE(NEW.raw_user_meta_data->>'organization_name', 'Equipe de ' || nm)) RETURNING id INTO org;
  INSERT INTO public.profiles(id, organization_id, full_name) VALUES (NEW.id, org, nm);
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Requests
CREATE TABLE public.requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code bigint GENERATED ALWAYS AS IDENTITY,
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  requester text NOT NULL CHECK (char_length(requester) BETWEEN 2 AND 120),
  category public.request_category,
  priority public.request_priority,
  status public.request_status NOT NULL DEFAULT 'Nova',
  assignee text,
  source text NOT NULL DEFAULT 'Formulário web',
  ai_status public.ai_state NOT NULL DEFAULT 'nao_analisada',
  ai_category public.request_category,
  ai_priority public.request_priority,
  ai_summary text,
  ai_reasoning text,
  ai_suggested_action text,
  ai_missing_info jsonb,
  ai_confidence numeric(4,3),
  ai_requires_review boolean,
  ai_analyzed_at timestamptz,
  human_corrected boolean NOT NULL DEFAULT false,
  human_approved boolean NOT NULL DEFAULT false,
  automation_status public.automation_state NOT NULL DEFAULT 'nenhuma',
  completed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_requests_org_created ON public.requests(organization_id, created_at DESC);
CREATE INDEX idx_requests_org_status ON public.requests(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org rw requests sel" ON public.requests FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org rw requests ins" ON public.requests FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org rw requests upd" ON public.requests FOR UPDATE TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org rw requests del" ON public.requests FOR DELETE TO authenticated USING (organization_id = public.current_org_id());
CREATE TRIGGER trg_requests_updated BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- History
CREATE TABLE public.request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_label text,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_hist_req ON public.request_history(request_id, created_at DESC);
GRANT SELECT ON public.request_history TO authenticated;
GRANT ALL ON public.request_history TO service_role;
ALTER TABLE public.request_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read history" ON public.request_history FOR SELECT TO authenticated USING (organization_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.log_request_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid(); lbl text;
BEGIN
  lbl := COALESCE((SELECT full_name FROM public.profiles WHERE id = actor), CASE WHEN actor IS NULL THEN 'Sistema/automação' ELSE 'Usuário' END);
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'criação', NEW.title);
    RETURN NEW;
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'título', OLD.title, NEW.title); END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'descrição', left(OLD.description,300), left(NEW.description,300)); END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'categoria', OLD.category::text, NEW.category::text); END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'prioridade', OLD.priority::text, NEW.priority::text); END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'status', OLD.status::text, NEW.status::text); END IF;
  IF NEW.assignee IS DISTINCT FROM OLD.assignee THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'responsável', OLD.assignee, NEW.assignee); END IF;
  IF NEW.ai_status IS DISTINCT FROM OLD.ai_status THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'análise IA', OLD.ai_status::text, NEW.ai_status::text); END IF;
  IF NEW.automation_status IS DISTINCT FROM OLD.automation_status THEN INSERT INTO public.request_history(request_id, organization_id, actor_id, actor_label, field, old_value, new_value) VALUES (NEW.id, NEW.organization_id, actor, lbl, 'automação', OLD.automation_status::text, NEW.automation_status::text); END IF;
  IF NEW.status = 'Concluída' AND OLD.status IS DISTINCT FROM 'Concluída' THEN NEW.completed_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_requests_hist_ins AFTER INSERT ON public.requests FOR EACH ROW EXECUTE FUNCTION public.log_request_changes();
CREATE TRIGGER trg_requests_hist_upd BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.log_request_changes();

-- AI analyses
CREATE TABLE public.ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  triggered_by uuid,
  trigger_source text NOT NULL DEFAULT 'manual',
  prompt_version text NOT NULL,
  provider text,
  model text,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  output jsonb,
  error text,
  duration_ms integer,
  feedback_rating smallint CHECK (feedback_rating IN (-1,1)),
  feedback_comment text,
  feedback_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX idx_ai_req ON public.ai_analyses(request_id, created_at DESC);
CREATE INDEX idx_ai_org ON public.ai_analyses(organization_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.ai_analyses TO authenticated;
GRANT ALL ON public.ai_analyses TO service_role;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read ai" ON public.ai_analyses FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org insert ai" ON public.ai_analyses FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org update ai" ON public.ai_analyses FOR UPDATE TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());

-- Human reviews
CREATE TABLE public.human_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL DEFAULT auth.uid(),
  reviewer_label text,
  action text NOT NULL CHECK (action IN ('aprovada','corrigida')),
  field text,
  original_value text,
  corrected_value text,
  review_minutes numeric(8,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_req ON public.human_reviews(request_id);
GRANT SELECT, INSERT ON public.human_reviews TO authenticated;
GRANT ALL ON public.human_reviews TO service_role;
ALTER TABLE public.human_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read reviews" ON public.human_reviews FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org insert reviews" ON public.human_reviews FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id() AND reviewer_id = auth.uid());

-- Automation runs
CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id text NOT NULL UNIQUE,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL DEFAULT 'request.created',
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','executando','concluida','falhou')),
  attempt integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  error text,
  result jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_runs_org ON public.automation_runs(organization_id, created_at DESC);
CREATE INDEX idx_runs_req ON public.automation_runs(request_id);
GRANT SELECT ON public.automation_runs TO authenticated;
GRANT ALL ON public.automation_runs TO service_role;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read runs" ON public.automation_runs FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE TRIGGER trg_runs_updated BEFORE UPDATE ON public.automation_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_org ON public.notifications(organization_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read notif" ON public.notifications FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org update notif" ON public.notifications FOR UPDATE TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org delete notif" ON public.notifications FOR DELETE TO authenticated USING (organization_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.notify_request_events() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.is_demo THEN
      INSERT INTO public.notifications(organization_id, request_id, type, title, body) VALUES (NEW.organization_id, NEW.id, 'nova_solicitacao', 'Nova solicitação recebida', NEW.title);
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.is_demo THEN RETURN NEW; END IF;
  IF NEW.ai_status = 'concluida' AND OLD.ai_status IS DISTINCT FROM 'concluida' THEN
    INSERT INTO public.notifications(organization_id, request_id, type, title, body) VALUES (NEW.organization_id, NEW.id, 'analise_concluida', 'Análise de IA concluída', NEW.title);
  END IF;
  IF NEW.status = 'Pendente de revisão' AND OLD.status IS DISTINCT FROM 'Pendente de revisão' THEN
    INSERT INTO public.notifications(organization_id, request_id, type, title, body) VALUES (NEW.organization_id, NEW.id, 'aguardando_revisao', 'Solicitação aguardando revisão', NEW.title);
  END IF;
  IF NEW.automation_status = 'falhou' AND OLD.automation_status IS DISTINCT FROM 'falhou' THEN
    INSERT INTO public.notifications(organization_id, request_id, type, title, body) VALUES (NEW.organization_id, NEW.id, 'falha_automacao', 'Falha em automação', NEW.title);
  END IF;
  IF NEW.status = 'Concluída' AND OLD.status IS DISTINCT FROM 'Concluída' THEN
    INSERT INTO public.notifications(organization_id, request_id, type, title, body) VALUES (NEW.organization_id, NEW.id, 'concluida', 'Solicitação concluída', NEW.title);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_requests_notify AFTER INSERT OR UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.notify_request_events();

-- Time measurements
CREATE TABLE public.time_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  method text NOT NULL CHECK (method IN ('manual','revisao')),
  task text NOT NULL CHECK (char_length(task) BETWEEN 2 AND 200),
  minutes numeric(8,2) NOT NULL CHECK (minutes > 0 AND minutes <= 1440),
  observations integer NOT NULL DEFAULT 1 CHECK (observations >= 1 AND observations <= 10000),
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_measurements TO authenticated;
GRANT ALL ON public.time_measurements TO service_role;
ALTER TABLE public.time_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org tm sel" ON public.time_measurements FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org tm ins" ON public.time_measurements FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org tm upd" ON public.time_measurements FOR UPDATE TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id());
CREATE POLICY "org tm del" ON public.time_measurements FOR DELETE TO authenticated USING (organization_id = public.current_org_id());
CREATE TRIGGER trg_tm_updated BEFORE UPDATE ON public.time_measurements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Eval runs (synthetic test cases defined in code, results persisted)
CREATE TABLE public.eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  case_id text NOT NULL,
  prompt_version text NOT NULL,
  model text,
  expected_category text NOT NULL,
  expected_priority text NOT NULL,
  predicted_category text,
  predicted_priority text,
  requires_review boolean,
  valid_output boolean NOT NULL DEFAULT false,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eval_org ON public.eval_runs(organization_id, created_at DESC);
GRANT SELECT ON public.eval_runs TO authenticated;
GRANT ALL ON public.eval_runs TO service_role;
ALTER TABLE public.eval_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org read eval" ON public.eval_runs FOR SELECT TO authenticated USING (organization_id = public.current_org_id());
CREATE POLICY "org insert eval" ON public.eval_runs FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id());
GRANT INSERT ON public.eval_runs TO authenticated;

-- Demo data (per organization, explicitly flagged)
CREATE OR REPLACE FUNCTION public.seed_demo_data() RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE org uuid := public.current_org_id(); i int; r uuid;
  titles text[] := ARRAY['Erro ao acessar o ERP','Solicitação de acesso ao BI','Relatório mensal com valores divergentes','Notebook não liga','VPN cai a cada 10 minutos','Reembolso de despesas de viagem','Novo usuário para estagiária','Sistema de ponto fora do ar','Atualizar dashboard de vendas','Impressora do 2º andar travada','Permissão de escrita na pasta Financeiro','Lentidão no servidor de arquivos'];
  cats public.request_category[] := ARRAY['Sistemas e aplicações','Acesso e permissões','Dados e relatórios','Suporte técnico','Infraestrutura','Administrativo','Acesso e permissões','Sistemas e aplicações','Dados e relatórios','Suporte técnico','Acesso e permissões','Infraestrutura']::public.request_category[];
  pris public.request_priority[] := ARRAY['Alta','Média','Média','Alta','Alta','Baixa','Média','Crítica','Baixa','Baixa','Média','Alta']::public.request_priority[];
  sts public.request_status[] := ARRAY['Em andamento','Concluída','Pendente de revisão','Nova','Em andamento','Concluída','Concluída','Em andamento','Nova','Concluída','Aguardando informação','Em triagem']::public.request_status[];
BEGIN
  IF org IS NULL THEN RAISE EXCEPTION 'Sem organização'; END IF;
  FOR i IN 1..array_length(titles,1) LOOP
    INSERT INTO public.requests(organization_id, title, description, requester, category, priority, status, assignee, source, ai_status, ai_category, ai_priority, ai_summary, ai_reasoning, ai_suggested_action, ai_confidence, ai_requires_review, ai_analyzed_at, human_corrected, is_demo, created_at, automation_status)
    VALUES (org, '[DEMO] ' || titles[i], 'Descrição fictícia de demonstração: ' || titles[i] || '. Dados gerados apenas para ilustrar o funcionamento do sistema.', 'Pessoa Fictícia ' || i, cats[i], pris[i], sts[i], CASE WHEN i % 3 = 0 THEN NULL ELSE 'Equipe Ops' END, CASE WHEN i % 2 = 0 THEN 'E-mail' ELSE 'Formulário web' END,
      'concluida', cats[i], pris[i], 'Resumo de demonstração (não gerado por IA).', 'Justificativa de demonstração (não gerada por IA).', 'Ação de demonstração.', 0.7, i % 4 = 0, now() - (i || ' days')::interval, i % 5 = 0, true, now() - (i || ' days')::interval,
      CASE WHEN i % 6 = 0 THEN 'falhou'::public.automation_state ELSE 'concluida'::public.automation_state END)
    RETURNING id INTO r;
    INSERT INTO public.automation_runs(execution_id, request_id, organization_id, status, started_at, finished_at, duration_ms, error, is_demo)
    VALUES ('demo-' || r::text, r, org, CASE WHEN i % 6 = 0 THEN 'falhou' ELSE 'concluida' END, now() - (i || ' days')::interval, now() - (i || ' days')::interval + interval '8 seconds', 4000 + i * 500, CASE WHEN i % 6 = 0 THEN 'Demonstração: timeout simulado' ELSE NULL END, true);
  END LOOP;
  INSERT INTO public.time_measurements(organization_id, method, task, minutes, observations, notes, is_demo) VALUES
    (org, 'manual', '[DEMO] Triagem manual de solicitação', 6.5, 10, 'Valor fictício de demonstração', true),
    (org, 'revisao', '[DEMO] Revisão da sugestão da IA', 1.5, 8, 'Valor fictício de demonstração', true);
  RETURN array_length(titles,1);
END $$;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated;

CREATE OR REPLACE FUNCTION public.reset_demo_data() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid := public.current_org_id();
BEGIN
  IF org IS NULL THEN RAISE EXCEPTION 'Sem organização'; END IF;
  DELETE FROM public.automation_runs WHERE organization_id = org AND is_demo;
  DELETE FROM public.requests WHERE organization_id = org AND is_demo;
  DELETE FROM public.time_measurements WHERE organization_id = org AND is_demo;
END $$;
GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO authenticated;
