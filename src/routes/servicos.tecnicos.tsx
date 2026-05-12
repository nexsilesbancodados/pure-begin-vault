import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Plus, Trash2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/servicos/tecnicos")({
  component: TecnicosPage,
});

type Tecnico = {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
};

type Stats = {
  abertas: number;
  concluidas: number;
  receita: number;
};

function TecnicosPage() {
  const { orgId } = useOrg();
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data: emp } = await supabase
      .from("employees")
      .select("id, name, email, position")
      .eq("organization_id", orgId)
      .order("name");
    const list = (emp ?? []).filter((e: any) =>
      !e.position || /tecnic|tecnico|bancad/i.test(e.position)
    );
    setTecnicos(list as Tecnico[]);

    // métricas por técnico
    const { data: os } = await supabase
      .from("service_orders")
      .select("technician_id, status, total_cost")
      .eq("organization_id", orgId);

    const map: Record<string, Stats> = {};
    for (const t of list) map[t.id] = { abertas: 0, concluidas: 0, receita: 0 };
    for (const o of (os ?? []) as any[]) {
      const tid = o.technician_id;
      if (!tid || !map[tid]) continue;
      if (o.status === "concluida" || o.status === "entregue") {
        map[tid].concluidas += 1;
        map[tid].receita += Number(o.total_cost ?? 0);
      } else if (o.status !== "cancelada") {
        map[tid].abertas += 1;
      }
    }
    setStats(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const criar = async () => {
    if (!orgId || !novoNome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("employees").insert({
      organization_id: orgId,
      name: novoNome.trim(),
      email: novoEmail.trim() || null,
      position: "Técnico",
    } as any);
    setSaving(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    setNovoNome(""); setNovoEmail("");
    toast.success("Técnico adicionado");
    load();
  };

  const remover = async (id: string) => {
    if (!confirm("Remover este técnico? OS atribuídas a ele perderão o vínculo.")) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Técnico removido");
    load();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Técnicos" subtitle="Equipe da assistência" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Adicionar técnico
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: João Silva"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                />
              </div>
              <div className="sm:col-span-5">
                <Label htmlFor="email">Email (opcional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  className="w-full"
                  onClick={criar}
                  disabled={!novoNome.trim() || saving}
                >
                  {saving ? "Salvando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Equipe ({tecnicos.length})
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : tecnicos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum técnico cadastrado. Use o formulário acima.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {tecnicos.map((t) => {
                  const s = stats[t.id] ?? { abertas: 0, concluidas: 0, receita: 0 };
                  return (
                    <div key={t.id} className="border border-border rounded-xl p-4 bg-card">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-black truncate">{t.name}</h4>
                          {t.email && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3" /> {t.email}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => remover(t.id)}
                          className="text-muted-foreground hover:text-destructive transition"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Metric label="Abertas" value={s.abertas} variant="warning" />
                        <Metric label="Concluídas" value={s.concluidas} variant="success" />
                        <Metric label="Receita" value={`R$ ${s.receita.toFixed(0)}`} variant="primary" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  variant,
}: {
  label: string;
  value: number | string;
  variant: "warning" | "success" | "primary";
}) {
  const colors = {
    warning: "bg-warning/10 text-warning border-warning/30",
    success: "bg-success/10 text-success border-success/30",
    primary: "bg-primary/10 text-primary border-primary/30",
  };
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${colors[variant]}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-sm font-black">{value}</div>
    </div>
  );
}
