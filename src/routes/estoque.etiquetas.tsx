import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Printer, Smartphone, Tags, Layout, CheckCircle2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/estoque/etiquetas")({
  component: EtiquetasPage,
});

function EtiquetasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Gerador de Etiquetas" 
          subtitle="Identificação profissional para seus aparelhos" 
          toggleSidebar={() => setSidebarOpen(true)} 
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configurações */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-sidebar-border bg-sidebar/30">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layout className="h-5 w-5 text-primary" /> Configuração
                  </CardTitle>
                  <CardDescription>Defina o modelo e dados da etiqueta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Modelo</label>
                    <Select defaultValue="padrao">
                      <SelectTrigger className="bg-card/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padrao">Padrão Conecta (50x30mm)</SelectItem>
                        <SelectItem value="pequeno">Compacta (30x15mm)</SelectItem>
                        <SelectItem value="imei">Foco em IMEI (60x40mm)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Produto</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Buscar iPhone 15..." className="pl-9 bg-card/50" />
                    </div>
                  </div>
                  <div className="pt-4 space-y-2">
                    <Button className="w-full gap-2 bg-gradient-primary shadow-glow">
                      <Printer className="h-4 w-4" /> Gerar para Impressão
                    </Button>
                    <Button variant="outline" className="w-full">
                      Limpar Tudo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sidebar-border bg-sidebar/30">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">Impressora Zebra ZD220 conectada e pronta.</p>
                </CardContent>
              </Card>
            </div>

            {/* Preview */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-sidebar-border bg-sidebar/30 flex flex-col items-center justify-center min-h-[400px]">
                <div className="text-center mb-8">
                  <Badge variant="outline" className="mb-2">Visualização Real</Badge>
                  <h3 className="text-muted-foreground text-sm">Preview da etiqueta selecionada</h3>
                </div>

                {/* Etiqueta Mock */}
                <div className="w-[300px] h-[180px] bg-white rounded-md shadow-2xl p-4 flex flex-col justify-between text-black relative overflow-hidden">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm uppercase leading-tight">iPhone 15 Pro Max</h4>
                      <p className="text-[10px] font-bold text-gray-500">256GB - Titânio Natural</p>
                    </div>
                    <div className="bg-black text-white px-1.5 py-0.5 rounded text-[8px] font-black italic">
                      CONECTA
                    </div>
                  </div>

                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <div className="space-y-0">
                        <p className="text-[8px] text-gray-400 font-bold uppercase">IMEI 1</p>
                        <p className="text-[10px] font-mono font-bold leading-none tracking-tighter">356789123456789</p>
                      </div>
                      <div className="space-y-0">
                        <p className="text-[8px] text-gray-400 font-bold uppercase">Serial</p>
                        <p className="text-[10px] font-mono font-bold leading-none tracking-tighter">G6TY678KL09</p>
                      </div>
                    </div>
                    <div className="bg-gray-100 p-1.5 rounded border border-gray-200">
                      <QrCode className="h-10 w-10 text-black" />
                    </div>
                  </div>
                  
                  {/* Barcode Mock */}
                  <div className="h-6 w-full flex gap-0.5 items-end justify-center mt-2 overflow-hidden opacity-30">
                    {Array.from({ length: 40 }).map((_, i) => (
                      <div key={i} className="bg-black w-[2px]" style={{ height: `${Math.random() * 100}%` }}></div>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Layout className="h-4 w-4" /> Alterar Fundo
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Tags className="h-4 w-4" /> Adicionar Logo
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
