import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Battery, Monitor, ShieldCheck, DollarSign } from "lucide-react";

export function DeviceCalculator() {
  const [baseValue, setBaseValue] = useState<number>(0);
  const [batteryHealth, setBatteryHealth] = useState<number>(100);
  const [screenCondition, setScreenCondition] = useState<string>("excellent");
  const [bodyCondition, setBodyCondition] = useState<string>("excellent");

  const calculateResult = () => {
    let multiplier = 1.0;
    if (batteryHealth < 80) multiplier -= 0.15;
    else if (batteryHealth < 90) multiplier -= 0.05;

    if (screenCondition === "good") multiplier -= 0.1;
    if (screenCondition === "fair") multiplier -= 0.25;
    if (screenCondition === "broken") multiplier -= 0.5;

    if (bodyCondition === "good") multiplier -= 0.05;
    if (bodyCondition === "fair") multiplier -= 0.15;
    if (bodyCondition === "dent") multiplier -= 0.3;

    const result = baseValue * multiplier;
    return result > 0 ? result : 0;
  };

  const finalValue = calculateResult();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Dados do Aparelho
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Valor de Mercado (Novo ou Semi-novo)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="Ex: 5000"
                className="pl-9"
                value={baseValue || ""}
                onChange={(e) => setBaseValue(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Battery className="h-4 w-4" /> Saúde da Bateria: {batteryHealth}%
            </Label>
            <Slider
              value={[batteryHealth]}
              onValueChange={(val) => setBatteryHealth(val[0])}
              max={100}
              min={50}
              step={1}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Monitor className="h-4 w-4" /> Estado da Tela
              </Label>
              <Select value={screenCondition} onValueChange={setScreenCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excelente</SelectItem>
                  <SelectItem value="good">Bom</SelectItem>
                  <SelectItem value="fair">Regular</SelectItem>
                  <SelectItem value="broken">Quebrada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" /> Carcaça
              </Label>
              <Select value={bodyCondition} onValueChange={setBodyCondition}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Impecável</SelectItem>
                  <SelectItem value="good">Sinais de uso</SelectItem>
                  <SelectItem value="fair">Desgastada</SelectItem>
                  <SelectItem value="dent">Amassada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Sugestão de Compra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2 font-medium">
              Valor Recomendado
            </p>
            <h2 className="text-5xl font-bold text-primary">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(finalValue)}
            </h2>
          </div>
          <Button className="w-full mt-4" size="lg">
            Gerar Comprovante
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
