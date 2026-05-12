import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/vendas/calculadora")({
  component: CalculadoraAparelhosPage,
});

type Condicao = "novo" | "seminovo" | "usado" | "ruim";
type SimNumero = 0 | 1 | 2;

const CONDICAO_LABEL: Record<Condicao, string> = {
  novo: "Novo (lacrado)",
  seminovo: "Seminovo (sem riscos)",
  usado: "Usado (marcas de uso)",
  ruim: "Ruim (precisa reparo)",
};

// Multiplicador sobre preço de mercado para preço de COMPRA (loja paga ao cliente)
const CONDICAO_FATOR: Record<Condicao, number> = {
  novo: 0.85,      // novo lacrado: 85% do mercado
  seminovo: 0.70,  // sem riscos: 70%
  usado: 0.55,     // usado normal: 55%
  ruim: 0.35,      // com defeito: 35%
};

function CalculadoraAparelhosPage() {
  const [modelo, setModelo] = useState("");
  const [precoMercado, setPrecoMercado] = useState<number>(0);
  const [condicao, setCondicao] = useState<Condicao>("seminovo");
  const [bateria, setBateria] = useState<number>(100); // % de saúde
  const [telaTrincada, setTelaTrincada] = useState(false);
  const [acessorios, setAcessorios] = useState(false); // caixa/carregador
  const [margem, setMargem] = useState<number>(25); // % margem de revenda

  const calc = useMemo(() => {
    if (precoMercado <= 0) return null;
    let valor = precoMercado * CONDICAO_FATOR[condicao];
    // Bateria: cada 10% abaixo de 90 reduz 1%
    if (bateria < 90) valor *= 1 - Math.min(0.15, (90 - bateria) / 1000);
    // Tela trincada: -30%
    if (telaTrincada) valor *= 0.7;
    // Sem acessórios: -5%
    if (!acessorios) valor *= 0.95;
    const compra = Math.max(0, Math.round(valor));
    const venda = Math.round(compra * (1 + margem / 100));
    const lucro = venda - compra;
    return { compra, venda, lucro };
  }, [precoMercado, condicao, bateria, telaTrincada, acessorios, margem]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Calculadora de Aparelhos" subtitle="Avaliação para compra de usados" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3 p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-5 w-5 text-primary" />
                <h2 className="font-black text-lg">Dados do Aparelho</h2>
              </div>

              <div>
                <Label htmlFor="modelo">Modelo</Label>
                <Input
                  id="modelo"
                  placeholder="Ex: iPhone 14 Pro 256GB"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="precoMercado">Preço de mercado (R$)</Label>
                <Input
                  id="precoMercado"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ex: 4500"
                  value={precoMercado || ""}
                  onChange={(e) => setPrecoMercado(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Valor médio de venda no estado atual (consulte OLX, Mercado Livre).
                </p>
              </div>

              <div>
                <Label>Condição</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(Object.keys(CONDICAO_LABEL) as Condicao[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondicao(c)}
                      className={`px-3 py-2 rounded-lg text-sm font-bold border transition ${
                        condicao === c
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:border-primary/40"
                      }`}
                    >
                      {CONDICAO_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="bateria">Saúde da bateria: {bateria}%</Label>
                <Input
                  id="bateria"
                  type="range"
                  min={50}
                  max={100}
                  step={1}
                  value={bateria}
                  onChange={(e) => setBateria(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={telaTrincada}
                    onChange={(e) => setTelaTrincada(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Tela trincada (−30%)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={acessorios}
                    onChange={(e) => setAcessorios(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Acompanha caixa e carregador (sem isso, −5%)
                </label>
              </div>

              <div>
                <Label htmlFor="margem">Margem de revenda alvo: {margem}%</Label>
                <Input
                  id="margem"
                  type="range"
                  min={10}
                  max={60}
                  step={1}
                  value={margem}
                  onChange={(e) => setMargem(Number(e.target.value))}
                />
              </div>
            </Card>

            <Card className="lg:col-span-2 p-6 bg-gradient-to-br from-primary/10 to-card flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
                Avaliação
              </h3>
              {!calc ? (
                <div className="flex-1 flex items-center justify-center text-center">
                  <p className="text-sm text-muted-foreground">
                    Preencha o preço de mercado para calcular.
                  </p>
                </div>
              ) : (
                <div className="space-y-5 flex-1">
                  <div>
                    <p className="text-xs text-muted-foreground">Você paga ao cliente</p>
                    <p className="text-3xl font-black text-foreground">
                      R$ {calc.compra.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="h-px bg-border" />
                  <div>
                    <p className="text-xs text-muted-foreground">Preço de revenda sugerido</p>
                    <p className="text-2xl font-black text-primary">
                      R$ {calc.venda.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/30">
                    {calc.lucro > 0 ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm font-bold">
                      Lucro: R$ {calc.lucro.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {modelo && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const txt = `Avaliação ${modelo}\nCondição: ${CONDICAO_LABEL[condicao]}\nBateria: ${bateria}%\nCompra: R$ ${calc.compra}\nRevenda: R$ ${calc.venda}\nLucro: R$ ${calc.lucro}`;
                        navigator.clipboard.writeText(txt);
                      }}
                    >
                      Copiar resumo
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
