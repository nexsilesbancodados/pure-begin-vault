import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, HelpCircle, Plus, Save, Eraser, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { useUserOrgs } from "@/lib/useUserOrgs";
import { toast } from "sonner";

interface EditInitial {
  id: string;
  email?: string | null;
  metadata?: {
    nome?: string;
    ativo?: boolean;
    perfis?: string[];
    custom_perfis?: string[];
    perfil_rapido?: string;
    tela_inicial?: string;
    lojas?: string[];
  } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  initial?: EditInitial | null;
}

const DEFAULT_PROFILES = [
  "Dashboard",
  "Calendário",
  "Relatórios",
  "CRM",
  "Vendas & PDV",
  "Serviços & OS",
  "Clientes",
  "Estoque",
  "Financeiro",
  "Notas em Aberto",
  "Notas Fiscais",
  "Importações",
  "Loja",
  "Equipe da Loja",
  "Agentes / Atendentes",
  "Hardware",
  "Sistema / Parametrização",
  "Integrações",
  "API Pública",
  "Auditoria",
  "Minha Conta",
  "Programa de Afiliados",
  "Central de Ajuda",
];

const QUICK_PROFILES: Record<string, string[]> = {
  "Gerente Comercial": [
    "Dashboard",
    "Relatórios",
    "CRM",
    "Vendas & PDV",
    "Clientes",
    "Estoque",
  ],
  "Administrativo-Financeiro": [
    "Dashboard",
    "Financeiro",
    "Notas em Aberto",
    "Notas Fiscais",
    "Relatórios",
    "Clientes",
  ],
  Vendedor: ["Dashboard", "Vendas & PDV", "Clientes"],
  Técnico: ["Dashboard", "Serviços & OS"],
};

const HOME_SCREENS = [
  "Painel Inicial",
  "Vendas",
  "PDV",
  "Estoque",
  "Ordens de Serviço",
  "Financeiro",
  "CRM",
];

