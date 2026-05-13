import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CreditCard, Landmark, ArrowRightLeft, X, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { Link } from "@tanstack/react-router";

type Terminal = {
  id: string;
  name: string;
  brand: string;
  rates?: { debito?: number; credito?: number; parcelado?: number; pix?: number };
};
type Modality = "debito" | "credito" | "parcelado" | "pix";

const BRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function getRate(t: Terminal | null, m: Modality, installments: number): number {
  if (!t?.rates) return 0;
  if (m === "debito") return t.rates.debito ?? 0;
  if (m === "pix") return t.rates.pix ?? 0;
  if (m === "credito" && installments === 1) return t.rates.credito ?? 0;
  return t.rates.parcelado ?? t.rates.credito ?? 0;
}

function Calculator({
  price,
  terminal,
  modality,
  installments,
  who,
}: {
  price: number;
  terminal: Terminal | null;
  modality: Modality;
  installments: number;
  who: "seller" | "buyer";
}) {
  const rate = getRate(terminal, modality, installments);
  const tax = price * (rate / 100);
  const net = who === "seller" ? price - tax : price;
  const buyer = who === "seller" ? price : price + tax;
  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4 text-primary" />
          {terminal?.name ?? "Sem maquininha"}{" "}
          <span className="text-xs font-normal text-muted-foreground">({terminal?.brand})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-1">Você recebe líquido:</p>
          <h2 className="text-3xl font-black text-primary">{BRL(net)}</h2>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente paga</span>
            <span className="font-bold">{BRL(buyer)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxa ({rate.toFixed(2)}%)</span>
            <span className="text-destructive font-medium">-{BRL(tax)}</span>
          </div>
          {installments > 1 && (
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Parcela</span>
              <span className="font-bold">{BRL(buyer / installments)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TaxSimulator() {
  const { orgId } = useOrg();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [terminalA, setTerminalA] = useState<string>("");
  const [terminalB, setTerminalB] = useState<string>("");
  const [compare, setCompare] = useState(false);
  const [modality, setModality] = useState<Modality>("credito");
  const [installments, setInstallments] = useState<number>(1);
  const [who, setWho] = useState<"seller" | "buyer">("seller");

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("payment_terminals")
        .select("*")
        .eq("organization_id", orgId)
        .eq("active", true)
        .order("name");
      setTerminals(data ?? []);
      if (data?.[0]) setTerminalA(data[0].id);
      if (data?.[1]) setTerminalB(data[1].id);
    })();
  }, [orgId]);

  const tA = terminals.find((t) => t.id === terminalA) ?? null;
  const tB = terminals.find((t) => t.id === terminalB) ?? null;

  if (terminals.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="font-bold mb-1">Nenhuma maquininha cadastrada</p>
        <p className="text-sm text-muted-foreground mb-4">
          Cadastre suas maquininhas com taxas reais pra simular líquido das vendas.
        </p>
        <Link to="/financeiro/maquininhas">
          <Button>
            <Settings className="h-4 w-4 mr-2" /> Cadastrar maquininhas
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Configuração da venda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Valor</Label>
              <Input
                type="number"
                placeholder="0,00"
                value={salePrice || ""}
                onChange={(e) => setSalePrice(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Modalidade</Label>
              <Select value={modality} onValueChange={(v) => setModality(v as Modality)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(modality === "credito" || modality === "parcelado") && (
              <div>
                <Label>Parcelas</Label>
                <Select
                  value={String(installments)}
                  onValueChange={(v) => setInstallments(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Quem paga a taxa</Label>
              <Select value={who} onValueChange={(v) => setWho(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seller">Vendedor</SelectItem>
                  <SelectItem value="buyer">Cliente (repassar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1">
              <Label>Maquininha A</Label>
              <Select value={terminalA} onValueChange={setTerminalA}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {terminals.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.brand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {compare && (
              <div className="flex-1">
                <Label>Maquininha B (comparar)</Label>
                <Select value={terminalB} onValueChange={setTerminalB}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {terminals.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({t.brand})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button variant="outline" onClick={() => setCompare(!compare)} className="self-end">
              {compare ? (
                <>
                  <X className="h-4 w-4 mr-2" /> Fechar comparação
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" /> Comparar 2 máquinas
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${compare ? "md:grid-cols-2" : ""}`}>
        <Calculator
          price={salePrice}
          terminal={tA}
          modality={modality}
          installments={installments}
          who={who}
        />
        {compare && (
          <Calculator
            price={salePrice}
            terminal={tB}
            modality={modality}
            installments={installments}
            who={who}
          />
        )}
      </div>
    </div>
  );
}
