import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Calendar, User, Search, Filter, FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/estoque/compras")({
  component: ComprasPage,
});

const mockCompras = [
  { id: "OC-1250", fornecedor: "Apple Distribuidora", data: "2024-05-20", valor: "R$ 45.890", status: "Recebido", itens: 12 },
  { id: "OC-1251", fornecedor: "Importação Direta HK", data: "2024-05-22", valor: "R$ 12.300", status: "Em Trânsito", itens: 25 },
  { id: "OC-1252", fornecedor: "Acessórios Brasil", data: "2024-05-24", valor: "R$ 2.450", status: "Pendente", itens: 50 },
  { id: "OC-1249", fornecedor: "Xiaomi Oficinal", data: "2024-05-15", valor: "R$ 18.200", status: "Cancelado", itens: 10 },
];

function ComprasPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Entrada de NF / Compras" 
          subtitle="Reposição e gestão de suprimentos" 
          toggleSidebar={() => setSidebarOpen(true)} 
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por OC ou Fornecedor..." className="pl-9 h-11" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-11 gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
              <Button className="h-11 gap-2 bg-gradient-primary shadow-glow">
                <Plus className="h-4 w-4" /> Nova Ordem de Compra
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-sidebar-border bg-sidebar/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Aguardando</p>
                  <h3 className="text-xl font-bold">5 Ordens</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-sidebar-border bg-sidebar/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Em Trânsito</p>
                  <h3 className="text-xl font-bold">2 Cargas</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="border-sidebar-border bg-sidebar/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Recebidas (Mês)</p>
                  <h3 className="text-xl font-bold">14 Ordens</h3>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-sidebar-border bg-sidebar/30">
            <CardHeader className="pb-3 border-b border-sidebar-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Ordens de Compra
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-sidebar-border hover:bg-transparent">
                    <TableHead>Identificador</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead className="text-center">Itens</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCompras.map((c) => (
                    <TableRow key={c.id} className="border-sidebar-border hover:bg-white/5">
                      <TableCell className="font-bold text-primary">{c.id}</TableCell>
                      <TableCell className="font-semibold">{c.fornecedor}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(c.data).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-center">{c.itens}</TableCell>
                      <TableCell className="font-semibold">{c.valor}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`
                          ${c.status === 'Recebido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                            c.status === 'Em Trânsito' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                            c.status === 'Cancelado' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            'bg-muted text-muted-foreground'}
                        `}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">Gerenciar</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
