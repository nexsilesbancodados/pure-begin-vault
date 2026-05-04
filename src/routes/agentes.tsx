import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Headphones, Plus, MoreHorizontal, Shield, MessageSquare, Circle, Brain, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes de Atendimento — ConectaCRM" },
      { name: "description", content: "Gerencie sua equipe de suporte e vendas." },
    ],
  }),
  component: AgentsPage,
});

 interface Agent {
   id: string;
   display_name: string | null;
   role: string | null;
    avatar_url: string | null;
    email?: string | null;
  }
 
 import { useState, useEffect, useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { Loader2 } from "lucide-react";
 
 function AgentsPage() {
   const { user } = useAuth();
   const [sidebarOpen, setSidebarOpen] = useState(false);
   const [agents, setAgents] = useState<Agent[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchAgents = useCallback(async () => {
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("profiles")
         .select("*")
         .order("display_name", { ascending: true });
 
       if (error) throw error;
       setAgents(data || []);
     } catch (error) {
       console.error("Erro ao carregar agentes:", error);
       toast.error("Erro ao carregar equipe.");
     } finally {
       setLoading(false);
     }
   }, []);
 
   useEffect(() => {
     fetchAgents();
   }, [fetchAgents]);
 
   const handleTraining = () => {
     toast.success("Treinamento de Vendas de Celulares atualizado!", {
       description: "Agentes agora operam com o cérebro DeepSeek focado em conversão de smartphones.",
       icon: <Brain className="h-4 w-4 text-primary" />,
     });
   };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Agentes de Atendimento" subtitle="Gerencie sua equipe e conexões" toggleSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold font-display">Sua Equipe</h2>
              <div className="flex gap-2">
                <button 
                  onClick={handleTraining}
                  className="h-9 px-4 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition flex items-center gap-2"
                >
                  <Brain className="h-4 w-4" /> Treinar com DeepSeek
                </button>
                <button className="h-9 px-4 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-elegant hover:opacity-95 transition flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Convidar Agente
                </button>
              </div>
            </div>

            {/* AI Training Banner */}
            <div className="rounded-2xl bg-gradient-sidebar-cta p-5 text-white shadow-elegant relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition duration-500">
                <Brain className="h-32 w-32" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
                    <Sparkles className="h-3.5 w-3.5" /> Inteligência Artificial Ativa
                  </div>
                  <h3 className="text-xl font-bold font-display">Especialista em Vendas de Celulares</h3>
                  <p className="text-sm text-white/70 max-w-lg">
                    Seus agentes agora usam a API DeepSeek para argumentação técnica superior, 
                    comparativo de modelos e fechamento de vendas de smartphones.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
                  <Zap className="h-4 w-4 text-warning" />
                  <span className="text-xs font-bold uppercase tracking-wider">Motor: DeepSeek V3</span>
                </div>
              </div>
            </div>
          </div>

           <div className="grid grid-cols-1 gap-4">
             {loading ? (
               <div className="py-12 flex justify-center">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
               </div>
             ) : agents.length === 0 ? (
               <div className="rounded-2xl bg-card border border-border p-12 text-center shadow-card">
                 <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
                   <Headphones className="h-6 w-6 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-semibold">Nenhum agente cadastrado</h3>
                 <p className="text-sm text-muted-foreground mt-1">Sua equipe aparecerá aqui assim que você convidar o primeiro membro.</p>
               </div>
             ) : (
               agents.map((agent) => (
                 <div key={agent.id} className="rounded-2xl bg-card border border-border p-5 shadow-card hover:shadow-elegant transition-all flex items-center gap-6">
                   <div className="relative">
                     <div className="h-14 w-14 rounded-full bg-gradient-primary text-white font-bold text-lg grid place-items-center">
                       {agent.display_name?.split(" ").map(s => s[0]).join("").toUpperCase() || "U"}
                     </div>
                     <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card bg-success" />
                   </div>
 
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2">
                       <h3 className="font-bold text-base">{agent.display_name || "Sem nome"}</h3>
                       <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                         {agent.role || "Agente"}
                       </span>
                     </div>
                     <div className="text-sm text-muted-foreground mt-0.5">{agent.email}</div>
                   </div>
 
                   <div className="flex items-center gap-2">
                     <button className="h-10 px-4 rounded-xl border border-border hover:bg-muted text-sm font-semibold transition">
                       Editar
                     </button>
                     <button className="h-10 w-10 grid place-items-center rounded-xl border border-border hover:bg-muted text-muted-foreground">
                       <MoreHorizontal className="h-5 w-5" />
                     </button>
                   </div>
                 </div>
               ))
             )}
           </div>
        </main>
      </div>
    </div>
  );
}
