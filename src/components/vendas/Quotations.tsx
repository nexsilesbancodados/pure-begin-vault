 import React, { useState, useEffect, useCallback } from "react";
 import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, FileText, Send, Printer, User } from "lucide-react";

 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/contexts/AuthContext";
 import { toast } from "sonner";
 import { Loader2 } from "lucide-react";
 
 export function Quotations() {
   const { user } = useAuth();
   const [quotations, setQuotations] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [searchTerm, setSearchTerm] = useState("");
 
   const fetchQuotations = useCallback(async () => {
     if (!user?.id) return;
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from("sales_orders")
         .select(`
           *,
           customers (
             full_name
           )
         `)
         .eq("user_id", user.id)
         .eq("status", "pending")
         .order("created_at", { ascending: false });
 
       if (error) throw error;
       setQuotations(data || []);
     } catch (error) {
       console.error("Erro ao carregar orçamentos:", error);
       toast.error("Erro ao carregar orçamentos.");
     } finally {
       setLoading(false);
     }
   }, [user?.id]);
 
   useEffect(() => {
     fetchQuotations();
   }, [fetchQuotations]);
 
   const filteredQuotations = quotations.filter(q => {
     const s = searchTerm.toLowerCase();
     return (
       q.id.toLowerCase().includes(s) ||
       q.customers?.full_name?.toLowerCase().includes(s)
     );
   });


  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <Badge variant="secondary" className="bg-green-100 text-green-700">Aprovado</Badge>;
      case "expired": return <Badge variant="destructive">Expirado</Badge>;
      default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar orçamento..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Novo Orçamento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº Orçamento</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
             <TableBody>
               {loading ? (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                     <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                     <p className="text-xs mt-2">Carregando...</p>
                   </TableCell>
                 </TableRow>
               ) : filteredQuotations.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                     Nenhum orçamento encontrado.
                   </TableCell>
                 </TableRow>
               ) : filteredQuotations.map((orc) => (
                 <TableRow key={orc.id}>
                   <TableCell className="font-mono font-medium text-[10px]">{orc.id.slice(0, 8)}</TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       <User className="h-4 w-4 text-muted-foreground" />
                       {orc.customers?.full_name || 'Consumidor Final'}
                     </div>
                   </TableCell>
                   <TableCell>{new Date(orc.created_at).toLocaleDateString("pt-BR")}</TableCell>
                   <TableCell>-</TableCell>
                   <TableCell>{getStatusBadge(orc.status)}</TableCell>
                   <TableCell className="text-right font-semibold">
                     {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orc.total_amount || 0)}
                   </TableCell>
                   <TableCell className="text-right space-x-2">
                     <Button variant="ghost" size="icon" title="Imprimir"><Printer className="h-4 w-4" /></Button>
                     <Button variant="ghost" size="icon" title="Enviar WhatsApp"><Send className="h-4 w-4" /></Button>
                     <Button variant="ghost" size="icon" title="Gerar Venda"><FileText className="h-4 w-4" /></Button>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
