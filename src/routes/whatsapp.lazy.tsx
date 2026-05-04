import { createLazyFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import * as Icons from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { evolution, type Instance } from "@/lib/evolution";
import { toast } from "sonner";
import { QrCodeModal } from "@/components/whatsapp/QrCodeModal";

export const Route = createLazyFileRoute("/whatsapp")({
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchInstances = useCallback(async () => {
    try {
      setLoading(true);
      const data = await evolution.getInstances();
      setInstances(data);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao conectar com a Evolution API. Verifique as chaves API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
  }, []);

  const filteredInstances = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return instances.filter((inst) => {
      const name = (inst?.instanceName ?? "").toLowerCase();
      const owner = (inst?.owner ?? "").toLowerCase();
      return name.includes(q) || owner.includes(q);
    });
  }, [instances, searchQuery]);

  const stats = useMemo(
    () => ({
      total: instances.length,
      connected: instances.filter((i) => i.status === "open").length,
      disconnected: instances.filter((i) => i.status !== "open").length,
    }),
    [instances],
  );

  const handleCreateInline = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Por favor, digite um nome para a instância.");
      return;
    }
    
    const name = newInstanceName.trim();
    try {
      setIsCreating(true);
      const data = await evolution.createInstance(name);
      console.log("Instância criada:", data);
      toast.success("Instância criada! Preparando QR Code...");
      setNewInstanceName("");
      await fetchInstances();
      setSelectedInstance(name);
    } catch (err: any) {
      console.error("Erro createInstance:", err);
      toast.error(err?.message || "Erro ao criar instância.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = async (name: string) => {
    if (!confirm(`Deseja realmente desconectar a instância ${name}?`)) return;
    try {
      await evolution.logoutInstance(name);
      toast.success("Instância desconectada!");
      fetchInstances();
    } catch {
      toast.error("Erro ao desconectar.");
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Deseja realmente EXCLUIR permanentemente a instância ${name}?`)) return;
    try {
      // A Evolution API exige logout antes de deletar uma instância conectada.
      // Tentamos o logout primeiro (silencioso se já estiver desconectada).
      try {
        await evolution.logoutInstance(name);
      } catch (e) {
        console.warn("Logout falhou (instância pode já estar desconectada):", e);
      }
      const result = await evolution.deleteInstance(name);
      console.log("Delete result:", result);
      toast.success(`Instância ${name} excluída da Evolution!`);
      await fetchInstances();
    } catch (err) {
      console.error("Erro ao excluir instância:", err);
      toast.error("Erro ao excluir instância na Evolution API.");
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Gestão de WhatsApp" 
          subtitle="Hub de conexões via Evolution API" 
          toggleSidebar={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Icons.Smartphone className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Geral</span>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums">{stats.total}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Total de Instâncias</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between group hover:border-success/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center text-success group-hover:scale-110 transition-transform">
                  <Icons.CheckCircle2 className="h-6 w-6" />
                </div>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-success">{stats.connected}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Conectadas Agora</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between group hover:border-warning/30 transition-all duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-warning/10 flex items-center justify-center text-warning group-hover:scale-110 transition-transform">
                  <Icons.AlertCircle className="h-6 w-6" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black tabular-nums text-warning">{stats.disconnected}</p>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-tight">Aguardando Conexão</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lado Esquerdo: Filtro e Lista */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-elegant">
                <div className="relative w-full sm:w-96">
                  <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Pesquisar instâncias ou números..."
                    className="w-full h-11 pl-11 pr-4 rounded-xl bg-muted/60 border border-transparent focus:border-primary/20 focus:bg-card outline-none text-sm transition"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <button
                  onClick={fetchInstances}
                  className="h-11 px-5 rounded-xl border border-border hover:bg-muted transition-all flex items-center gap-2 text-sm font-bold w-full sm:w-auto justify-center"
                >
                  <Icons.RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  <span>Atualizar Lista</span>
                </button>
              </div>

              {loading && instances.length === 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 4].map((i) => (
                    <div key={i} className="h-56 rounded-3xl bg-card animate-pulse border border-border" />
                  ))}
                </div>
              ) : filteredInstances.length === 0 ? (
                <div className="rounded-3xl bg-card border border-border shadow-sm p-16 text-center">
                  <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                    <Icons.MessageSquare className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-2xl font-bold">Nenhuma instância encontrada</h3>
                  <p className="text-muted-foreground mt-3 max-w-sm mx-auto leading-relaxed">
                    Crie uma nova instância ao lado para começar a gerenciar suas conexões.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredInstances.map((inst) => (
                    <div key={inst.instanceId} className="group relative rounded-3xl bg-card border border-border p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                      <div className={`absolute top-0 left-0 w-full h-1.5 ${inst.status === "open" ? "bg-success" : "bg-warning"}`} />
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-16 rounded-2xl bg-muted overflow-hidden flex items-center justify-center ring-4 ring-muted">
                            {inst.profilePictureUrl ? (
                              <img src={inst.profilePictureUrl} alt={inst.instanceName} className="h-full w-full object-cover" />
                            ) : (
                              <Icons.User className="h-8 w-8 text-muted-foreground/50" />
                            )}
                            <div className={`absolute bottom-0 right-0 h-4 w-4 border-2 border-card rounded-full shadow-sm ${inst.status === "open" ? "bg-success" : "bg-warning animate-pulse"}`} />
                          </div>
                          <div>
                            <h4 className="font-bold text-lg leading-tight">{inst.instanceName}</h4>
                            <p className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-1">
                              {inst.status === "open" ? (
                                <div className="flex items-center gap-1">
                                  <Icons.CheckCircle2 className="h-3 w-3 text-success" /> Ativo
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <Icons.AlertCircle className="h-3 w-3 text-warning" /> Pendente
                                </div>
                              )}
                            </p>
                          </div>
                        </div>

                        <button onClick={() => handleDelete(inst.instanceName)} className="h-9 w-9 flex items-center justify-center rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Icons.Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      <div className="space-y-4 mb-6">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                          <div className="flex items-center gap-2">
                            <Icons.Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground">Vínculo</span>
                          </div>
                          <span className="text-sm font-bold tabular-nums">
                            {inst.owner ? `+${inst.owner.split("@")[0]}` : "Pendente"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {inst.status !== "open" ? (
                          <button
                            onClick={() => setSelectedInstance(inst.instanceName)}
                            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                          >
                            <Icons.QrCode className="h-4 w-4" /> Ver QR Code
                          </button>
                        ) : (
                          <button
                            onClick={() => handleLogout(inst.instanceName)}
                            className="flex-1 h-11 rounded-2xl bg-muted text-foreground text-sm font-bold hover:bg-muted/80 transition flex items-center justify-center gap-2"
                          >
                            <Icons.LogOut className="h-4 w-4" /> Desconectar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lado Direito: Criação de Instância */}
            <div className="space-y-6">
              <div className="bg-card rounded-[2.5rem] border border-border shadow-elegant overflow-hidden flex flex-col h-full">
                <div className="p-8 bg-gradient-to-br from-primary/5 to-transparent border-b border-border">
                  <div className="h-14 w-14 rounded-2xl bg-primary text-white flex items-center justify-center mb-6 shadow-glow">
                    <Icons.Plus className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-black leading-tight mb-2">Conectar Nova Conta</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Digite o nome da instância para gerar o QR Code de conexão agora.
                  </p>
                </div>

                <div className="p-8 space-y-6 flex-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nome da Instância</label>
                    <div className="relative">
                      <Icons.Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50" />
                      <input
                        type="text"
                        placeholder="Ex: Suporte_Vendas"
                        className="w-full h-14 pl-12 pr-4 rounded-2xl bg-muted/40 border border-transparent focus:border-primary/20 focus:bg-card outline-none text-base font-medium transition shadow-inner"
                        value={newInstanceName}
                        onChange={(e) => setNewInstanceName(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleCreateInline}
                    disabled={isCreating}
                    className="w-full h-16 rounded-[1.25rem] bg-primary text-white font-black text-lg shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 group"
                  >
                    {isCreating ? (
                      <Icons.RefreshCw className="h-6 w-6 animate-spin" />
                    ) : (
                      <>
                        Gerar QR Code <Icons.ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  <div className="pt-6 border-t border-border">
                    <div className="flex items-center gap-3 text-muted-foreground/60">
                      <Icons.ShieldCheck className="h-5 w-5" />
                      <p className="text-xs font-medium">Conexão segura via HTTPS/TLS</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </main>

         {selectedInstance && (
           <QrCodeModal
             open={!!selectedInstance}
             onOpenChange={(val) => {
               if (!val) {
                 setSelectedInstance(null);
                 fetchInstances();
               }
             }}
             initialInstanceName={selectedInstance}
           />
         )}
      </div>
    </div>
  );
}