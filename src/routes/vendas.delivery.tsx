 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { DeliveryManager } from "@/components/vendas/DeliveryManager";
 
 export const Route = createFileRoute("/vendas/delivery")({
   component: DeliveryPage,
 });
 
 function DeliveryPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Delivery" subtitle="Gestão de Entregas" />
         <main className="flex-1 overflow-y-auto p-6">
           <DeliveryManager />
         </main>
       </div>
     </div>
   );
 }
