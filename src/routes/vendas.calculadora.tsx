import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calculator,
  TrendingDown,
  TrendingUp,
  Copy,
  Share2,
  History,
  Trash2,
  Info,
  Percent,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/vendas/calculadora")({
  component: CalculadoraAparelhosPage,
});

type Condicao = "novo" | "seminovo" | "usado" | "ruim";
type Origem = "nacional" | "importado";

const CONDICAO_LABEL: Record<Condicao, string> = {
  novo: "Novo (lacrado)",
  seminovo: "Seminovo (sem riscos)",
  usado: "Usado (marcas de uso)",
  ruim: "Ruim (precisa reparo)",
};

const CONDICAO_FATOR: Record<Condicao, number> = {
  novo: 0.85,
  seminovo: 0.7,
  usado: 0.55,
  ruim: 0.35,
};

const CONDICAO_COR: Record<Condicao, string> = {
  novo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  seminovo: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  usado: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  ruim: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

type HistItem = {
  id: string;
  modelo: string;
  compra: number;
  venda: number;
  lucro: number;
  data: string;
};

const HIST_KEY = "calc_aparelhos_hist_v2";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CalculadoraAparelhosPage() {
  const [modelo, setModelo] = useState("");
  const [precoMercado, setPrecoMercado] = useState<number>(0);
  const [condicao, setCondicao] = useState<Condicao>("seminovo");
  const [bateria, setBateria] = useState<number>(100);
  const [telaTrincada, setTelaTrincada] = useState(false);
  const [tampaTrincada, setTampaTrincada] = useState(false);
  const [faceTouchId, setFaceTouchId] = useState(true);
  const [acessorios, setAcessorios] = useState(false);
  const [notaFiscal, setNotaFiscal] = useState(false);
  const [origem, setOrigem] = useState<Origem>("nacional");
  const [margem, setMargem] = useState<number>(25);
  const [custosExtras, setCustosExtras] = useState<number>(0); // reparo estimado
  const [historico, setHistorico] = useState<HistItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIST_KEY);
      if (raw) setHistorico(JSON.parse(raw));
    } catch {}
  }, []);

  const calc = useMemo(() => {
    if (precoMercado <= 0) return null;
    let valor = precoMercado * CONDICAO_FATOR[condicao];
    const ajustes: { label: string; delta: number }[] = [];

    if (bateria < 90) {
      const f = 1 - Math.min(0.15, (90 - bateria) / 500);
      const antes = valor;
      valor *= f;
      ajustes.push({ label: `Bateria ${bateria}%`, delta: valor - antes });
    }
    if (telaTrincada) {
      const antes = valor;
      valor *= 0.7;
      ajustes.push({ label: "Tela trincada", delta: valor - antes });
    }
    if (tampaTrincada) {
      const antes = valor;
      valor *= 0.9;
      ajustes.push({ label: "Tampa trincada", delta: valor - antes });
    }
    if (!faceTouchId) {
      const antes = valor;
      valor *= 0.85;
      ajustes.push({ label: "Face/Touch ID inoperante", delta: valor - antes });
    }
    if (!acessorios) {
      const antes = valor;
      valor *= 0.95;
      ajustes.push({ label: "Sem caixa/carregador", delta: valor - antes });
    }
    if (notaFiscal) {
      const antes = valor;
      valor *= 1.05;
      ajustes.push({ label: "Com nota fiscal", delta: valor - antes });
    }
    if (origem === "importado") {
      const antes = valor;
      valor *= 0.9;
      ajustes.push({ label: "Aparelho importado", delta: valor - antes });
    }

    const compra = Math.max(0, Math.round(valor - custosExtras));
    const custoTotal = compra + custosExtras;
    const venda = Math.round(custoTotal * (1 + margem / 100));
    const lucro = venda - custoTotal;
    const roi = custoTotal > 0 ? (lucro / custoTotal) * 100 : 0;
    return { compra, venda, lucro, roi, custoTotal, ajustes };
  }, [
    precoMercado,
    condicao,
    bateria,
    telaTrincada,
    tampaTrincada,
    faceTouchId,
    acessorios,
    notaFiscal,
    origem,
    margem,
    custosExtras,
  ]);

  const salvar = () => {
    if (!calc || !modelo.trim()) {
      toast.error("Informe o modelo antes de salvar");
      return;
    }
    const item: HistItem = {
      id: crypto.randomUUID(),
      modelo,
      compra: calc.compra,
      venda: calc.venda,
      lucro: calc.lucro,
      data: new Date().toISOString(),
    };
    const novo = [item, ...historico].slice(0, 20);
    setHistorico(novo);
    localStorage.setItem(HIST_KEY, JSON.stringify(novo));
    toast.success("Avaliação salva no histórico");
  };

  const limparHistorico = () => {
    setHistorico([]);
    localStorage.removeItem(HIST_KEY);
  };

  const resumoTexto = calc
    ? `📱 *Avaliação ${modelo || "Aparelho"}*\n` +
      `Condição: ${CONDICAO_LABEL[condicao]}\n` +
      `Bateria: ${bateria}%\n` +
      `\n💰 Oferta de compra: *${brl(calc.compra)}*\n` +
      `Revenda sugerida: ${brl(calc.venda)}\n` +
      `Lucro estimado: ${brl(calc.lucro)} (${calc.roi.toFixed(1)}% ROI)`
    : "";

  const copiar = () => {
    navigator.clipboard.writeText(resumoTexto);
    toast.success("Resumo copiado");
  };

  const compartilharWhats = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(resumoTexto)}`;
    window.open(url, "_blank");
  };

  const limpar = () => {
    setModelo("");
    setPrecoMercado(0);
    setCondicao("seminovo");
    setBateria(100);
    setTelaTrincada(false);
    setTampaTrincada(false);
    setFaceTouchId(true);
    setAcessorios(false);
    setNotaFiscal(false);
    setOrigem("nacional");
    setMargem(25);
    setCustosExtras(0);
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Calculadora de Aparelhos" subtitle="Avaliação profissional para compra de usados" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Formulário */}
            <Card className="lg:col-span-3 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  <h2 className="font-black text-lg">Dados do Aparelho</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={limpar}>
                  Limpar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>
              </div>

              <div>
                <Label>Condição geral</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                  {(Object.keys(CONDICAO_LABEL) as Condicao[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCondicao(c)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border transition ${
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
                <Label htmlFor="bateria" className="flex items-center justify-between">
                  <span>Saúde da bateria</span>
                  <Badge variant="outline">{bateria}%</Badge>
                </Label>
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

              <Separator />

              <div>
                <Label className="mb-2 block">Avarias e características</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telaTrincada}
                      onChange={(e) => setTelaTrincada(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Tela trincada <span className="text-xs text-muted-foreground">(−30%)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tampaTrincada}
                      onChange={(e) => setTampaTrincada(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Tampa trincada <span className="text-xs text-muted-foreground">(−10%)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!faceTouchId}
                      onChange={(e) => setFaceTouchId(!e.target.checked)}
                      className="h-4 w-4"
                    />
                    Face/Touch ID inoperante <span className="text-xs text-muted-foreground">(−15%)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acessorios}
                      onChange={(e) => setAcessorios(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Acompanha caixa/carregador <span className="text-xs text-muted-foreground">(+5%)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notaFiscal}
                      onChange={(e) => setNotaFiscal(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Possui nota fiscal <span className="text-xs text-muted-foreground">(+5%)</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={origem === "importado"}
                      onChange={(e) => setOrigem(e.target.checked ? "importado" : "nacional")}
                      className="h-4 w-4"
                    />
                    Aparelho importado <span className="text-xs text-muted-foreground">(−10%)</span>
                  </label>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="custos" className="flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" /> Custos de reparo (R$)
                  </Label>
                  <Input
                    id="custos"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="0"
                    value={custosExtras || ""}
                    onChange={(e) => setCustosExtras(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Descontado do valor pago ao cliente.
                  </p>
                </div>
                <div>
                  <Label htmlFor="margem" className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Percent className="h-3.5 w-3.5" /> Margem alvo
                    </span>
                    <Badge variant="outline">{margem}%</Badge>
                  </Label>
                  <Input
                    id="margem"
                    type="range"
                    min={10}
                    max={80}
                    step={1}
                    value={margem}
                    onChange={(e) => setMargem(Number(e.target.value))}
                  />
                </div>
              </div>
            </Card>

            {/* Resultado */}
            <Card className="lg:col-span-2 p-6 bg-gradient-to-br from-primary/10 to-card flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  Avaliação
                </h3>
                {calc && (
                  <Badge className={CONDICAO_COR[condicao]} variant="outline">
                    {CONDICAO_LABEL[condicao]}
                  </Badge>
                )}
              </div>

              {!calc ? (
                <div className="flex-1 flex items-center justify-center text-center">
                  <div>
                    <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Informe o preço de mercado para calcular.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 flex-1">
                  <div className="rounded-xl bg-background/60 p-4 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Oferta de compra
                    </p>
                    <p className="text-3xl font-black text-foreground">{brl(calc.compra)}</p>
                    {custosExtras > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + {brl(custosExtras)} de reparo = {brl(calc.custoTotal)} custo total
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-background/60 p-4 border border-border">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Revenda sugerida
                    </p>
                    <p className="text-2xl font-black text-primary">{brl(calc.venda)}</p>
                  </div>

                  <div
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                      calc.lucro > 0
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-rose-500/10 border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {calc.lucro > 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-rose-600" />
                      )}
                      <span className="text-sm font-bold">Lucro: {brl(calc.lucro)}</span>
                    </div>
                    <Badge variant="outline" className="font-mono">
                      {calc.roi.toFixed(1)}% ROI
                    </Badge>
                  </div>

                  {calc.ajustes.length > 0 && (
                    <details className="text-xs">
                      <summary className="font-bold cursor-pointer text-muted-foreground">
                        Detalhamento dos ajustes
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {calc.ajustes.map((a, i) => (
                          <li key={i} className="flex justify-between">
                            <span>{a.label}</span>
                            <span
                              className={
                                a.delta < 0 ? "text-rose-600 font-mono" : "text-emerald-600 font-mono"
                              }
                            >
                              {a.delta > 0 ? "+" : ""}
                              {brl(a.delta)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={copiar}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                    </Button>
                    <Button variant="outline" size="sm" onClick={compartilharWhats}>
                      <Share2 className="h-3.5 w-3.5 mr-1" /> WhatsApp
                    </Button>
                    <Button className="col-span-2" onClick={salvar}>
                      Salvar no histórico
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            {/* Histórico */}
            {historico.length > 0 && (
              <Card className="lg:col-span-5 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <h3 className="font-black">Últimas avaliações</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={limparHistorico}>
                    <Trash2 className="h-4 w-4 mr-1" /> Limpar
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2">Modelo</th>
                        <th className="py-2">Data</th>
                        <th className="py-2 text-right">Compra</th>
                        <th className="py-2 text-right">Revenda</th>
                        <th className="py-2 text-right">Lucro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((h) => (
                        <tr key={h.id} className="border-b last:border-0">
                          <td className="py-2 font-semibold">{h.modelo}</td>
                          <td className="py-2 text-muted-foreground text-xs">
                            {new Date(h.data).toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2 text-right font-mono">{brl(h.compra)}</td>
                          <td className="py-2 text-right font-mono">{brl(h.venda)}</td>
                          <td className="py-2 text-right font-mono font-bold text-emerald-600">
                            {brl(h.lucro)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
