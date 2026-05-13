import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Instagram, Plus, Settings2, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/instagram")({
  head: () => ({ meta: [{ title: "Instagram · ConectaCRM" }] }),
  component: InstagramPage,
});

type Account = {
  id: string;
  username: string;
  account_id?: string | null;
  connected: boolean;
  pending_messages: number;
  comments_24h: number;
  auto_reply_stories: boolean;
  auto_reply_keywords: boolean;
};

function InstagramPage() {
  const { orgId, userId } = useOrg();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("instagram_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    setAccounts((data ?? []) as Account[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const addAccount = async () => {
    if (!username.trim() || !orgId || !userId) return;
    setSaving(true);
    const { error } = await (supabase as any).from("instagram_accounts").insert({
      organization_id: orgId,
      user_id: userId,
      username: username.trim().replace(/^@/, ""),
      connected: false,
    });
    setSaving(false);
    if (error) return toast.error("Erro: " + error.message);
    toast.success("Conta adicionada. Conecte via Facebook Business pra ativar.");
    setUsername("");
    setOpenAdd(false);
    load();
  };

  const toggle = async (
    id: string,
    field: "auto_reply_stories" | "auto_reply_keywords",
    value: boolean,
  ) => {
    const { error } = await (supabase as any)
      .from("instagram_accounts")
      .update({ [field]: value })
      .eq("id", id);
    if (error) return toast.error("Erro ao salvar");
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta conta?")) return;
    const { error } = await (supabase as any).from("instagram_accounts").delete().eq("id", id);
    if (error) return toast.error("Erro ao remover");
    toast.success("Removida");
    load();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Conexões Instagram" subtitle="Gerencie perfis e Direct Messages" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Perfis ({accounts.length})</h2>
            <Button onClick={() => setOpenAdd(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova conta
            </Button>
          </div>

          {loading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Carregando...</Card>
          ) : accounts.length === 0 ? (
            <Card>
              <EmptyState
                icon={Instagram}
                title="Nenhuma conta Instagram conectada"
                description="Adicione a primeira conta. A conexão via Facebook Business requer aprovação do Meta (1-2 dias)."
                action={{ label: "Adicionar conta", onClick: () => setOpenAdd(true) }}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((a) => (
                <Card key={a.id} className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 grid place-items-center">
                        <Instagram className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-tight">@{a.username}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`h-2 w-2 rounded-full ${a.connected ? "bg-success" : "bg-muted-foreground"}`}
                          />
                          <span className="text-[11px] font-medium text-muted-foreground uppercase">
                            {a.connected ? "Conectado" : "Pendente"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(a.id)}
                      className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Mensagens pendentes:</span>
                      <span className="font-bold">{a.pending_messages}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Comentários (24h):</span>
                      <span className="font-bold">{a.comments_24h}</span>
                    </div>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Auto-reply Stories</Label>
                      <Switch
                        checked={a.auto_reply_stories}
                        onCheckedChange={(v) => toggle(a.id, "auto_reply_stories", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Auto-reply em "PREÇO"</Label>
                      <Switch
                        checked={a.auto_reply_keywords}
                        onCheckedChange={(v) => toggle(a.id, "auto_reply_keywords", v)}
                      />
                    </div>
                  </div>

                  <a
                    href={`https://instagram.com/${a.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" /> Abrir perfil
                  </a>
                </Card>
              ))}
            </div>
          )}

          <Card className="p-5 bg-info/5 border-info/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-info shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">Como ativar o Direct API</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-xs">
                  <li>
                    Sua conta Instagram precisa ser <strong>Business</strong> ou{" "}
                    <strong>Creator</strong>
                  </li>
                  <li>
                    Vincule a uma página Facebook em{" "}
                    <a
                      href="https://business.facebook.com"
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      business.facebook.com
                    </a>
                  </li>
                  <li>No painel Meta, ative permissões de Instagram Messaging</li>
                  <li>Adicione a URL de webhook do ConectaCRM nas configurações Meta</li>
                  <li>Cole o token de acesso aqui (em breve via OAuth direto)</li>
                </ol>
              </div>
            </div>
          </Card>
        </main>
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova conta Instagram</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Username (@)</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@minhaloja"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Salvamos o username pra você gerenciar. A conexão com a Meta requer setup adicional.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAdd(false)}>
              Cancelar
            </Button>
            <Button onClick={addAccount} disabled={!username.trim() || saving}>
              {saving ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
