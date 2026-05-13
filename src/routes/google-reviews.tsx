import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Star, ExternalLink, MessageSquare, MousePointerClick, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/google-reviews")({
  head: () => ({ meta: [{ title: "Avaliações Google · ConectaCRM" }] }),
  component: GoogleReviewsPage,
});

function GoogleReviewsPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [config, setConfig] = useState<any>({
    place_id: "",
    short_url: "",
    message_template:
      "Oi {nome}! Tudo certo com seu pedido? 🙏 Se gostou do atendimento, daria pra deixar uma estrelinha pra gente? Leva 30 seg: {link}",
    send_after_hours: 24,
    enabled: false,
  });
  const [requests, setRequests] = useState<any[]>([]);
  const [stats, setStats] = useState({ sent: 0, clicked: 0, reviewed: 0 });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!p?.organization_id) return;
      setOrgId(p.organization_id);

      const { data: c } = await supabase
        .from("google_reviews_config")
        .select("*")
        .eq("organization_id", p.organization_id)
        .maybeSingle();
      if (c) setConfig(c);

      const { data: r } = await supabase
        .from("google_review_requests")
        .select("*")
        .eq("organization_id", p.organization_id)
        .order("sent_at", { ascending: false })
        .limit(50);
      const rows = r ?? [];
      setRequests(rows);
      setStats({
        sent: rows.length,
        clicked: rows.filter((x) => x.clicked_at).length,
        reviewed: rows.filter((x) => x.reviewed).length,
      });
    })();
  }, []);

  const save = async () => {
    if (!orgId) return;
    const { error } = await supabase.from("google_reviews_config").upsert({
      organization_id: orgId,
      ...config,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error("Erro: " + error.message);
    else toast.success("Configuração salva");
  };

  const buildShortUrl = () => {
    if (!config.place_id) {
      toast.error("Preencha o Place ID primeiro");
      return;
    }
    setConfig({
      ...config,
      short_url: `https://search.google.com/local/writereview?placeid=${config.place_id}`,
    });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Avaliações Google"
          subtitle="Peça reviews automáticos pós-venda e suba seu ranking"
        />
        <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    Enviados
                  </p>
                  <p className="text-2xl font-black">{stats.sent}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <MousePointerClick className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    Clicaram
                  </p>
                  <p className="text-2xl font-black">{stats.clicked}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <Star className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                    Avaliaram
                  </p>
                  <p className="text-2xl font-black">{stats.reviewed}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base">Configuração</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="enabled" className="text-sm">
                  Automação ativa
                </Label>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Google Place ID</Label>
                <Input
                  value={config.place_id ?? ""}
                  onChange={(e) => setConfig({ ...config, place_id: e.target.value })}
                  placeholder="ChIJ..."
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Pegue em{" "}
                  <a
                    href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                    target="_blank"
                    className="text-primary hover:underline"
                  >
                    Place ID Finder
                  </a>{" "}
                  ou no seu perfil de empresa do Google.
                </p>
              </div>

              <div>
                <Label>Link da avaliação</Label>
                <div className="flex gap-2">
                  <Input
                    value={config.short_url ?? ""}
                    onChange={(e) => setConfig({ ...config, short_url: e.target.value })}
                    placeholder="https://g.page/r/..."
                  />
                  <Button variant="outline" onClick={buildShortUrl}>
                    Gerar
                  </Button>
                </div>
                {config.short_url && (
                  <a
                    href={config.short_url}
                    target="_blank"
                    className="text-[11px] text-primary mt-1 flex items-center gap-1"
                  >
                    Testar link <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div>
                <Label>Mensagem (WhatsApp)</Label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card font-sans text-sm resize-none"
                  value={config.message_template ?? ""}
                  onChange={(e) => setConfig({ ...config, message_template: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Variáveis: <code>{"{nome}"}</code>, <code>{"{link}"}</code>,{" "}
                  <code>{"{loja}"}</code>
                </p>
              </div>

              <div>
                <Label>Enviar depois de</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    className="w-24"
                    value={config.send_after_hours ?? 24}
                    onChange={(e) =>
                      setConfig({ ...config, send_after_hours: Number(e.target.value) })
                    }
                  />
                  <span className="text-sm text-muted-foreground">
                    horas após a venda/OS concluída
                  </span>
                </div>
              </div>

              <Button onClick={save} className="w-full">
                Salvar configuração
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-black text-base">Histórico</h3>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum pedido de avaliação enviado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 text-sm"
                  >
                    <div>
                      <p className="font-bold">{r.customer_name ?? "Cliente"}</p>
                      <p className="text-[11px] text-muted-foreground">{r.customer_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.sent_at).toLocaleString("pt-BR")}
                      </p>
                      <div className="flex gap-1 mt-0.5 justify-end">
                        {r.clicked_at && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-bold">
                            CLICOU
                          </span>
                        )}
                        {r.reviewed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success font-bold">
                            AVALIOU
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