export function UserRegistrationModal({ open, onOpenChange, onCreated, initial }: Props) {
  const { orgId, userId } = useOrg();
  const { user } = useAuth();
  const { orgs } = useUserOrgs();
  const isEdit = !!initial?.id;

  const [ativo, setAtivo] = useState("Sim");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [perfis, setPerfis] = useState<string[]>([]);
  const [customPerfis, setCustomPerfis] = useState<string[]>([]);
  const [quickProfile, setQuickProfile] = useState("");
  const [telaInicial, setTelaInicial] = useState("");
  const [lojas, setLojas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const m = initial.metadata || {};
      setAtivo(m.ativo === false ? "Não" : "Sim");
      setNome(m.nome || "");
      setEmail(initial.email || "");
      setSenha("");
      setConfirmar("");
      setPerfis(m.perfis || []);
      setCustomPerfis(m.custom_perfis || []);
      setQuickProfile(m.perfil_rapido || "");
      setTelaInicial(m.tela_inicial || "");
      setLojas(m.lojas?.length ? m.lojas : orgId ? [orgId] : []);
    } else {
      setLojas(orgId ? [orgId] : []);
    }
  }, [open, orgId, initial]);

  const togglePerfil = (p: string) => {
    setPerfis((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const toggleLoja = (id: string) => {
    setLojas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const applyQuickProfile = (key: string) => {
    setQuickProfile(key);
    const list = QUICK_PROFILES[key];
    if (list) setPerfis(list);
  };

  const roleFromProfile = () => {
    const selected = `${quickProfile} ${perfis.join(" ")}`.toLowerCase();
    if (selected.includes("gerente")) return "admin";
    if (selected.includes("administrativo") || selected.includes("financeiro")) return "financeiro";
    if (selected.includes("técnico") || selected.includes("tecnico") || selected.includes("ordem de serviço")) return "employee";
    if (selected.includes("vendedor") || selected.includes("venda")) return "vendedor";
    return "employee";
  };

  const addCustomProfile = () => {
    const name = prompt("Nome do novo perfil customizado:");
    if (!name) return;
    setCustomPerfis((p) => [...p, name]);
    setPerfis((p) => [...p, name]);
  };

  const limpar = () => {
    setAtivo("Sim");
    setNome("");
    setEmail("");
    setSenha("");
    setConfirmar("");
    setPerfis([]);
    setCustomPerfis([]);
    setQuickProfile("");
    setTelaInicial("");
    setLojas(orgId ? [orgId] : []);
  };

  const totalUsuariosAtivos = useMemo(() => orgs.length, [orgs]);

  const salvar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome");
    if (!email.trim()) return toast.error("Informe o email");
    if (senha && senha !== confirmar) return toast.error("As senhas não conferem");
    if (senha && senha.length < 6) return toast.error("A senha precisa ter no mínimo 6 caracteres");
    if (!orgId || !userId) return toast.error("Loja não identificada");
    if (lojas.length === 0) return toast.error("Selecione pelo menos uma loja para o usuário");

    setSaving(true);
    try {
      let inviteId = initial?.id;
      const assignedRole = roleFromProfile();

      if (isEdit && inviteId) {
        // Atualiza email/role no convite existente
        const { error } = await supabase
          .from("organization_invites")
          .update({
            email: email.trim(),
            role: assignedRole,
          })
          .eq("id", inviteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("organization_invites")
          .insert({
            organization_id: orgId,
            invited_by: userId,
            email: email.trim(),
            role: assignedRole,
          })
          .select()
          .single();
        if (error) throw error;
        inviteId = data.id;
      }

      // Persist extended metadata locally (no DB column required)
      try {
        const key = `invite_meta_${orgId}`;
        const existing = JSON.parse(localStorage.getItem(key) || "{}");
        existing[inviteId!] = {
          nome,
          ativo: ativo === "Sim",
          perfis,
          custom_perfis: customPerfis,
          perfil_rapido: quickProfile,
          tela_inicial: telaInicial,
          lojas,
        };
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {
        // Dados locais são apenas apoio visual; falha aqui não deve bloquear o cadastro real.
      }

      // Cria/atualiza a conta real e sincroniza as lojas selecionadas.
      if (isEdit || senha) {
        const { data: teamUserData, error: teamUserError } = await supabase.functions.invoke(
          "create-team-user",
          {
            body: {
              email: email.trim(),
              password: senha,
              nome: nome.trim(),
              organization_id: lojas[0],
              organization_ids: lojas,
              role: assignedRole,
              invite_id: inviteId,
            },
          },
        );
        if (teamUserError || teamUserData?.error) {
          throw new Error(teamUserData?.error || teamUserError?.message || "Falha ao salvar acesso");
        }
        toast.success("Usuário atualizado! As lojas selecionadas já aparecem no login dele.");
      } else {
        const { data: inv } = await supabase
          .from("organization_invites")
          .select("token")
          .eq("id", inviteId)
          .single();
        const url = `${window.location.origin}/convite-loja/${inv?.token}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Convite criado! Link copiado (defina uma senha para login direto).");
        } catch {
          toast.success("Convite criado!");
        }
      }

      onCreated?.();
      onOpenChange(false);
      limpar();
    } catch (e: unknown) {
      toast.error("Erro ao salvar: " + (e instanceof Error ? e.message : "desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const initials = (nome || email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const perfisCount = perfis.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-hidden p-0 gap-0 flex flex-col">
        {/* Hero header */}
        <DialogHeader className="relative px-6 pt-6 pb-5 border-b bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" aria-hidden />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground font-black grid place-items-center text-lg shadow-lg shadow-primary/25 shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg font-black tracking-tight">
                {isEdit ? "Editar usuário" : "Cadastrar novo usuário"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Defina dados de acesso, permissões e lojas vinculadas.
              </DialogDescription>
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              <Crown className="h-3.5 w-3.5" />
              Pro Max · {totalUsuariosAtivos} ativos
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-muted/20">
          {/* Conta */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <header className="flex items-center justify-between">
              <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground">
                Dados da conta
              </h4>
              <label className="flex items-center gap-2 text-xs font-medium">
                <span className="text-muted-foreground">Ativo</span>
                <button
                  type="button"
                  onClick={() => setAtivo(ativo === "Sim" ? "Não" : "Sim")}
                  className={`relative h-6 w-11 rounded-full transition ${
                    ativo === "Sim" ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                  aria-pressed={ativo === "Sim"}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      ativo === "Sim" ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome completo" required>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Ana Souza" />
              </Field>
              <Field label="E-mail de acesso" required>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label={isEdit ? "Nova senha (opcional)" : "Senha"} helper>
                <div className="relative">
                  <Input
                    type={showPwd ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    className="pr-10"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <Field label="Confirmar senha">
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    className="pr-10"
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
            </div>

            <Field label="Tela inicial após login" helper>
              <select
                value={telaInicial}
                onChange={(e) => setTelaInicial(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">Selecionar</option>
                {HOME_SCREENS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          {/* Perfis */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <header className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground">
                  Perfis de acesso
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {perfisCount === 0 ? "Nenhum perfil selecionado" : `${perfisCount} perfil${perfisCount > 1 ? "s" : ""} selecionado${perfisCount > 1 ? "s" : ""}`}
                </p>
              </div>
            </header>

            {/* Quick profile chips */}
            <div className="flex flex-wrap gap-2">
              {Object.keys(QUICK_PROFILES).map((q) => {
                const active = quickProfile === q;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => applyQuickProfile(q)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                        : "bg-background border-border hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {q}
                  </button>
                );
              })}
              {quickProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setQuickProfile("");
                    setPerfis([]);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-destructive"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="border-t pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Perfis padrões
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {DEFAULT_PROFILES.map((p) => {
                  const checked = perfis.includes(p);
                  return (
                    <label
                      key={p}
                      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer transition ${
                        checked
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePerfil(p)}
                        className="accent-primary"
                      />
                      <span className="truncate">{p}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Perfis customizados
                </p>
                <button
                  type="button"
                  onClick={addCustomProfile}
                  className="h-7 px-2.5 rounded-md border border-input flex items-center gap-1 text-xs font-medium text-success hover:bg-success/10"
                >
                  <Plus className="h-3.5 w-3.5" /> Novo
                </button>
              </div>
              {customPerfis.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhum perfil customizado. Clique em "Novo" para criar.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {customPerfis.map((p) => {
                    const checked = perfis.includes(p);
                    return (
                      <label
                        key={p}
                        className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer transition ${
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerfil(p)}
                          className="accent-primary"
                        />
                        <span className="truncate">{p}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Lojas */}
          <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <header className="flex items-center justify-between">
              <div>
                <h4 className="font-black text-xs uppercase tracking-widest text-muted-foreground">
                  Lojas vinculadas
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {lojas.length} de {orgs.length} loja{orgs.length === 1 ? "" : "s"} selecionada{lojas.length === 1 ? "" : "s"}
                </p>
              </div>
              {orgs.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLojas(
                      lojas.length === orgs.length ? [] : orgs.map((o) => o.organization_id),
                    )
                  }
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {lojas.length === orgs.length ? "Limpar tudo" : "Selecionar todas"}
                </button>
              )}
            </header>
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma loja disponível.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {orgs.map((o) => {
                  const checked = lojas.includes(o.organization_id);
                  return (
                    <label
                      key={o.organization_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLoja(o.organization_id)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium truncate">
                        {o.organization?.name ?? o.organization_id.slice(0, 8)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t bg-card flex items-center justify-between gap-2 shadow-[0_-4px_12px_-8px_rgba(0,0,0,0.1)]">
          <Button type="button" variant="ghost" onClick={limpar} className="gap-2 text-muted-foreground">
            <Eraser className="h-4 w-4" />
            Limpar
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={saving} className="gap-2 min-w-[140px] shadow-md shadow-primary/20">
              <Save className="h-4 w-4" />
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar usuário"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
  required,
  helper,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  helper?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1 text-sm">
        {required && <span className="text-destructive">*</span>}
        {helper && <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
      </Label>
      {children}
    </div>
  );
}
