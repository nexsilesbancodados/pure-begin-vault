import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Instagram, Plus, RefreshCw, Settings2, Trash2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/instagram")({
  head: () => ({ 
    meta: [
      { title: "Instagram — ConectaCRM" }, 
      { name: "description", content: "Integração direta com Instagram Direct e Comentários" }
    ] 
  }),
  component: InstagramPage,
});

function InstagramPage() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Conexões Instagram" subtitle="Gerencie seus perfis e directs" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-display">Perfis Conectados</h2>
            <button className="h-9 px-4 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-elegant hover:opacity-95 transition flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova Conta
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-card border border-border p-5 shadow-card hover:shadow-elegant transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 grid place-items-center">
                    <Instagram className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm leading-tight">loja_smartphones_br</h4>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      <span className="text-[11px] font-medium text-muted-foreground uppercase">Conectado</span>
                    </div>
                  </div>
                </div>
                <button className="h-8 w-8 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground"><Settings2 className="h-4 w-4" /></button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Mensagens Pendentes:</span>
                  <span className="font-bold text-primary">12</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Comentários (24h):</span>
                  <span className="font-bold">48</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                <button className="h-9 rounded-xl bg-muted text-foreground text-xs font-bold uppercase tracking-wide hover:bg-muted/80 transition flex items-center justify-center gap-2">
                  <ExternalLink className="h-3.5 w-3.5" /> Ver Perfil
                </button>
                <button className="h-9 rounded-xl bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wide hover:bg-destructive/20 transition flex items-center justify-center gap-2">
                  <Trash2 className="h-4 w-4" /> Desconectar
                </button>
              </div>
            </div>

            {/* Empty State / Add New */}
            <button className="rounded-2xl border-2 border-dashed border-border p-5 flex flex-col items-center justify-center text-center hover:bg-muted/30 transition group">
              <div className="h-12 w-12 rounded-xl bg-muted grid place-items-center mb-3 group-hover:scale-110 transition">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-bold text-muted-foreground">Adicionar Conta</span>
              <span className="text-[11px] text-muted-foreground/60 mt-1">Integre com Facebook Business</span>
            </button>
          </div>

          <div className="mt-8 rounded-2xl bg-card border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center text-primary">
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-base">Configurações de Automação Direct</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              O ConectaCRM permite responder automaticamente a menções em Stories e palavras-chave em comentários usando a inteligência artificial do DeepSeek.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">Auto-reply Stories</span>
                  <div className="h-5 w-10 rounded-full bg-success relative"><div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white shadow-sm" /></div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">Responde a qualquer menção em story com uma mensagem de agradecimento e qualificação.</p>
              </div>
              <div className="p-4 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">Monitoramento de Comentários</span>
                  <div className="h-5 w-10 rounded-full bg-success relative"><div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white shadow-sm" /></div>
                </div>
                <p className="text-[11px] text-muted-foreground italic">Envia direct automático quando alguém comenta "PREÇO" ou "VALOR" em seus posts.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
