 import { createFileRoute } from "@tanstack/react-router";
 import { AppSidebar } from "@/components/layout/Sidebar";
 import { Topbar } from "@/components/layout/Topbar";
 import { Card } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
  import { ListTree, Plus, ChevronRight, Search, Settings2, Download, Filter, MoreVertical, Edit2, Trash2, ArrowUpRight, ArrowDownRight, Info, HelpCircle, BookOpen } from "lucide-react";
  import { useState } from "react";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Textarea } from "@/components/ui/textarea";

 export const Route = createFileRoute("/financeiro/plano-contas")({
   component: FinancePlanoContasPage,
 });

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function FinancePlanoContasPage() {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', code: '', type: 'revenue', parent_id: null as string | null, description: '' });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      const { error } = await supabase.from("chart_of_accounts").insert({ ...data, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      toast.success("Conta criada com sucesso!");
      setIsModalOpen(false);
      setNewAccount({ name: '', code: '', type: 'revenue', parent_id: null, description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chart_of_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      toast.success("Conta removida com sucesso!");
    },
  });

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["chart_of_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("*")
        .order("code");
      if (error) throw error;
      return data || [];
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const roots = [
        { user_id: user.id, name: "RECEITAS OPERACIONAIS", code: "1", type: "revenue", description: "Entradas da atividade principal" },
        { user_id: user.id, name: "CUSTOS OPERACIONAIS (CPV/CSP)", code: "2", type: "expense", description: "Custos diretos de vendas/serviços" },
        { user_id: user.id, name: "DESPESAS ADMINISTRATIVAS", code: "3", type: "expense", description: "Gastos fixos de operação" },
        { user_id: user.id, name: "DESPESAS COM VENDAS", code: "4", type: "expense", description: "Marketing, comissões e fretes" },
      ];

      const { data: insertedRoots, error: rootError } = await supabase.from("chart_of_accounts").insert(roots).select();
      if (rootError) throw rootError;

      const rId = (code: string) => insertedRoots.find(r => r.code === code)?.id;

      const subs = [
        { user_id: user.id, name: "Venda de Produtos", code: "1.1", type: "revenue", parent_id: rId("1") },
        { user_id: user.id, name: "Prestação de Serviços", code: "1.2", type: "revenue", parent_id: rId("1") },
        { user_id: user.id, name: "Aquisição de Mercadorias", code: "2.1", type: "expense", parent_id: rId("2") },
        { user_id: user.id, name: "Aluguel e Condomínio", code: "3.1", type: "expense", parent_id: rId("3") },
        { user_id: user.id, name: "Energia e Água", code: "3.2", type: "expense", parent_id: rId("3") },
        { user_id: user.id, name: "Salários e Encargos", code: "3.3", type: "expense", parent_id: rId("3") },
        { user_id: user.id, name: "Marketing e Anúncios", code: "4.1", type: "expense", parent_id: rId("4") },
      ];

      const { error: subError } = await supabase.from("chart_of_accounts").insert(subs);
      if (subError) throw subError;

      return insertedRoots;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chart_of_accounts"] });
      toast.success("Plano de contas padrão carregado!");
    },
  });

  const [searchTerm, setSearchTerm] = useState("");

  const filteredAccounts = accounts?.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.code?.includes(searchTerm)
  ) || [];

  const rootAccounts = filteredAccounts.filter(a => !a.parent_id) || [];

  if (isLoading) return <div className="p-8">Carregando plano de contas...</div>;

  function AccountItem({ account, allAccounts }: { account: any, allAccounts: any[] }) {
    const children = allAccounts.filter(a => a.parent_id === account.id);
    const hasChildren = children.length > 0;
    const [isExpanded, setIsExpanded] = useState(true);
    const isRoot = !account.parent_id;

    const content = (
      <div className={`group flex items-center justify-between ${isRoot ? 'px-5 py-4' : 'px-4 py-2 hover:bg-slate-50 rounded-lg transition-all'}`}>
        <div className="flex items-center gap-3">
          {hasChildren ? (
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-slate-200 rounded transition-colors">
              <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
          ) : !isRoot && (
            <div className="w-6 h-px bg-slate-200" />
          )}
          
          {isRoot ? (
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${account.type === 'revenue' ? 'bg-green-100 text-green-600' : account.type === 'expense' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
              {account.type === 'revenue' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </div>
          ) : (
            <div className={`h-2 w-2 rounded-full ${account.type === 'revenue' ? 'bg-green-400' : 'bg-red-400'}`} />
          )}
          
          <div className="flex flex-col">
            <span className={`tracking-tight ${isRoot ? 'font-black text-sm text-slate-900' : 'font-bold text-xs text-slate-600 group-hover:text-slate-900'}`}>
              {account.code} - {account.name}
            </span>
            {account.description && <span className="text-[10px] text-slate-400 font-medium">{account.description}</span>}
          </div>
        </div>
        
        <div className={`flex items-center gap-1 ${!isRoot && 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-blue-600 rounded-lg"
            onClick={() => {
              setNewAccount({ ...newAccount, parent_id: account.id, type: account.type, code: account.code + '.' });
              setIsModalOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg"
            onClick={() => {
              if (confirm("Excluir esta conta?")) {
                deleteMutation.mutate(account.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );

    if (isRoot) {
      return (
        <Card className={`border-border shadow-sm overflow-hidden rounded-2xl mb-4 ${account.type === 'revenue' ? 'bg-green-50/10' : account.type === 'expense' ? 'bg-red-50/10' : ''}`}>
          <div className={`border-b border-slate-100 ${account.type === 'revenue' ? 'bg-green-50/30' : account.type === 'expense' ? 'bg-red-50/30' : 'bg-slate-50/30'}`}>
            {content}
          </div>
          {isExpanded && (
            <div className="p-2 space-y-1">
              {children.map(child => (
                <AccountItem key={child.id} account={child} allAccounts={allAccounts} />
              ))}
            </div>
          )}
        </Card>
      );
    }

    return (
      <div className="ml-6 border-l border-slate-100 pl-2">
        {content}
        {isExpanded && hasChildren && (
          <div className="space-y-1">
            {children.map(child => (
              <AccountItem key={child.id} account={child} allAccounts={allAccounts} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
     <div className="min-h-screen flex w-full bg-background">
        <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
       <div className="flex-1 flex flex-col min-w-0">
          <Topbar title="Plano de Contas" subtitle="Estrutura de categorização financeira" toggleSidebar={() => setSidebarOpen(true)} />
         <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-blue-600 h-6 w-1 rounded-full"></div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">Plano de Contas Detalhado</h1>
                </div>
                <p className="text-muted-foreground text-sm font-medium flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  Estrutura hierárquica para controle de {accounts?.length || 0} contas
                </p>
              </div>
              <div className="flex gap-2">
                {rootAccounts.length === 0 && (
                  <Button 
                    onClick={() => seedMutation.mutate()} 
                    variant="outline" 
                    className="h-10 rounded-xl border-blue-200 text-blue-600 hover:bg-blue-50 font-bold px-5"
                    disabled={seedMutation.isPending}
                  >
                    {seedMutation.isPending ? "Carregando..." : "Carregar Plano Padrão"}
                  </Button>
                )}
                <Button 
                  onClick={() => setIsModalOpen(true)}
                  className="h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold px-6 shadow-lg shadow-blue-200"
                >
                  <Plus className="h-4 w-4 mr-2" /> Novo Grupo
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar conta por nome ou código..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border-slate-200" 
                />
              </div>
              <Button variant="outline" className="h-11 w-11 p-0 rounded-xl border-slate-200">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {rootAccounts.map(account => (
                <AccountItem key={account.id} account={account} allAccounts={accounts || []} />
              ))}
              {rootAccounts.length === 0 && !seedMutation.isPending && (
                <Card className="p-12 text-center border-dashed border-2 flex flex-col items-center justify-center bg-slate-50/50">
                  <ListTree className="h-12 w-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-bold text-slate-900">Nenhuma conta cadastrada</h3>
                  <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                    Comece carregando um plano de contas padrão ou crie sua própria estrutura.
                  </p>
                  <Button onClick={() => seedMutation.mutate()} className="rounded-xl">
                    Carregar Configuração Inicial
                  </Button>
                </Card>
              )}
            </div>
           </div>
         </main>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Nova Conta / Grupo</DialogTitle>
              <DialogDescription>
                Adicione uma nova categoria ao seu plano de contas.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome da Conta</Label>
                <Input id="name" value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})} placeholder="Ex: Venda de Produtos" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Código</Label>
                  <Input id="code" value={newAccount.code} onChange={e => setNewAccount({...newAccount, code: e.target.value})} placeholder="Ex: 1.1" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={newAccount.type} onValueChange={val => setNewAccount({...newAccount, type: val})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Receita</SelectItem>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="asset">Ativo</SelectItem>
                      <SelectItem value="liability">Passivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Descrição (Opcional)</Label>
                <Textarea id="desc" value={newAccount.description} onChange={e => setNewAccount({...newAccount, description: e.target.value})} placeholder="Para que serve esta conta..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate(newAccount)} disabled={!newAccount.name || createMutation.isPending}>
                {createMutation.isPending ? "Criando..." : "Criar Conta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
       </div>
     </div>
   );
 }
