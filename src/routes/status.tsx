import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, Activity } from "lucide-react";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [{ title: "Status · ConectaCRM" }, { name: "robots", content: "noindex" }],
  }),
  component: StatusPage,
});

type Check = {
  name: string;
  url: string;
  expected_status?: number;
  status?: "ok" | "warn" | "down";
  latency_ms?: number;
  error?: string;
};

const CHECKS: Check[] = [
  { name: "App principal", url: "/health/status" },
  { name: "Supabase REST", url: "https://irjzfrhvjrvvwnxygufo.supabase.co/rest/v1/" },
  { name: "Evolution API", url: "/api/evolution/instance/fetchInstances" },
];

function StatusPage() {
  const [checks, setChecks] = useState<Check[]>(CHECKS);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const run = async () => {
    const out: Check[] = [];
    for (const c of CHECKS) {
      const t0 = performance.now();
      try {
        const res = await fetch(c.url, { method: "GET", cache: "no-store" });
        const latency = Math.round(performance.now() - t0);
        out.push({
          ...c,
          status: res.ok ? "ok" : res.status === 401 ? "warn" : "down",
          latency_ms: latency,
        });
      } catch (e: any) {
        out.push({
          ...c,
          status: "down",
          error: e.message,
          latency_ms: Math.round(performance.now() - t0),
        });
      }
    }
    setChecks(out);
    setLastRun(new Date());
  };

  useEffect(() => {
    run();
    const t = setInterval(run, 60_000);
    return () => clearInterval(t);
  }, []);

  const overall = checks.every((c) => c.status === "ok")
    ? "ok"
    : checks.some((c) => c.status === "down")
      ? "down"
      : "warn";
  const overallLabel = { ok: "Tudo operacional", warn: "Atenção", down: "Incidente em curso" };
  const overallColors = {
    ok: "bg-success/10 text-success border-success/30",
    warn: "bg-warning/10 text-warning border-warning/30",
    down: "bg-destructive/10 text-destructive border-destructive/30",
  };
  const overallIcons = { ok: CheckCircle2, warn: AlertCircle, down: XCircle };
  const OverallIcon = overallIcons[overall];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-black">
            ConectaCRM
          </p>
          <h1 className="text-3xl font-black mt-1">Status dos serviços</h1>
          {lastRun && (
            <p className="text-xs text-muted-foreground mt-2">
              Última verificação: {lastRun.toLocaleTimeString("pt-BR")}
            </p>
          )}
        </div>

        <div className={`rounded-3xl border-2 p-6 text-center ${overallColors[overall]}`}>
          <OverallIcon className="h-12 w-12 mx-auto mb-2" />
          <h2 className="text-xl font-black">{overallLabel[overall]}</h2>
        </div>

        <div className="space-y-2">
          {checks.map((c) => {
            const colors = {
              ok: "border-success/30 bg-success/5",
              warn: "border-warning/30 bg-warning/5",
              down: "border-destructive/30 bg-destructive/5",
            };
            const cls = c.status ? colors[c.status] : "border-border";
            const Icon =
              c.status === "ok"
                ? CheckCircle2
                : c.status === "warn"
                  ? AlertCircle
                  : c.status === "down"
                    ? XCircle
                    : Activity;
            return (
              <div key={c.name} className={`rounded-2xl border p-4 ${cls}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-5 w-5 shrink-0 ${c.status === "ok" ? "text-success" : c.status === "warn" ? "text-warning" : c.status === "down" ? "text-destructive" : "text-muted-foreground"}`}
                    />
                    <div className="min-w-0">
                      <p className="font-bold">{c.name}</p>
                      {c.error && <p className="text-[10px] text-destructive">{c.error}</p>}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    {c.latency_ms !== undefined && (
                      <p className="font-mono font-black">{c.latency_ms}ms</p>
                    )}
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {c.status === "ok"
                        ? "Operacional"
                        : c.status === "warn"
                          ? "Atenção"
                          : c.status === "down"
                            ? "Indisponível"
                            : "—"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Atualiza automaticamente a cada 60 segundos
        </p>
      </div>
    </div>
  );
}
