import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, UserPlus, Mail, Trash2, Clock, CheckCircle2, UserCog, Users, ShieldCheck, Sparkles, Search, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserRegistrationModal } from "./UserRegistrationModal";

type Invite = {
  id: string;
  email: string | null;
  role: string;
  token: string;
  status: string;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  metadata?: {
    nome?: string;
    perfil_rapido?: string;
    tela_inicial?: string;
    ativo?: boolean;
    lojas?: string[];
    perfis?: string[];
    custom_perfis?: string[];
  } | null;
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
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invite | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

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
    const raw = (iRes.data as Invite[]) ?? [];
    let metaMap: Record<string, Invite["metadata"]> = {};
    try {
      metaMap = JSON.parse(localStorage.getItem(`invite_meta_${orgId}`) || "{}");
    } catch {}
    const acceptedUserIds = raw.map((i) => i.accepted_by).filter(Boolean) as string[];
    let accessMap: Record<string, string[]> = {};
    if (acceptedUserIds.length > 0) {
      const { data: accessRows } = await (supabase as any)
        .from("user_organizations")
        .select("user_id, organization_id")
        .in("user_id", acceptedUserIds);
      accessMap = ((accessRows as { user_id: string; organization_id: string }[]) ?? []).reduce(
        (acc, row) => {
          acc[row.user_id] = [...(acc[row.user_id] ?? []), row.organization_id];
          return acc;
        },
        {} as Record<string, string[]>,
      );
    }
    setInvites(
      raw.map((i) => {
        const metadata = metaMap[i.id] ?? i.metadata ?? null;
        return {
          ...i,
          metadata: {
            ...(metadata ?? {}),
            lojas: metadata?.lojas?.length
              ? metadata.lojas
              : i.accepted_by
                ? (accessMap[i.accepted_by] ?? [])
                : [],
          },
        };
      }),
    );
    setMembers((mRes.data as Member[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [orgId]);

  // Presença em tempo real: quem está online na loja
  useEffect(() => {
    if (!orgId || !userId) return;
    const channel = (supabase as any).channel(`presence-org-${orgId}`, {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOnlineIds(new Set(Object.keys(state)));
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [orgId, userId]);


  const buildInviteUrl = (token: string) =>
    `${window.location.origin}/convite-loja/${token}`;

  const sendInviteEmail = async (toEmail: string, token: string) => {
    const inviterEmail = user?.email || "Sua equipe";
    const inviteUrl = buildInviteUrl(token);
    const html = `
<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.6;color:#333;background:#f7fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;border:1px solid #e5e7eb;">
    <h2 style="color:#1e40af;margin:0 0 12px;">Você foi convidado!</h2>
    <p>Olá! <strong>${inviterEmail}</strong> convidou você para se juntar à equipe no <strong>ConectaCRM</strong>.</p>
    <p>Clique no botão abaixo para aceitar o convite:</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${inviteUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;display:inline-block;">Aceitar convite</a>
    </p>
    <p style="font-size:12px;color:#666;">Ou copie e cole no navegador:<br/><span style="word-break:break-all;">${inviteUrl}</span></p>
    <p style="font-size:12px;color:#999;margin-top:24px;">Este link expira em 7 dias.</p>
  </div>
</body></html>`;
    const { data, error } = await (supabase as any).functions.invoke("send-email", {
      body: {
        to: toEmail,
        subject: `${inviterEmail} convidou você para o ConectaCRM`,
        html,
      },
    });
    if (error || data?.error) {
      throw new Error(data?.error || error?.message || "Falha ao enviar email");
    }
  };

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
    if (error) {
      setSaving(false);
      toast.error("Erro: " + error.message);
      return;
    }

    const url = buildInviteUrl(data.token);
    await navigator.clipboard.writeText(url);
    setCopiedToken(data.token);
    setTimeout(() => setCopiedToken(null), 3000);

    if (email.trim()) {
      try {
        await sendInviteEmail(email.trim(), data.token);
        toast.success("Convite criado e enviado por email!");
      } catch (e: any) {
        toast.warning("Convite criado, link copiado. Email não enviado: " + e.message);
      }
    } else {
      toast.success("Convite criado! Link copiado.");
    }
    setSaving(false);
    setEmail("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar este convite?")) return;
    await (supabase as any).from("organization_invites").update({ status: "revoked" }).eq("id", id);
    toast.success("Convite revogado");
    load();
  };

  const deleteInvite = async (invite: Invite) => {
    if (!confirm(`Excluir definitivamente o usuário ${invite.metadata?.nome || invite.email || ""}?`)) return;
    // Se já foi aceito, remover também o vínculo na organização
    if (invite.accepted_by) {
      const { error: rmErr } = await (supabase as any).rpc("remove_organization_member", {
        _org_id: orgId,
        _user_id: invite.accepted_by,
      });
      if (rmErr) {
        toast.error("Erro ao remover acesso: " + rmErr.message);
        return;
      }
    }
    const { error } = await (supabase as any)
      .from("organization_invites")
      .delete()
      .eq("id", invite.id);
    if (error) {
      // fallback: marcar como revogado se RLS impedir delete
      await (supabase as any).from("organization_invites").update({ status: "revoked" }).eq("id", invite.id);
    }
    // Limpar metadata local
    try {
      const map = JSON.parse(localStorage.getItem(`invite_meta_${orgId}`) || "{}");
      delete map[invite.id];
      localStorage.setItem(`invite_meta_${orgId}`, JSON.stringify(map));
    } catch {}
    toast.success("Usuário excluído");
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
    navigator.clipboard.writeText(buildInviteUrl(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    toast.success("Link copiado");
  };

  const resendEmail = async (invite: Invite) => {
    if (!invite.email) {
      toast.error("Este convite não tem email cadastrado");
      return;
    }
    try {
      await sendInviteEmail(invite.email, invite.token);
      toast.success("Email reenviado para " + invite.email);
    } catch (e: any) {
      toast.error("Falha ao enviar: " + e.message);
    }
  };

  const pendingCount = invites.filter((i) => i.status === "pending").length;
  const acceptedCount = invites.filter((i) => i.status === "accepted").length;
  const totalSeats = members.length + pendingCount;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-3">
              <Sparkles className="h-3 w-3" /> Gestão de equipe
            </div>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">
              Construa um time produtivo
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Cadastre usuários, envie convites e controle permissões de cada membro da loja.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-border bg-card/70 backdrop-blur px-4 py-3 min-w-[110px]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Users className="h-3 w-3" /> Equipe
              </div>
              <p className="text-2xl font-black mt-1">{members.length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 backdrop-blur px-4 py-3 min-w-[110px]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-warning">
                <Clock className="h-3 w-3" /> Pendentes
              </div>
              <p className="text-2xl font-black mt-1">{pendingCount}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card/70 backdrop-blur px-4 py-3 min-w-[110px]">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-success">
                <ShieldCheck className="h-3 w-3" /> Aceitos
              </div>
              <p className="text-2xl font-black mt-1">{acceptedCount}</p>
            </div>
            <Button
              onClick={() => setUserModalOpen(true)}
              size="lg"
              className="gap-2 shadow-lg shadow-primary/20 h-auto px-5"
            >
              <UserCog className="h-4 w-4" />
              Cadastrar Usuário
            </Button>
          </div>
        </div>
      </div>

      <UserRegistrationModal
        open={userModalOpen}
        onOpenChange={(o) => {
          setUserModalOpen(o);
          if (!o) setEditing(null);
        }}
        onCreated={load}
        initial={editing}
      />

      {/* Convite rápido */}
      <Card className="p-5 md:p-6 border-border/60">
        <h3 className="font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Convite rápido por link
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <Label htmlFor="invite-email" className="text-xs">Email (opcional, só para identificação)</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="vendedor@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="md:col-span-3">
            <Label htmlFor="invite-role" className="text-xs">Papel</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-border bg-background text-sm capitalize"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <Button onClick={createInvite} disabled={saving} className="w-full h-11 gap-2">
              <Mail className="h-4 w-4" />
              {saving ? "Gerando..." : "Gerar link"}
            </Button>
          </div>
        </div>
      </Card>
      {invites.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-sm uppercase tracking-widest">
              Usuários cadastrados
            </h3>
            <Badge variant="outline">{invites.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {invites.map((i) => {
              const nome = i.metadata?.nome || i.email || "Sem nome";
              const accepted = i.status === "accepted";
              const revoked = i.status === "revoked";
              const initials = nome
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const statusBadge = accepted
                ? { class: "bg-success/15 text-success border-success/30", label: "Aceito" }
                : revoked
                  ? { class: "bg-muted text-muted-foreground border-border", label: "Revogado" }
                  : { class: "bg-warning/15 text-warning border-warning/30", label: "Aguardando aceite" };
              return (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setEditing(i);
                    setUserModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setEditing(i);
                      setUserModalOpen(true);
                    }
                  }}
                  className="relative rounded-2xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/40 cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-black grid place-items-center shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm truncate">{nome}</p>
                        <Badge className={`${statusBadge.class} border text-[10px] font-bold`}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{i.email}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {i.metadata?.perfil_rapido || i.role}
                        </Badge>
                        {i.metadata?.tela_inicial && (
                          <Badge variant="outline" className="text-[10px]">
                            {i.metadata.tela_inicial}
                          </Badge>
                        )}
                        {i.metadata?.ativo === false && (
                          <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Criado {new Date(i.created_at).toLocaleDateString("pt-BR")}
                        {accepted && i.accepted_at &&
                          ` · aceito ${new Date(i.accepted_at).toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                  </div>
                  {!accepted && !revoked && (
                    <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(i.token);
                        }}
                      >
                        {copiedToken === i.token ? (
                          <><Check className="h-3 w-3 mr-1" /> Copiado</>
                        ) : (
                          <><Copy className="h-3 w-3 mr-1" /> Copiar link</>
                        )}
                      </Button>
                      {i.email && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            resendEmail(i);
                          }}
                          className="gap-1"
                          title={`Enviar email para ${i.email}`}
                        >
                          <Send className="h-3 w-3" /> Enviar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          revoke(i.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="p-5 md:p-6 border-border/60">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Equipe ativa
          </h3>
          <Badge variant="outline" className="font-bold">{members.length}</Badge>
        </div>
        {members.length === 0 ? (
          <div className="py-10 text-center">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center mb-3">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum membro ativo ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Convide alguém pelo link acima para começar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {members.map((m) => {
              const name =
                m.user_id === userId
                  ? "Você"
                  : m.profile?.nome || m.profile?.email || `Membro ${m.user_id.slice(0, 8)}`;
              const initials = name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:shadow-md hover:border-primary/30 transition"
                >
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-black grid place-items-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm truncate">{name}</p>
                      {m.is_default && (
                        <Badge variant="outline" className="text-[9px]">padrão</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize truncate">
                      {m.role}
                      {m.profile?.email && m.user_id !== userId && ` · ${m.profile.email}`}
                    </p>
                  </div>
                  {m.user_id !== userId && (
                    <button
                      onClick={() => removeMember(m.user_id)}
                      className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition"
                      aria-label="Remover membro"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
