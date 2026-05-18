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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

const DEFAULT_PROFILES = [
  "Cadastros Básicos",
  "Estoque",
  "Ferramentas",
  "Financeiro",
  "Fiscal",
  "Informações Gerenciais",
  "Ordem de Serviço",
  "Relatórios",
  "Tela inicial",
  "Venda",
];

const QUICK_PROFILES: Record<string, string[]> = {
  Administrador: DEFAULT_PROFILES,
  Vendedor: ["Tela inicial", "Venda", "Cadastros Básicos"],
  Financeiro: ["Tela inicial", "Financeiro", "Relatórios"],
  Estoquista: ["Tela inicial", "Estoque", "Cadastros Básicos"],
  Técnico: ["Tela inicial", "Ordem de Serviço"],
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

export function UserRegistrationModal({ open, onOpenChange, onCreated }: Props) {
  const { orgId, userId } = useOrg();
  const { user } = useAuth();
  const { orgs } = useUserOrgs();

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
    if (open) {
      // pré-seleciona loja ativa
      setLojas(orgId ? [orgId] : []);
    }
  }, [open, orgId]);

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
    if (!orgId || !userId) return toast.error("Loja não identificada");

    setSaving(true);
    const meta = {
      nome,
      ativo: ativo === "Sim",
      perfis,
      custom_perfis: customPerfis,
      perfil_rapido: quickProfile,
      tela_inicial: telaInicial,
      lojas,
    };
    const { data, error } = await (supabase as any)
      .from("organization_invites")
      .insert({
        organization_id: orgId,
        invited_by: userId,
        email: email.trim(),
        role: quickProfile === "Administrador" ? "admin" : "employee",
        metadata: meta,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }

    const url = `${window.location.origin}/aceitar-convite/${data.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Usuário cadastrado! Link de convite copiado.");
    } catch {
      toast.success("Usuário cadastrado!");
    }
    onCreated?.();
    onOpenChange(false);
    limpar();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/40">
          <DialogTitle className="text-base font-bold">Cadastro de usuários do Sistema</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário de cadastro de usuário
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Plano */}
          <div className="rounded-md bg-primary/10 border border-primary/20 text-primary px-4 py-2.5 text-sm flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Plano <b>Pro Max</b>: {totalUsuariosAtivos} usuários ativos (ilimitado)
          </div>

          {/* Ativo */}
          <Field label="Ativo?">
            <select
              value={ativo}
              onChange={(e) => setAtivo(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option>Sim</option>
              <option>Não</option>
            </select>
          </Field>

          {/* Nome */}
          <Field label="Nome:" required>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>

          {/* Email */}
          <Field label="E-mail:" required helper>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>

          {/* Senha */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nova senha:" helper>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Field label="Confirmar Senha:">
              <div className="relative">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          </div>

          {/* Perfis de Acesso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold flex items-center gap-1.5">
                <HelpCircle className="h-4 w-4 text-muted-foreground" /> Perfis de Acesso
              </h4>
              <select
                value={quickProfile}
                onChange={(e) => applyQuickProfile(e.target.value)}
                className="h-9 px-3 rounded-md border border-input bg-background text-sm min-w-[180px]"
              >
                <option value="">Perfil rápido</option>
                {Object.keys(QUICK_PROFILES).map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Perfis de Acesso padrões</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {DEFAULT_PROFILES.map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={perfis.includes(p)}
                      onChange={() => togglePerfil(p)}
                      className="accent-primary"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">Perfis de Acesso customizados</p>
                <button
                  type="button"
                  onClick={addCustomProfile}
                  className="h-7 w-7 rounded-md border border-input flex items-center justify-center text-success hover:bg-success/10"
                  aria-label="Adicionar perfil customizado"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {customPerfis.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {customPerfis.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={perfis.includes(p)}
                        onChange={() => togglePerfil(p)}
                        className="accent-primary"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tela inicial */}
          <Field label="Tela Inicial:" helper>
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

          {/* Lojas */}
          <div className="space-y-2">
            <h4 className="font-bold flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-muted-foreground" /> Lojas
            </h4>
            <div className="border-t pt-3 flex flex-wrap gap-4">
              {orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma loja disponível.</p>
              ) : (
                orgs.map((o) => (
                  <label key={o.organization_id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={lojas.includes(o.organization_id)}
                      onChange={() => toggleLoja(o.organization_id)}
                      className="accent-primary"
                    />
                    {o.organization?.name ?? o.organization_id.slice(0, 8)}
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex items-center gap-2">
          <Button onClick={salvar} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button type="button" variant="outline" onClick={limpar} className="gap-2">
            <Eraser className="h-4 w-4" />
            Limpar formulário
          </Button>
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
