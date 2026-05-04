import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertCircle, ShoppingCart, TrendingDown } from "lucide-react";

export function Stockouts() {
   const stockouts = [
     { id: "1", name: "iPhone 11 64GB - Preto", stock: 0, minStock: 2, lastSold: "2024-04-15" },
     { id: "2", name: "Cabo Lightning Original", stock: 1, minStock: 10, lastSold: "2024-04-21" },
     { id: "3", name: "Tela iPhone 13 Original", stock: 0, minStock: 3, lastSold: "2024-04-10" },
     { id: "4", name: "Bateria iPhone XR (Premium)", stock: 2, minStock: 5, lastSold: "2024-04-20" },
     { id: "5", name: "iPhone 12 128GB - Branco", stock: 0, minStock: 1, lastSold: "2024-04-18" },
     { id: "6", name: "Fone de Ouvido P2", stock: 0, minStock: 5, lastSold: "2024-04-12" },
     { id: "7", name: "Capa Transparente G54", stock: 0, minStock: 3, lastSold: "2024-04-19" },
     { id: "8", name: "Película Privacidade S23", stock: 0, minStock: 10, lastSold: "2024-04-20" },
   ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" /> Produtos sem Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">8 Itens</div>
            <p className="text-xs text-red-600/70">Necessitam de reposição imediata</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-700">
              <TrendingDown className="h-4 w-4" /> Estoque Crítico (Abaixo do Mínimo)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">15 Itens</div>
            <p className="text-xs text-orange-600/70">Abaixo do nível de segurança</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reposição Necessária</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Estoque Atual</TableHead>
                <TableHead className="text-center">Estoque Mínimo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última Venda</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockouts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-center">
                    <span className={item.stock === 0 ? "text-red-600 font-bold" : "text-orange-600 font-bold"}>
                      {item.stock}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">{item.minStock}</TableCell>
                  <TableCell>
                    {item.stock === 0 ? (
                      <Badge variant="destructive">Esgotado</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">Crítico</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(item.lastSold).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" className="gap-2">
                      <ShoppingCart className="h-3 w-3" /> Comprar
                    </Button>
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
