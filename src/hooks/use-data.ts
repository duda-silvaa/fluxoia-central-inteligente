import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRequests() {
  return useQuery({
    queryKey: ["requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useAnalyses() {
  return useQuery({
    queryKey: ["analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_analyses")
        .select("id, request_id, status, duration_ms, created_at, model, provider, error, feedback_rating")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useRuns() {
  return useQuery({
    queryKey: ["runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export function useReviews() {
  return useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("human_reviews").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useMeasurements() {
  return useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("time_measurements").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
