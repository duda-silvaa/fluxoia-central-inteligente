import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrationStatus } from "@/lib/ai/ai.functions";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, organizations(name)")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, email: u.user.email ?? "" } : null;
    },
  });
}

export function useIntegrationStatus() {
  const fn = useServerFn(getIntegrationStatus);
  return useQuery({ queryKey: ["integration-status"], queryFn: () => fn(), staleTime: 60_000 });
}
