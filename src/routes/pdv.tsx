 import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { PDVInterface } from "@/components/vendas/PDVInterface";
import { useState } from "react";

export const Route = createFileRoute("/pdv")({
  component: PDVPage,
});

function PDVPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Caixa (PDV)" 
          subtitle="Ponto de Venda Rápido" 
          toggleSidebar={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-hidden p-0 lg:p-6">
          <PDVInterface />
        </main>
      </div>
    </div>
  );
}
