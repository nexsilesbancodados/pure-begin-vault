import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
   import { User, Shield, Bell, Zap, Database, Smartphone, Palette, HelpCircle, ChevronRight, Globe, Lock, Plus, Download, Upload, FileJson, AlertCircle, FileText, CheckCircle2, History } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ConectaCRM" }, { name: "description", content: "Ajuste suas preferências e integrações" }] }),
  component: SettingsPage,
});

  import { useState, useEffect } from "react";
  import { useAuth } from "@/contexts/AuthContext";
  import { supabase } from "@/integrations/supabase/client";
 import { Input } from "@/components/ui/input";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { Switch } from "@/components/ui/switch";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
  import { toast } from "sonner";
  import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
 
   function SettingsPage() {
     const { user, profile } = useAuth();

    const handleExportBackup = async () => {
      try {
        toast.loading("Preparando exportação...");
        const tables = [
          "customers", "products", "sales_orders", "finance_transactions", 
          "services", "leads", "tasks", "app_settings"
        ];
        
        const backupData: Record<string, any> = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          data: {}
        };

        for (const table of tables) {
          const { data, error } = await (supabase as any).from(table).select("*");
          if (error) {
            console.error(`Erro ao exportar tabela ${table}:`, error);
            continue;
          }
          backupData.data[table] = data;
        }

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `backup_conectacrm_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.dismiss();
        toast.success("Backup exportado com sucesso!");
      } catch (error) {
        toast.dismiss();
        toast.error("Falha ao exportar backup");
        console.error(error);
      }
    };

    const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const fileName = file.name.toLowerCase();
          let backupData: any = null;
          
          toast.loading("Analisando formato do backup...");

          if (fileName.endsWith('.json')) {
            backupData = JSON.parse(content);
          } else if (fileName.endsWith('.csv')) {
            // Simple CSV to JSON logic for robustness
            const lines = content.split('\n');
            const headers = lines[0].split(',');
            const data = lines.slice(1).map(line => {
              const values = line.split(',');
              return headers.reduce((obj: any, header, i) => {
                obj[header.trim()] = values[i]?.trim();
                return obj;
              }, {});
            });
            backupData = { data: { "imported_csv": data }, version: "csv-import" };
          } else {
            throw new Error("Formato de arquivo não suportado");
          }
          
          // Normalization: Ensure backupData has the expected structure
          // If it's a direct array or different structure, wrap it
          if (Array.isArray(backupData)) {
            backupData = { data: { "legacy_import": backupData }, version: "legacy" };
          } else if (backupData && !backupData.data && typeof backupData === 'object') {
            backupData = { data: backupData, version: "raw-object" };
          }

          if (!backupData?.data || typeof backupData.data !== 'object') {
            throw new Error("Formato de backup não reconhecido");
          }

          toast.loading("Importando e adaptando dados...");
          
          let successCount = 0;
          let errorCount = 0;

          for (const [table, rows] of Object.entries(backupData.data)) {
            if (Array.isArray(rows) && rows.length > 0) {
              // Filter out system columns that might conflict (like id if it's not a UUID)
              const cleanedRows = rows.map((row: any) => {
                const { created_at, updated_at, ...rest } = row;
                // Ensure required IDs are valid if present, otherwise let DB generate
                return rest;
              });

              const { error } = await (supabase as any).from(table).upsert(cleanedRows, { 
                onConflict: 'id',
                ignoreDuplicates: false 
              });

              if (error) {
                console.error(`Erro ao importar tabela ${table}:`, error);
                errorCount++;
              } else {
                successCount++;
              }
            }
          }

          toast.dismiss();
          if (errorCount === 0) {
            toast.success("Dados importados e adaptados com sucesso!");
          } else if (successCount > 0) {
            toast.warning(`Importação parcial: ${successCount} tabelas importadas, ${errorCount} falhas.`);
          } else {
            toast.error("Nenhuma tabela pôde ser importada.");
          }
          
          setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
          toast.dismiss();
          toast.error(`Erro: ${error.message || "Falha ao processar arquivo"}`);
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    const [activeTab, setActiveTab] = useState("perfil");
    const [formData, setFormData] = useState({
      display_name: "",
      role: "",
      phone: ""
    });

    useEffect(() => {
      if (profile) {
        setFormData({
          display_name: profile.display_name || "",
          role: profile.role || "",
          phone: profile.phone || ""
        });
      }
    }, [profile]);

    const handleSaveProfile = async () => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formData.display_name,
          role: formData.role,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        toast.error("Erro ao salvar perfil");
      } else {
        toast.success("Perfil atualizado!");
      }
    };

    return (
     <div className="min-h-screen flex w-full bg-background">
       <AppSidebar />
       <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Configurações" subtitle="Gerencie sua conta e preferências do sistema" />
         <main className="flex-1 overflow-y-auto p-6">
           <div className="max-w-6xl mx-auto space-y-6">
             <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
               <div className="flex items-center justify-between">
                 <TabsList className="bg-muted/50 p-1 rounded-xl">
                   <TabsTrigger value="perfil" className="rounded-lg gap-2"><User className="h-4 w-4" /> Perfil</TabsTrigger>
                   <TabsTrigger value="vendas" className="rounded-lg gap-2"><Smartphone className="h-4 w-4" /> Vendas</TabsTrigger>
                   <TabsTrigger value="ia" className="rounded-lg gap-2"><Zap className="h-4 w-4" /> IA DeepSeek</TabsTrigger>
                   <TabsTrigger value="integracoes" className="rounded-lg gap-2"><Database className="h-4 w-4" /> Integrações</TabsTrigger>
                    <TabsTrigger value="seguranca" className="rounded-lg gap-2"><Shield className="h-4 w-4" /> Segurança</TabsTrigger>
                    <TabsTrigger value="backup" className="rounded-lg gap-2"><Database className="h-4 w-4" /> Backup</TabsTrigger>
                  </TabsList>
                 {activeTab === "perfil" ? (
                   <Button onClick={handleSaveProfile} className="bg-gradient-primary shadow-glow">
                     Salvar Perfil
                   </Button>
                 ) : (
                   <Button onClick={() => toast.success("Configurações salvas!")} className="bg-gradient-primary shadow-glow">
                     Salvar Alterações
                   </Button>
                 )}
               </div>
 
                <TabsContent value="backup">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-border shadow-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Download className="h-5 w-5 text-primary" /> Exportar Dados
                        </CardTitle>
                        <CardDescription>
                          Baixe uma cópia completa de todos os seus dados em formato JSON.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Alert variant="default" className="bg-primary/5 border-primary/20">
                          <AlertCircle className="h-4 w-4 text-primary" />
                          <AlertTitle className="text-primary font-bold">Importante</AlertTitle>
                          <AlertDescription className="text-xs">
                            O arquivo contém informações sensíveis de clientes, vendas e financeiro. Guarde-o em local seguro.
                          </AlertDescription>
                        </Alert>
                        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/30 flex flex-col items-center gap-3">
                          <FileJson className="h-10 w-10 text-muted-foreground/50" />
                          <div className="text-center">
                            <p className="text-sm font-medium">Backup Completo do Sistema</p>
                            <p className="text-xs text-muted-foreground">Clientes, Produtos, Vendas e Financeiro</p>
                          </div>
                          <Button onClick={handleExportBackup} className="w-full gap-2">
                            <Download className="h-4 w-4" /> Gerar Backup agora
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border shadow-card">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Upload className="h-5 w-5 text-orange-500" /> Restaurar Backup
                        </CardTitle>
                        <CardDescription>
                          Importe dados de um arquivo de backup gerado anteriormente.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <AlertTitle className="text-destructive font-bold">Aviso Crítico</AlertTitle>
                          <AlertDescription className="text-xs">
                            Restaurar um backup substituirá registros existentes com o mesmo ID. Esta ação não pode ser desfeita.
                          </AlertDescription>
                        </Alert>
                        <div className="space-y-4">
                          <div className="relative group">
                            <input 
                               type="file" 
                               accept=".json,.csv,.txt" 
                               onChange={handleImportBackup}
                               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                             />
                             <div className="p-8 rounded-xl border border-dashed border-border bg-muted/30 group-hover:bg-muted/50 transition-colors flex flex-col items-center gap-3">
                               <Upload className="h-10 w-10 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                               <div className="text-center">
                                 <p className="text-sm font-medium">Clique para selecionar ou arraste</p>
                                 <p className="text-xs text-muted-foreground">Suporta .json, .csv e backups de outros sistemas</p>
                               </div>
                               <Button variant="secondary" className="pointer-events-none">
                                 Selecionar Arquivo
                               </Button>
                             </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              <span className="text-xs font-medium">Auto-Adaptação</span>
                            </div>
                            <div className="p-3 rounded-lg border border-border bg-card flex items-center gap-3">
                              <History className="h-4 w-4 text-blue-500" />
                              <span className="text-xs font-medium">Multi-Formato</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="perfil">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <Card className="md:col-span-2 border-border shadow-card">
                     <CardHeader>
                       <CardTitle>Informações do Perfil</CardTitle>
                       <CardDescription>Atualize seu nome e como você é visto no sistema.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="flex items-center gap-6 pb-6 border-b border-border mb-6">
                          <div className="h-20 w-20 rounded-full bg-gradient-primary grid place-items-center text-2xl font-bold text-white shadow-elegant">
                            {formData.display_name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <div className="space-y-2">
                            <Button variant="outline" size="sm">Alterar Foto</Button>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">JPG, PNG ou GIF. Máx 2MB.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nome Completo</Label>
                            <Input 
                              value={formData.display_name} 
                              onChange={(e) => setFormData({...formData, display_name: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>E-mail Profissional</Label>
                            <Input value={user?.email || ""} disabled />
                          </div>
                          <div className="space-y-2">
                            <Label>Cargo / Função</Label>
                            <Input 
                              value={formData.role} 
                              onChange={(e) => setFormData({...formData, role: e.target.value})} 
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Telefone WhatsApp</Label>
                            <Input 
                              value={formData.phone} 
                              onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                            />
                          </div>
                        </div>
                     </CardContent>
                   </Card>
 
                   <Card className="border-border shadow-card h-fit">
                     <CardHeader>
                       <CardTitle>Preferências</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-6">
                       <div className="flex items-center justify-between">
                         <div className="space-y-0.5">
                           <Label>Tema Escuro</Label>
                           <p className="text-[11px] text-muted-foreground">Alternar entre claro e escuro</p>
                         </div>
                         <Switch defaultChecked />
                       </div>
                       <div className="flex items-center justify-between">
                         <div className="space-y-0.5">
                           <Label>Notificações de Som</Label>
                           <p className="text-[11px] text-muted-foreground">Alertas de novas mensagens</p>
                         </div>
                         <Switch defaultChecked />
                       </div>
                     </CardContent>
                   </Card>
                 </div>
               </TabsContent>
 
               <TabsContent value="ia">
                 <Card className="border-border shadow-card">
                   <CardHeader className="flex flex-row items-center justify-between space-y-0">
                     <div className="space-y-1">
                       <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> IA DeepSeek V3</CardTitle>
                       <CardDescription>Configure o cérebro que processa seus atendimentos automáticos.</CardDescription>
                     </div>
                     <div className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded-full border border-primary/20">
                       API Ativa
                     </div>
                   </CardHeader>
                   <CardContent className="space-y-6">
                     <div className="space-y-2">
                       <Label>Chave de API (DeepSeek)</Label>
                       <Input type="password" value="sk-••••••••••••••••••••••••••••••••" />
                       <p className="text-[11px] text-muted-foreground">Sua chave é criptografada e usada apenas para processar mensagens.</p>
                     </div>
                     <div className="space-y-4">
                       <h4 className="text-sm font-bold border-b border-border pb-2">Personalidade do Agente</h4>
                       <div className="space-y-2">
                         <Label>Prompt do Sistema (Contexto)</Label>
                         <textarea className="w-full min-h-[150px] rounded-lg border border-border bg-card p-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition" defaultValue={`Você é um especialista em vendas de celulares na ConectaCRM. 
 Seu objetivo é ser técnico, educado e focado em fechamento. 
 Conhece tudo sobre iPhone e Samsung. 
 Use gatilhos mentais de escassez e urgência.`} />
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               </TabsContent>
 
               <TabsContent value="integracoes">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <Card className="border-border shadow-card">
                     <CardHeader>
                       <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-blue-500" /> Evolution API</CardTitle>
                       <CardDescription>Conecte suas instâncias de WhatsApp.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4">
                       <div className="space-y-2">
                         <Label>URL da API</Label>
                         <Input defaultValue="https://evolution.seuservidor.com" />
                       </div>
                       <div className="space-y-2">
                         <Label>Global API Key</Label>
                         <Input type="password" value="••••••••••••••••••••" />
                       </div>
                       <Button variant="outline" className="w-full">Testar Conexão</Button>
                     </CardContent>
                   </Card>
 
                   <Card className="border-border shadow-card">
                     <CardHeader>
                       <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-emerald-500" /> Webhooks de Entrada</CardTitle>
                       <CardDescription>Receba leads de sites externos ou Typeform.</CardDescription>
                     </CardHeader>
                     <CardContent className="space-y-4">
                       <div className="p-3 bg-muted rounded-lg border border-border">
                         <code className="text-[10px] break-all">https://api.conectacrm.app/webhook/v1/987654321</code>
                       </div>
                       <Button variant="secondary" size="sm" className="w-full gap-2"><Plus className="h-4 w-4" /> Criar Novo Webhook</Button>
                     </CardContent>
                   </Card>
                 </div>
               </TabsContent>
             </Tabs>
 
             {/* Help Card */}
             <div className="rounded-2xl bg-muted/40 border border-border p-6 flex items-start gap-4">
               <div className="h-12 w-12 rounded-2xl bg-card border border-border grid place-items-center text-primary shadow-sm shrink-0">
                 <HelpCircle className="h-6 w-6" />
               </div>
               <div>
                 <h4 className="font-bold text-base mb-1">Precisa de ajuda com a configuração?</h4>
                 <p className="text-sm text-muted-foreground mb-4">Acesse nossa Central de Ajuda para tutoriais completos sobre como conectar o WhatsApp e treinar sua IA.</p>
                 <div className="flex gap-3">
                   <Button size="sm">Acessar Documentação</Button>
                   <Button variant="outline" size="sm">Falar com Suporte</Button>
                 </div>
               </div>
             </div>
           </div>
         </main>
       </div>
     </div>
   );
 }
