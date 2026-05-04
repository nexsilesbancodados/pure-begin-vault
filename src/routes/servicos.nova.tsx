 import { createFileRoute } from "@tanstack/react-router";
 import { OSForm } from "@/components/servicos/OSForm";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { useState } from "react";
 
 export const Route = createFileRoute("/servicos/nova")({
   component: NovaOSPage,
 });
 
 function NovaOSPage() {
   const [sidebarOpen, setSidebarOpen] = useState(false);
 
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar 
           title="Nova OS" 
           subtitle="Abertura de Chamado" 
           toggleSidebar={() => setSidebarOpen(true)} 
         />
         <main className="flex-1 overflow-y-auto p-6">
           <OSForm />
         </main>
       </div>
     </div>
   );
 }
