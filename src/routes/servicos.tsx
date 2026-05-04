import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { OSList } from "@/components/servicos/OSList";
 
 export const Route = createFileRoute("/servicos")({
   component: ServicesPage,
 });
 
 function ServicesPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Assistência Técnica" subtitle="Gestão de Ordens de Serviço" />
         <main className="flex-1 overflow-y-auto p-6">
           <OSList />
         </main>
       </div>
     </div>
   );
 }
