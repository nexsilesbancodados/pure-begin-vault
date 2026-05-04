 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { MessageSquare, Plus, RefreshCw, Smartphone, Trash2, Power, ExternalLink, QrCode, Settings2, Loader2, AlertCircle } from "lucide-react";
 import { useEffect, useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { toast } from "sonner";
 import { Button } from "@/components/ui/button";
 import { QrCodeModal } from "@/components/whatsapp/QrCodeModal";
 import { evolution } from "@/lib/evolution";

export const Route = createFileRoute("/whatsapp")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "WhatsApp — ConectaCRM" },
      { name: "description", content: "Gerencie suas conexões do WhatsApp via Evolution API." },
    ],
  }),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      toast.error("Erro ao carregar instâncias: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Excluir a instância ${name}?`)) return;
    try {
      await evolution.deleteInstance(name);
      const { error } = await supabase.from("whatsapp_instances").delete().eq("id", id);
      if (error) throw error;
      toast.success("Instância removida");
      load();
    } catch (e: any) {
      toast.error("Erro ao remover: " + e.message);
    }
  };

  const refreshStatus = async (name: string) => {
    try {
      const state = await evolution.getConnectionState(name);
      const status = state === "open" ? "connected" : "disconnected";
      await supabase.from("whatsapp_instances").update({ status }).eq("instance_name", name);
      load();
      toast.success(`Status de ${name} atualizado: ${status}`);
    } catch (e: any) {
      toast.error("Erro ao atualizar status: " + e.message);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="WhatsApp" subtitle="Gerencie suas conexões da Evolution API" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold font-display">Conexões Ativas</h2>
            <Button onClick={() => setModalOpen(true)} className="bg-gradient-primary shadow-glow gap-2">
              <Plus className="h-4 w-4" /> Nova Instância
            </Button>
          </div>

          {loading ? (
            <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <Smartphone className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-display font-bold text-lg">Nenhuma conexão ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">Conecte seu WhatsApp para automatizar atendimentos.</p>
              <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Criar Instância
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-card border border-border p-5 shadow-card hover:shadow-elegant transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-tight">{item.instance_name}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`h-2 w-2 rounded-full ${item.status === "connected" ? "bg-success" : "bg-destructive"}`} />
                          <span className="text-[11px] font-medium text-muted-foreground uppercase">
                            {item.status === "connected" ? "Conectado" : "Desconectado"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => refreshStatus(item.instance_name)} title="Atualizar status">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-5">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                      setSelectedInstance(item.instance_name);
                      setModalOpen(true);
                    }}>
                      <QrCode className="h-3.5 w-3.5" /> Ver QR Code
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 gap-2" onClick={() => remove(item.id, item.instance_name)}>
                      <Trash2 className="h-3.5 w-3.5" /> Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
       {modalOpen && (
         <QrCodeModal 
           open={modalOpen} 
           onOpenChange={(val) => {
             setModalOpen(val);
             if (!val) {
               setSelectedInstance(null);
               load();
             }
           }} 
           initialInstanceName={selectedInstance || undefined} 
         />
       )}
    </div>
  );
}