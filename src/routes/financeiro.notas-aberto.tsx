import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, FileText } from "lucide-react";

export const Route = createFileRoute("/financeiro/notas-aberto")({
  head: () => ({
    meta: [
      { title: "Notas em Aberto" },
      { name: "description", content: "Cadastre e gerencie notas em aberto." },
    ],
  }),
  component: NotasAbertoPage,
});

function NotasAbertoPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Notas em Aberto</h1>
              <p className="text-sm text-muted-foreground">
                Cadastre suas notas e acompanhe os produtos vinculados.
              </p>
            </div>
            <Button onClick={() => {}} className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Nota
            </Button>
          </div>

          <Card className="p-12 flex flex-col items-center justify-center text-center text-muted-foreground border-dashed">
            <FileText className="h-10 w-10 mb-3 opacity-60" />
            <p className="text-sm">Nenhuma nota cadastrada ainda.</p>
            <p className="text-xs">Clique em “Cadastrar Nota” para começar.</p>
          </Card>
        </main>
      </div>
    </div>
  );
}
