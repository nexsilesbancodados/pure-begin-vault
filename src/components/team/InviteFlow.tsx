import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, UserPlus, Mail, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Invite = {
  id: string;
  email: string | null;
  role: string;
  token: string;
  status: string;
  expires_at: string | null;
  accepted_at: string | null;
  created_at: string;
};

type Member = {
  user_id: string;
  role: string;
  is_default: boolean;
  profile?: { id: string; nome: string | null; email: string | null } | null;
};

const ROLES = ["owner", "admin", "employee", "tecnico"];

export function InviteFlow() {
  const { orgId, userId } = useOrg();
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("employee");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);
    const [iRes, mRes] = await Promise.all([
      (supabase as any)
        .from("organization_invites")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("user_organizations")
        .select("user_id, role, is_default, profile:profiles(id, nome, email)")
        .eq("organization_id", orgId),
    ]);
    setInvites((iRes.data as Invite[]) ?? []);
    setMembers((mRes.data as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  const createInvite = async () => {
    if (!orgId || !userId) return;
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("organization_invites")
      .insert({
        organization_id: orgId,
        invited_by: userId,
        email: email.trim() || null,
        role,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }

    const url = `${window.location.origin}/aceitar-convite/${data.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(data.token);
    setTimeout(() => setCopiedToken(null), 3000);
    toast.success("Convite criado! Link copiado.");
    setEmail("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar este convite?")) return;
    await (supabase as any).from("organization_invites").update({ status: "revoked" }).eq("id", id);
    toast.success("Convite revogado");
    load();
  };

  const removeMember = async (memberId: string) => {
    if (memberId === userId) {
      toast.error("Use o botão 'Sair da loja' em /lojas");
      return;
    }
    if (!confirm("Remover este membro da loja?")) return;
    const { error } = await (supabase as any).rpc("remove_organization_member", {
      _org_id: orgId,
      _user_id: memberId,
    });
    if (error) {
      toast.error("Erro: " + error.message);
      return;
    }
    toast.success("Membro removido");
    load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/aceitar-convite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-black text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Convidar membro
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <Label htmlFor="invite-email">Email (opcional, só para identificação)</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="vendedor@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="invite-role">Papel</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <Button onClick={createInvite} disabled={saving} className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              {saving ? "Gerando..." : "Gerar link"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-black text-sm uppercase tracking-widest">Convites pendentes</h3>
          <Badge variant="outline">{invites.filter((i) => i.status === "pending").length}</Badge>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum convite emitido ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {invites.map((i) => {
              const sb =
                i.status === "accepted"
                  ? { class: "bg-success/15 text-success", icon: CheckCircle2, label: "Aceito" }
                  : i.status === "revoked"
                    ? { class: "bg-muted text-muted-foreground", icon: Trash2, label: "Revogado" }
                    : { class: "bg-warning/15 text-warning", icon: Clock, label: "Pendente" };
              const isPending = i.status === "pending";
              return (
                <div
                  key={i.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={sb.class}>
                        <sb.icon className="h-3 w-3 mr-1" /> {sb.label}
                      </Badge>
                      <span className="text-sm font-bold capitalize">{i.role}</span>
                      {i.email && (
                        <span className="text-xs text-muted-foreground">· {i.email}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Criado: {new Date(i.created_at).toLocaleDateString("pt-BR")}
                      {i.expires_at &&
                        ` · expira: ${new Date(i.expires_at).toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  {isPending && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                        {copiedToken === i.token ? (
                          <>
                            <Check className="h-3 w-3 mr-1" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" /> Link
                          </>
                        )}
                      </Button>
                      <button
                        onClick={() => revoke(i.id)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-black text-sm uppercase tracking-widest mb-3">
          Equipe atual ({members.length})
        </h3>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum membro.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between p-3 rounded-xl border border-border"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">
                    {m.user_id === userId
                      ? "Você"
                      : m.profile?.nome || m.profile?.email || `Membro ${m.user_id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {m.role}
                    {m.is_default && " · padrão"}
                    {m.profile?.email && m.user_id !== userId && ` · ${m.profile.email}`}
                  </p>
                </div>
                {m.user_id !== userId && (
                  <button
                    onClick={() => removeMember(m.user_id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
