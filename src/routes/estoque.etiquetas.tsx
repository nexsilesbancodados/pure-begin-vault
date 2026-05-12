import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Search, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

export const Route = createFileRoute("/estoque/etiquetas")({
  component: EtiquetasPage,
});

type Product = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  ean: string | null;
  price: number;
};

// Code-128 subset B encoder (puro JS, sem dependência externa)
const C128B_PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312",
  "132212","221213","221312","231212","112232","122132","122231","113222",
  "123122","123221","223211","221132","221231","213212","223112","312131",
  "311222","321122","321221","312212","322112","322211","212123","212321",
  "232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121",
  "313121","211331","231131","213113","213311","213131","311123","311321",
  "331121","312113","312311","332111","314111","221411","431111","111224",
  "111422","121124","121421","141122","141221","112214","112412","122114",
  "122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112",
  "421211","212141","214121","412121","111143","111341","131141","114113",
  "114311","411113","411311","113141","114131","311141","411131","211412",
  "211214","211232","2331112",
];
const START_B = 104;
const STOP = 106;

function encodeCode128B(text: string): string {
  const values: number[] = [START_B];
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 32 && c <= 127) values.push(c - 32);
  }
  let checksum = START_B;
  for (let i = 1; i < values.length; i++) checksum += values[i] * i;
  values.push(checksum % 103);
  values.push(STOP);
  return values.map((v) => C128B_PATTERNS[v] ?? "").join("");
}

function BarcodeSVG({ value, height = 40 }: { value: string; height?: number }) {
  if (!value) return null;
  const widths = encodeCode128B(value);
  const unit = 1.4;
  const totalUnits = widths.split("").reduce((a, b) => a + Number(b), 0);
  const width = totalUnits * unit;
  let x = 0;
  const bars: any[] = [];
  for (let i = 0; i < widths.length; i++) {
    const w = Number(widths[i]) * unit;
    if (i % 2 === 0) {
      bars.push(<rect key={i} x={x} y={0} width={w} height={height} fill="black" />);
    }
    x += w;
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {bars}
    </svg>
  );
}

function EtiquetasPage() {
  const { orgId } = useOrg();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    supabase
      .from("products")
      .select("id, name, brand, model, sku, ean, price")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name")
      .limit(500)
      .then(({ data }) => {
        setProducts((data as Product[]) ?? []);
        setLoading(false);
      });
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.brand, p.model, p.sku, p.ean]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [products, search]);

  const adjust = (id: string, delta: number) =>
    setCounts((m) => ({ ...m, [id]: Math.max(0, (m[id] ?? 0) + delta) }));
  const setQty = (id: string, v: number) =>
    setCounts((m) => ({ ...m, [id]: Math.max(0, v) }));

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const toPrint: { product: Product; count: number }[] = [];
  for (const p of products) {
    const c = counts[p.id] ?? 0;
    if (c > 0) toPrint.push({ product: p, count: c });
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Etiquetas" subtitle="Imprimir etiquetas com código de barras" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="print:hidden space-y-4">
            <Card className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, SKU ou EAN..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {filtered.length} produtos · <strong className="text-foreground">{total}</strong> etiquetas selecionadas
                </span>
                <Button onClick={() => window.print()} disabled={total === 0}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimir {total > 0 && `(${total})`}
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : (
                <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
                  {filtered.map((p) => {
                    const c = counts[p.id] ?? 0;
                    return (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            SKU {p.sku ?? "—"} · EAN {p.ean ?? "—"} · R$ {p.price.toFixed(2)}
                          </p>
                        </div>
                        <button onClick={() => adjust(p.id, -1)} className="h-7 w-7 rounded-lg bg-muted hover:bg-muted-foreground/10 grid place-items-center">
                          <Minus className="h-3 w-3" />
                        </button>
                        <Input
                          type="number" min={0} value={c}
                          onChange={(e) => setQty(p.id, parseInt(e.target.value) || 0)}
                          className="w-14 h-7 text-center text-xs font-bold"
                        />
                        <button onClick={() => adjust(p.id, 1)} className="h-7 w-7 rounded-lg bg-muted hover:bg-muted-foreground/10 grid place-items-center">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {toPrint.length > 0 && (
            <div className="print-area bg-white text-black p-4 rounded-xl shadow print:shadow-none print:p-0 print:rounded-none">
              <div className="grid grid-cols-3 gap-2 print:gap-1">
                {toPrint.flatMap(({ product, count }) =>
                  Array.from({ length: count }).map((_, i) => (
                    <div
                      key={`${product.id}-${i}`}
                      className="border border-black/30 rounded p-2 flex flex-col items-center text-center"
                      style={{ pageBreakInside: "avoid" }}
                    >
                      <p className="text-[10px] font-bold truncate w-full">{product.name}</p>
                      <p className="text-[9px] text-gray-600">
                        {[product.brand, product.model].filter(Boolean).join(" · ") || ""}
                      </p>
                      <div className="my-1 flex items-center justify-center">
                        <BarcodeSVG value={product.ean || product.sku || product.id.slice(0, 12)} height={32} />
                      </div>
                      <p className="text-[8px] font-mono">{product.ean || product.sku || ""}</p>
                      <p className="text-sm font-black">R$ {product.price.toFixed(2)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>
      <style>{`
        @media print {
          @page { margin: 0.5cm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
