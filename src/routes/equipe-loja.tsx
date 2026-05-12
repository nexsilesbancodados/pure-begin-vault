import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { InviteFlow } from "@/components/team/InviteFlow";

export const Route = createFileRoute("/equipe-loja")({
  component: EquipeLojaPage,
});

function EquipeLojaPage() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Equipe da Loja" subtitle="Convide membros e gerencie acessos" />
        <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
          <InviteFlow />
        </main>
      </div>
    </div>
  );
}
