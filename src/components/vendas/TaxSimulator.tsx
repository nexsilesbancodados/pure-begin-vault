import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Landmark, ArrowRightLeft } from "lucide-react";

export function TaxSimulator() {
  const [salePrice, setSalePrice] = useState<number>(0);
  const [installments, setInstallments] = useState<string>("1");
  const [rateType, setRateType] = useState<string>("seller"); // seller pays or buyer pays

  const rates: Record<string, number> = {
    "1": 2.99,
    "2": 4.50,
    "3": 5.20,
    "6": 7.80,
    "10": 10.50,
    "12": 12.00,
  };

  const currentRate = rates[installments] || 2.99;
  const taxAmount = salePrice * (currentRate / 100);
  
  const netValue = rateType === "seller" ? salePrice - taxAmount : salePrice;
  const buyerPays = rateType === "seller" ? salePrice : salePrice + taxAmount;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Configuração da Venda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Valor do Produto/Serviço</Label>
            <Input 
              type="number" 
              placeholder="0,00"
              value={salePrice || ""} 
              onChange={(e) => setSalePrice(Number(e.target.value))} 
            />
          </div>

          <div className="space-y-2">
            <Label>Parcelamento</Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Débito / 1x Crédito (2.99%)</SelectItem>
                <SelectItem value="2">2x (4.50%)</SelectItem>
                <SelectItem value="3">3x (5.20%)</SelectItem>
                <SelectItem value="6">6x (7.80%)</SelectItem>
                <SelectItem value="10">10x (10.50%)</SelectItem>
                <SelectItem value="12">12x (12.00%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quem paga a taxa?</Label>
            <Select value={rateType} onValueChange={setRateType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seller">Vendedor (Descontar do total)</SelectItem>
                <SelectItem value="buyer">Cliente (Repassar taxa)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-primary" />
            Resumo do Recebimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-1">Você recebe líquido:</p>
            <h2 className="text-4xl font-bold text-primary">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(netValue)}
            </h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Total cobrado do cliente</span>
              <span className="font-bold">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(buyerPays)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Custo da Taxa ({currentRate}%)</span>
              <span className="text-destructive font-medium">
                -{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(taxAmount)}
              </span>
            </div>
            {installments !== "1" && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Valor de cada parcela ({installments}x)</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(buyerPays / Number(installments))}
                </span>
              </div>
            )}
          </div>

          <Button className="w-full" variant="outline">
            <ArrowRightLeft className="mr-2 h-4 w-4" /> Comparar com outra máquina
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
