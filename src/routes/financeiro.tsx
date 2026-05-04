import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
import { FinanceDashboard } from "@/components/financeiro/FinanceDashboard";
import { useState } from "react";

 export const Route = createFileRoute("/financeiro")({
   component: FinancePage,
 });
 
 function FinancePage() {
   const [sidebarOpen, setSidebarOpen] = useState(false);

   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
       <div className="flex-1 flex flex-col min-w-0">
          <Topbar title="Dashboard Financeiro" subtitle="Visão geral e saúde financeira da empresa" toggleSidebar={() => setSidebarOpen(true)} />
         <main className="flex-1 overflow-y-auto p-6">
           <FinanceDashboard />
         </main>
       </div>
     </div>
   );
 }
