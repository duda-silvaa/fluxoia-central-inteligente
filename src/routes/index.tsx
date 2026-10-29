import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "FluxoIA — Central Inteligente de Solicitações" },
      { name: "description", content: "Abra o painel do FluxoIA para triar solicitações com IA." },
      { property: "og:title", content: "FluxoIA — Central Inteligente de Solicitações" },
      { property: "og:description", content: "Abra o painel do FluxoIA para triar solicitações com IA." },
    ],
  }),
});
