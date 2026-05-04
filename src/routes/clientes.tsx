import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
 import { Users, Plus, MoreVertical, Search, Filter, Loader2, User, Trash2, Edit3, Phone, Mail, MapPin, DollarSign, Wrench, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — ConectaCRM" },
      { name: "description", content: "Gerencie sua base de clientes." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
   const [saving, setSaving] = useState(false);
   const [isHistoryOpen, setIsHistoryOpen] = useState(false);
   const [customerHistory, setCustomerHistory] = useState<{ sales: any[], services: any[] }>({ sales: [], services: [] });
   const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    document: "",
    address_street: "",
    address_city: ""
  });

  const fetchCustomers = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .order("full_name", { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
      toast.error("Erro ao carregar base de clientes.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenModal = (customer?: any) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        full_name: customer.full_name,
        email: customer.email || "",
        phone: customer.phone || "",
        document: customer.document || "",
        address_street: customer.address_street || "",
        address_city: customer.address_city || ""
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        document: "",
        address_street: "",
        address_city: ""
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user?.id || !formData.full_name) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        ...formData
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomer.id);
        if (error) throw error;
        toast.success("Cliente atualizado!");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(payload);
        if (error) throw error;
        toast.success("Cliente cadastrado!");
      }

      setIsModalOpen(false);
      fetchCustomers();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente permanentemente?")) return;
    try {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Cliente removido.");
      fetchCustomers();
    } catch (error) {
      toast.error("Erro ao excluir.");
    }
  };

   const filteredCustomers = customers.filter(c => 
     c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
     (c.phone && c.phone.includes(searchTerm))
   );
 
   const fetchCustomerHistory = async (customerId: string) => {
     setLoadingHistory(true);
     try {
       const [salesRes, servicesRes] = await Promise.all([
         supabase.from("sales_orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
         supabase.from("service_orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false })
       ]);
       setCustomerHistory({
         sales: (salesRes.data || []).map((s: any) => ({ ...s, total_amount: s.total_amount || 0 })),
         services: servicesRes.data || []
       });
     } catch (error) {
       toast.error("Erro ao carregar histórico");
     } finally {
       setLoadingHistory(false);
     }
   };
 
   const handleViewHistory = (customer: any) => {
     setEditingCustomer(customer);
     fetchCustomerHistory(customer.id);
     setIsHistoryOpen(true);
   };

   return (
     <div className="min-h-screen flex w-full bg-background">
       <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
         <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
           <DialogHeader>
             <DialogTitle>Histórico: {editingCustomer?.full_name}</DialogTitle>
           </DialogHeader>
           <div className="space-y-6 py-4">
             {loadingHistory ? (
               <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
             ) : (
               <>
                 <div className="space-y-3">
                   <h3 className="text-sm font-bold flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-600" /> Vendas Recentes</h3>
                   {customerHistory.sales.length > 0 ? (
                     <div className="space-y-2">
                       {customerHistory.sales.map(s => (
                         <div key={s.id} className="text-xs p-3 rounded-xl border border-border bg-slate-50/50 flex justify-between items-center">
                           <div>
                             <div className="font-bold">Venda #{s.id.slice(0, 8)}</div>
                             <div className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')}</div>
                           </div>
                           <div className="font-black text-slate-900">R$ {s.total_amount.toLocaleString('pt-BR')}</div>
                         </div>
                       ))}
                     </div>
                   ) : <p className="text-xs text-muted-foreground italic px-3">Nenhuma venda registrada.</p>}
                 </div>
 
                 <div className="space-y-3">
                   <h3 className="text-sm font-bold flex items-center gap-2"><Wrench className="h-4 w-4 text-blue-600" /> Ordens de Serviço</h3>
                   {customerHistory.services.length > 0 ? (
                     <div className="space-y-2">
                       {customerHistory.services.map(s => (
                         <div key={s.id} className="text-xs p-3 rounded-xl border border-border bg-slate-50/50 flex justify-between items-center">
                           <div>
                             <div className="font-bold">{s.equipment}</div>
                             <div className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString('pt-BR')} - {s.status}</div>
                           </div>
                           <div className="font-black text-slate-900">R$ {(s.estimated_cost || 0).toLocaleString('pt-BR')}</div>
                         </div>
                       ))}
                     </div>
                   ) : <p className="text-xs text-muted-foreground italic px-3">Nenhum serviço registrado.</p>}
                 </div>
               </>
             )}
           </div>
         </DialogContent>
       </Dialog>
 
       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input 
                id="full_name" 
                value={formData.full_name} 
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} 
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  placeholder="joao@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp / Celular</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document">CPF / CNPJ</Label>
              <Input 
                id="document" 
                value={formData.document} 
                onChange={(e) => setFormData({ ...formData, document: e.target.value })} 
                placeholder="000.000.000-00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Endereço (Rua)</Label>
                <Input 
                  id="street" 
                  value={formData.address_street} 
                  onChange={(e) => setFormData({ ...formData, address_street: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input 
                  id="city" 
                  value={formData.address_city} 
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Base de Clientes" subtitle="Gestão centralizada de contatos" />
        <main className="flex-1 overflow-y-auto p-6">
          
          {/* Quick Add Section */}
          <div className={`mb-6 transition-all duration-300 overflow-hidden ${isQuickAddOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                  <Plus className="h-4 w-4" /> Cadastro Rápido de Cliente
                </h3>
                <button onClick={() => setIsQuickAddOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Nome Completo</Label>
                  <Input 
                    placeholder="Nome do cliente..." 
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="bg-card h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">WhatsApp / Telefone</Label>
                  <Input 
                    placeholder="(11) 99999-9999" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="bg-card h-11"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 font-bold">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Cadastrar Cliente
                  </Button>
                  <Button variant="outline" onClick={() => handleOpenModal()} className="h-11 px-4">
                    Formulário Completo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative max-w-sm w-full">
                <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input 
                  placeholder="Buscar clientes por nome, email ou telefone..." 
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-card border border-border outline-none text-sm" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
              className={`h-10 px-4 rounded-xl text-sm font-semibold shadow-elegant transition flex items-center gap-2 ${isQuickAddOpen ? "bg-muted text-foreground hover:bg-muted/80" : "bg-gradient-primary text-white hover:opacity-95"}`}
            >
              <Plus className="h-4 w-4" /> Novo Cliente
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Cliente</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Contato</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Localização</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">CPF/CNPJ</th>
                    <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground mt-2 text-sm">Carregando clientes...</p>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-muted-foreground text-sm">
                        Nenhum cliente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-xs">
                              {customer.full_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="font-semibold text-sm">{customer.full_name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {customer.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" /> {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" /> {customer.email}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {customer.address_city && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {customer.address_city}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                          {customer.document || "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-8 w-8 rounded-full hover:bg-muted grid place-items-center text-muted-foreground transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenModal(customer)} className="gap-2">
                                <Edit3 className="h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(customer.id)} className="gap-2 text-destructive">
                                <Trash2 className="h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
