 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
  import { Building2, Plus, Phone, Mail, Globe, Search, MoreVertical, Filter, Download, MapPin, ExternalLink } from "lucide-react";
  import { useState } from "react";

 export const Route = createFileRoute("/financeiro/fornecedores")({
   component: FinanceFornecedoresPage,
 });

 function FinanceFornecedoresPage() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
  const suppliers: any[] = [];

   return (
     <div className="min-h-screen flex w-full bg-background">
        <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
       <div className="flex-1 flex flex-col min-w-0">
          <Topbar title="Gestão de Fornecedores" subtitle="Cadastro e controle de parceiros comerciais" toggleSidebar={() => setSidebarOpen(true)} />
         <main className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 md:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input placeholder="Buscar fornecedor por nome ou categoria..." className="w-full h-11 pl-10 pr-4 rounded-xl bg-card border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-600/10 focus:border-blue-600 transition shadow-sm" />
                </div>
                <Button variant="outline" className="h-11 rounded-xl border-slate-200 font-bold px-5">
                  <Filter className="h-4 w-4 mr-2" /> Filtros
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 rounded-xl border-slate-200 font-bold px-5">
                  <Download className="h-4 w-4 mr-2" /> Exportar
                </Button>
                <Button className="h-11 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 shadow-lg shadow-blue-200">
                  <Plus className="h-4 w-4 mr-2" /> Novo Fornecedor
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {suppliers.length > 0 ? suppliers.map(s => (
                <Card key={s.id} className="p-0 border-border shadow-sm hover:shadow-md transition-all group overflow-hidden rounded-2xl flex flex-col">
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-100 grid place-items-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <h3 className="font-black text-slate-900 leading-tight mb-1 group-hover:text-blue-600 transition-colors">{s.name}</h3>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-wider border border-blue-100">
                      {s.category}
                    </span>

                    <div className="mt-5 space-y-2.5">
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <Phone className="h-3.5 w-3.5 text-slate-400" /> {s.contact}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <Mail className="h-3.5 w-3.5 text-slate-400" /> {s.email}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" /> {s.city}
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex gap-2 group-hover:bg-slate-50 transition-colors">
                    <Button variant="outline" className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest rounded-lg border-slate-200 bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all">
                      Histórico
                    </Button>
                    <Button variant="outline" className="h-9 w-9 p-0 rounded-lg border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    </Button>
                  </div>
                </Card>
              )) : (
                <div className="col-span-full py-16 text-center text-sm text-muted-foreground italic border border-dashed border-slate-200 rounded-2xl">
                  Nenhum fornecedor cadastrado
                </div>
              )}
            </div>
         </main>
       </div>
     </div>
   );
 }
