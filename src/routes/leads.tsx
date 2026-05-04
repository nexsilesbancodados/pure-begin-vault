import { createFileRoute } from "@tanstack/react-router";
import { LeadsTable } from "@/components/leads/LeadsTable";

export const Route = createFileRoute("/leads")({
  head: () => ({ 
    meta: [
      { title: "Leads — ConectaCRM" }, 
      { name: "description", content: "Gestão unificada de contatos e histórico" }
    ] 
  }),
  component: LeadsTable,
});
