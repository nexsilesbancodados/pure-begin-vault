import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { StockList } from "@/components/estoque/StockList";
import { useState } from "react";

export const Route = createFileRoute("/estoque/atual")({
  component: StockAtualPage,
});

function StockAtualPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Estoque Atual" 
          subtitle="Gestão detalhada de inventário e IMEIs" 
          toggleSidebar={() => setSidebarOpen(true)} 
        />
        <main className="flex-1 overflow-y-auto p-6">
          <StockList />
        </main>
      </div>
    </div>
  );
}
