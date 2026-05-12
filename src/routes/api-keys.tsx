import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Key, Copy, Check, Trash2, Plus, BookOpen, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/api-keys")({
  component: ApiKeysPage,
});

type Key = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const ENDPOINTS = [
  { path: "v1/customers", desc: "Lista clientes" },
  { path: "v1/products", desc: "Lista produtos ativos com estoque" },
  { path: "v1/sales", desc: "Lista vendas (últimas 500)" },
  { path: "v1/orders", desc: "Lista ordens de serviço" },
  { path: "v1/stats", desc: "Estatísticas gerais (counts)" },
];

function ApiKeysPage() {
  const { orgId } = useOrg();
  const [keys, setKeys] = useState<Key[]>([]);
  const [newName, setNewName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("api_keys")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setKeys((data as Key[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orgId]);

  const create = async () => {
    if (!newName.trim()) return;
    setGenerating(true);
    const { data, error } = await (supabase as any).rpc("create_api_key", { _name: newName.trim() });
    setGenerating(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    setGenerated((data as any).token);
    setNewName("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar essa chave? Integrações usando ela vão parar de funcionar.")) return;
    await (supabase as any).from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    toast.success("Chave revogada");
    load();
  };

  const copyKey = async () => {
    if (!generated) return;
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast.success("Copiada");
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="API Pública" subtitle="Chaves de integração externa" />
        <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-4">
          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" /> Criar nova chave
            </h3>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label htmlFor="key-name">Nome (pra identificar)</Label>
                <Input
                  id="key-name"
                  placeholder="Ex: Integração ERP, Site, Zapier"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") create(); }}
                />
              </div>
              <Button onClick={create} disabled={!newName.trim() || generating}>
                <Key className="h-4 w-4 mr-2" /> {generating ? "Gerando..." : "Gerar"}
              </Button>
            </div>
          </Card>

          {generated && (
            <Card className="p-5 border-warning/30 bg-warning/5">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm mb-1">⚠ Copie agora! Esta chave NÃO será mostrada novamente.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 px-3 py-2 bg-card border border-border rounded font-mono text-xs break-all">
                      {generated}
                    </code>
                    <Button size="sm" onClick={copyKey}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <button onClick={() => setGenerated(null)} className="text-xs font-bold text-muted-foreground mt-2 hover:underline">
                    Fechar (já copiei)
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3">
              Suas chaves ({keys.filter((k) => !k.revoked_at).length} ativas)
            </h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma chave criada.</p>
            ) : (
              <div className="space-y-2">
                {keys.map((k) => {
                  const revoked = !!k.revoked_at;
                  return (
                    <div key={k.id} className={`flex items-center gap-3 p-3 rounded-xl border ${revoked ? "border-muted bg-muted/20 opacity-60" : "border-border"}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{k.name}</p>
                          {revoked && <Badge variant="outline" className="text-[9px]">Revogada</Badge>}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {k.key_prefix}··· · {k.last_used_at ? `Usada ${new Date(k.last_used_at).toLocaleDateString("pt-BR")}` : "Nunca usada"}
                        </p>
                      </div>
                      {!revoked && (
                        <button onClick={() => revoke(k.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Documentação
            </h3>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Autenticação: header <code className="bg-muted px-1 rounded">X-API-Key: cph_...</code> ou{" "}
                <code className="bg-muted px-1 rounded">Authorization: Bearer cph_...</code>
              </p>

              <div className="rounded-lg bg-muted/30 p-3 font-mono text-xs">
                <p className="text-muted-foreground"># Exemplo</p>
                <p>
                  curl https://conectaphone.com/api/public/v1/customers \<br />
                  &nbsp;&nbsp;-H "X-API-Key: cph_seu_token"
                </p>
              </div>

              <div>
                <p className="font-bold text-xs uppercase tracking-widest mb-2">Endpoints disponíveis</p>
                <div className="space-y-1">
                  {ENDPOINTS.map((e) => (
                    <div key={e.path} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                      <Badge className="bg-success/15 text-success font-mono">GET</Badge>
                      <code className="font-mono text-xs flex-1">/api/public/{e.path}</code>
                      <span className="text-xs text-muted-foreground">{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
