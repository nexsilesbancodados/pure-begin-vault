 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { FileText, Save, History } from "lucide-react";
 import { Textarea } from "@/components/ui/textarea";
 
 export const Route = createFileRoute("/servicos/termos")({
   component: OSTermsPage,
 });
 
 function OSTermsPage() {
   return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Termos de Garantia" subtitle="Documentação Legal" />
         <main className="flex-1 overflow-y-auto p-6">
           <div className="max-w-4xl mx-auto space-y-6">
             <Card className="p-6 border-border/50 shadow-card">
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-xl bg-orange-100 grid place-items-center text-orange-600">
                     <FileText className="h-5 w-5" />
                   </div>
                   <div>
                     <h2 className="text-lg font-bold">Configuração do Termo</h2>
                     <p className="text-sm text-muted-foreground">Este texto será impresso em todas as ordens de serviço finalizadas.</p>
                   </div>
                 </div>
                 <Button variant="outline" size="sm">
                   <History className="h-4 w-4 mr-2" /> Histórico
                 </Button>
               </div>
               <div className="space-y-4">
                 <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Texto do Termo</p>
                 <Textarea 
                   className="min-h-[400px] leading-relaxed font-mono text-sm"
                   defaultValue={`CONDIÇÕES GERAIS DE GARANTIA E SERVIÇO\n\n1. O prazo de garantia para reparos realizados é de 90 (noventa) dias, contados a partir da data de entrega do equipamento.\n2. A garantia cobre exclusivamente os componentes substituídos ou reparados conforme descrito na OS.\n3. Perda de garantia ocorrerá em casos de: mau uso, quedas, contato com líquidos, violação de lacres ou reparos efetuados por terceiros.\n4. O prazo para retirada do equipamento é de 30 dias após aviso de conclusão.`}
                 />
               </div>
               <div className="mt-8 pt-6 border-t border-border/50 flex justify-end">
                 <Button className="bg-gradient-primary shadow-glow">
                   <Save className="h-4 w-4 mr-2" /> Salvar Alterações
                 </Button>
               </div>
             </Card>
           </div>
         </main>
       </div>
     </div>
   );
 }
