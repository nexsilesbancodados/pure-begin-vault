import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ShoppingCart, History, FileText, ArrowRight, Upload } from "lucide-react";
import { useState } from "react";
import { SalesImportModal } from "./SalesImportModal";
import { useNavigate } from "@tanstack/react-router";
import { SalesHistory } from "./SalesHistory";

export default function Vendas() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const navigate = useNavigate();

   const [refreshKey, setRefreshKey] = useState(0);

   return (
     <div className="p-4 md:p-6 space-y-8 animate-in fade-in duration-500">
       <SalesImportModal 
         isOpen={isImportModalOpen} 
         onClose={() => setIsImportModalOpen(false)}
         onImportSuccess={() => setRefreshKey(prev => prev + 1)}
       />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Vendas</h1>
          <p className="text-muted-foreground mt-1">Controle comercial e histórico de operações.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 h-11 px-6 border-primary/20 hover:bg-primary/5 text-primary font-bold"
          >
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button 
            onClick={() => navigate({ to: "/pdv" })} 
            className="flex items-center gap-2 h-11 px-6 bg-primary shadow-lg shadow-primary/20 text-primary-foreground font-bold"
          >
            <Plus className="h-4 w-4" /> Nova Venda (PDV)
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer group hover:border-primary/50 transition-all border-border/40 bg-card/50 shadow-sm" onClick={() => navigate({ to: "/pdv" })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">PDV</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold group-hover:text-primary transition-colors">Frente de Caixa</div>
            <p className="text-xs text-muted-foreground mt-1">Terminal de vendas rápidas</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer group hover:border-primary/50 transition-all border-border/40 bg-card/50 shadow-sm" onClick={() => navigate({ to: "/vendas/historico" })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Histórico</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold group-hover:text-primary transition-colors">Relatórios</div>
            <p className="text-xs text-muted-foreground mt-1">Análise completa de movimentações</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer group hover:border-primary/50 transition-all border-border/40 bg-card/50 shadow-sm" onClick={() => navigate({ to: "/vendas/orcamentos" })}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Orçamentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold group-hover:text-primary transition-colors">Cotações</div>
            <p className="text-xs text-muted-foreground mt-1">Gestão de propostas comerciais</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales History Integration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Histórico Recente</h2>
            <p className="text-xs text-muted-foreground">Últimas transações realizadas em tempo real.</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate({ to: "/vendas/historico" })}
            className="text-primary font-bold hover:bg-primary/5"
          >
            Ver histórico completo <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        
        <div className="rounded-3xl border border-border/40 bg-card/30 p-2 backdrop-blur-sm shadow-xl shadow-black/5">
          <SalesHistory key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
