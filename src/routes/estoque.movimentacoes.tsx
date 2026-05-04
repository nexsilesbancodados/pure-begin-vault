import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ArrowUpCircle, ArrowDownCircle, History, Filter, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StockMovementForm } from "@/components/estoque/StockMovementForm";

export const Route = createFileRoute("/estoque/movimentacoes")({
  component: MovimentacoesPage,
});

const mockMovimentos: any[] = [];

function MovimentacoesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar 
          title="Movimentações de Estoque" 
          subtitle="Log auditável de todas as alterações" 
          toggleSidebar={() => setSidebarOpen(true)} 
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por produto ou motivo..." className="pl-9 h-11" />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="h-11 gap-2">
                <Filter className="h-4 w-4" /> Filtros
              </Button>
              <Button onClick={() => setIsMovementOpen(true)} className="h-11 gap-2 bg-gradient-primary shadow-glow">
                <Plus className="h-4 w-4" /> Novo Registro
              </Button>
            </div>
          </div>

          <Card className="border-sidebar-border bg-sidebar/30">
            <CardHeader className="pb-3 border-b border-sidebar-border/50">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Histórico Recente
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-sidebar-border hover:bg-transparent">
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-center">Qtd.</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockMovimentos.map((m) => (
                    <TableRow key={m.id} className="border-sidebar-border hover:bg-white/5">
                      <TableCell className="text-xs font-medium text-muted-foreground">{m.data}</TableCell>
                      <TableCell className="font-semibold">{m.produto}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1.5 ${m.tipo === 'Entrada' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                          {m.tipo === 'Entrada' ? <ArrowUpCircle className="h-3 w-3" /> : <ArrowDownCircle className="h-3 w-3" />}
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold">{m.qtd}</TableCell>
                      <TableCell className="text-sm">{m.user}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.motivo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
      <StockMovementForm open={isMovementOpen} onOpenChange={setIsMovementOpen} />
    </div>
  );
}
