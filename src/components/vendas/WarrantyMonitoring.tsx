import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ShieldAlert, ShieldCheck, Filter, Calendar } from "lucide-react";

export function WarrantyMonitoring() {
  const warranties = [
    { id: "1", product: "iPhone 13 128GB", customer: "Alice Souza", imei: "354678129033452", date: "2023-12-01", expiry: "2024-12-01", status: "active" },
    { id: "2", product: "Samsung S22 Ultra", customer: "Roberto Lima", imei: "867544091233876", date: "2024-03-15", expiry: "2025-03-15", status: "active" },
    { id: "3", product: "Xiaomi Redmi Note 11", customer: "Bruno Galvão", imei: "359981002344551", date: "2023-04-10", expiry: "2024-04-10", status: "expired" },
    { id: "4", product: "iPhone 11 64GB", customer: "Carla Dias", imei: "358872009182733", date: "2024-01-20", expiry: "2024-07-20", status: "warning" },
  ];

  const getStatusBadge = (status: string, expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    
    if (status === "expired" || expiry < today) {
      return <Badge variant="destructive">Expirada</Badge>;
    }
    
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 30) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Vence em {diffDays} dias</Badge>;
    }
    
    return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Ativa</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por IMEI, Cliente ou Produto..." className="pl-9" />
          </div>
          <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><Calendar className="h-4 w-4" /> Relatório de Vencimentos</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full text-green-700"><ShieldCheck className="h-6 w-6" /></div>
          <div><p className="text-sm text-muted-foreground">Garantias Ativas</p><p className="text-2xl font-bold">142</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-orange-100 rounded-full text-orange-700"><ShieldAlert className="h-6 w-6" /></div>
          <div><p className="text-sm text-muted-foreground">Próximas ao Vencimento</p><p className="text-2xl font-bold">12</p></div>
        </Card>
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-full text-red-700"><ShieldAlert className="h-6 w-6" /></div>
          <div><p className="text-sm text-muted-foreground">Expiradas (30 dias)</p><p className="text-2xl font-bold">28</p></div>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto / IMEI</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Data Venda</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warranties.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{w.product}</span>
                      <span className="text-xs text-muted-foreground font-mono">{w.imei}</span>
                    </div>
                  </TableCell>
                  <TableCell>{w.customer}</TableCell>
                  <TableCell>{new Date(w.date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{new Date(w.expiry).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{getStatusBadge(w.status, w.expiry)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Histórico</Button>
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
