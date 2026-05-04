import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Calculator, Calendar, Download, Filter, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DREConfig() {
  const dreData = [
    { label: "Receita Bruta de Vendas", value: 0, type: "revenue" },
    { label: "(-) Impostos sobre Vendas", value: 0, type: "expense" },
    { label: "Receita Líquida", value: 0, type: "total" },
    { label: "(-) CPV (Custo de Produtos Vendidos)", value: 0, type: "expense" },
    { label: "Lucro Bruto", value: 0, type: "total" },
    { label: "(-) Despesas Operacionais", value: 0, type: "expense" },
    { label: "(-) Despesas Administrativas", value: 0, type: "expense" },
    { label: "EBITDA / LAJIDA", value: 0, type: "total" },
    { label: "(-) Depreciação e Amortização", value: 0, type: "expense" },
    { label: "Lucro Líquido do Exercício", value: 0, type: "final" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">DRE Gerencial</h1>
          <p className="text-muted-foreground text-sm font-medium">Analise a lucratividade e o desempenho operacional</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-2 font-bold rounded-xl border-slate-200">
            <Calendar className="h-4 w-4" /> Abril 2026
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 font-bold rounded-xl border-slate-200">
            <Download className="h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-5 border-border shadow-sm rounded-2xl">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Receita Bruta</div>
          <div className="text-2xl font-black text-green-600">R$ 0,00</div>
          <div className="mt-2 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full inline-block">Aguardando dados</div>
        </Card>
        <Card className="p-5 border-border shadow-sm rounded-2xl">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Margem Bruta</div>
          <div className="text-2xl font-black text-slate-900">0,0%</div>
          <div className="mt-2 text-[10px] font-bold text-slate-400">Aguardando dados</div>
        </Card>
        <Card className="p-5 border-border shadow-sm rounded-2xl">
          <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Despesas Fixas</div>
          <div className="text-2xl font-black text-red-600">R$ 0,00</div>
          <div className="mt-2 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full inline-block">0,0% da receita</div>
        </Card>
        <Card className="p-5 border-none shadow-lg bg-slate-900 text-white rounded-2xl">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lucro Líquido</div>
          <div className="text-2xl font-black">R$ 0,00</div>
          <div className="mt-2 text-[10px] font-bold text-blue-400">Margem Líquida: 0,0%</div>
        </Card>
      </div>

      <Card className="border-border shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-50 pb-6">
          <div>
            <CardTitle className="text-base font-black text-slate-900">Demonstrativo de Resultados</CardTitle>
            <CardDescription className="text-xs font-medium">Período de referência: 01/04/2026 a 30/04/2026</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] font-black uppercase rounded-lg border-slate-200">
            <Calculator className="h-3 w-3" /> Configurar Plano de Contas
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                  <TableHead className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição das Contas</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Valor (R$)</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">% Receita</TableHead>
                  <TableHead className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {dreData.map((item, idx) => (
                <TableRow 
                  key={idx} 
                  className={`
                    ${item.type === "total" ? "bg-slate-50 font-bold" : ""} 
                    ${item.type === "final" ? "bg-slate-100 font-black" : ""}
                    hover:bg-slate-50 transition-colors
                  `}
                >
                  <TableCell className="px-6 py-3.5 text-sm">
                    <div className="flex items-center gap-2">
                      {item.type === "expense" && <span className="text-red-500 font-bold">-</span>}
                      <span className={item.type === "final" ? "text-slate-900" : "text-slate-700"}>{item.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className={`px-6 py-3.5 text-right text-sm font-bold ${item.type === "expense" ? "text-red-600" : item.type === "revenue" || item.type === "final" ? "text-green-600" : "text-slate-900"}`}>
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.value)}
                  </TableCell>
                  <TableCell className="px-6 py-3.5 text-right text-xs font-bold text-slate-400">
                    0,0%
                  </TableCell>
                  <TableCell className="px-6 py-3.5 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
