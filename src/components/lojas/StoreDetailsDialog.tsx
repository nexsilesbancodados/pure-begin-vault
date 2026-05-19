import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Upload,
  Save,
  Users,
  Crown,
  Shield,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  FileText,
  Copy,
  MessageCircle,
  UserPlus,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { saveOrgSettings } from "@/lib/org-settings.functions";
import { useServerFn } from "@tanstack/react-start";

type Member = { user_id: string; role: string; email?: string | null; name?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  role: string;
  onSaved?: () => void;
}

const lsKey = (orgId: string) => `store-details:${orgId}`;

export function StoreDetailsDialog({ open, onOpenChange, orgId, orgName, role, onSaved }: Props) {
  const { profile } = useAuth();
  const isSuperAdmin = (profile as any)?.role === "super_admin";
  const canEdit = isSuperAdmin || role === "owner" || role === "admin";
  const saveFn = useServerFn(saveOrgSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(orgName);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(orgName);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId]);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: settings }, { data: mems }] = await Promise.all([
        (supabase as any)
          .from("organization_settings")
          .select("brand_name, brand_logo_url, support_email, support_whatsapp")
          .eq("organization_id", orgId)
          .maybeSingle(),
        (supabase as any)
          .from("user_organizations")
          .select("user_id, role")
          .eq("organization_id", orgId),
      ]);

      if (settings) {
        setName(settings.brand_name || orgName);
        setLogoUrl(settings.brand_logo_url || "");
        setEmail(settings.support_email || "");
        setPhone(settings.support_whatsapp || "");
      }

      // local extras (CNPJ / address) until DB columns exist
      try {
        const extra = JSON.parse(localStorage.getItem(lsKey(orgId)) || "{}");
        setCnpj(extra.cnpj || "");
        setAddress(extra.address || "");
      } catch {
        // ignore
      }

      // Enriquece membros com nome/email do profile
      const baseMembers = (mems || []) as Member[];
      const ids = baseMembers.map((m) => m.user_id);
      if (ids.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        const map = new Map<string, { name?: string; email?: string }>();
        for (const p of (profs as any[]) || []) {
          map.set(p.id, { name: p.full_name, email: p.email });
        }
        setMembers(
          baseMembers.map((m) => ({
            ...m,
            name: map.get(m.user_id)?.name ?? null,
            email: map.get(m.user_id)?.email ?? null,
          })),
        );
      } else {
        setMembers(baseMembers);
      }
    } finally {
      setLoading(false);
    }
  };

  const [uploading, setUploading] = useState(false);

  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    setUploading(true);
    const tId = toast.loading("Enviando imagem...");
    try {
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `org-${orgId}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (error) throw error;
      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Logo carregada — clique em Salvar alterações", { id: tId });
    } catch (e: any) {
      toast.error("Erro no upload: " + (e?.message ?? e), { id: tId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    const tId = toast.loading("Salvando...");
    try {
      await saveFn({
        data: {
          orgId,
          name: name.trim() || orgName,
          brand_logo_url: logoUrl || null,
          support_email: email || null,
          support_whatsapp: phone || null,
        },
      });

      // Persist extras locally (CNPJ / endereço enquanto não há colunas no DB)
      localStorage.setItem(lsKey(orgId), JSON.stringify({ cnpj, address }));

      toast.success("Informações salvas", { id: tId });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[StoreDetailsDialog] save error", e);
      toast.error("Erro ao salvar: " + (e?.message ?? "tente novamente"), { id: tId });
    } finally {
      setSaving(false);
    }
  };

  const roleIcon = (r: string) =>
    r === "owner" ? (
      <Crown className="h-3.5 w-3.5 text-warning" />
    ) : r === "admin" ? (
      <Shield className="h-3.5 w-3.5 text-primary" />
    ) : (
      <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-6">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:20px_20px]" />
          <div className="relative flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-white/15 backdrop-blur grid place-items-center overflow-hidden shrink-0 border border-white/20">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </div>
            <div className="min-w-0">
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="text-2xl font-black text-primary-foreground">
                  {name || "Loja"}
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/80 text-xs flex items-center gap-2">
                  <Badge className="bg-white/15 border border-white/20 text-primary-foreground text-[10px]">
                    {roleIcon(role)} <span className="ml-1 capitalize">{role}</span>
                  </Badge>
                  <span>·</span>
                  <span>{members.length} usuário(s)</span>
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Logo */}
          <section>
            <h4 className="text-xs uppercase tracking-widest font-black text-muted-foreground mb-3">
              Logo
            </h4>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-xl bg-muted grid place-items-center overflow-hidden border">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={!canEdit || uploading}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" /> {uploading ? "Enviando..." : "Enviar imagem"}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl("")}
                      disabled={!canEdit}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <Input
                  placeholder="Ou cole a URL do logo"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={!canEdit}
                  className="h-9 text-xs"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadLogo(f);
                  }}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Informações */}
          <section>
            <h4 className="text-xs uppercase tracking-widest font-black text-muted-foreground mb-3">
              Informações da loja
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Nome da loja
                </Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" /> CNPJ
                </Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" /> WhatsApp / Telefone
                </Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3" /> E-mail
                </Label>
                <Input
                  type="email"
                  placeholder="contato@loja.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Endereço
                </Label>
                <Textarea
                  placeholder="Rua, número, bairro, cidade - UF, CEP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  disabled={!canEdit}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Usuários ativos */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-3">
              <h4 className="text-xs uppercase tracking-widest font-black text-muted-foreground flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Usuários ativos
                <Badge variant="outline" className="ml-1">{members.length}</Badge>
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="h-8 pl-7 text-xs w-44"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => {
                    onOpenChange(false);
                    window.location.assign("/equipe-loja");
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Gerenciar
                </Button>
              </div>
            </div>

            {/* Resumo por papel */}
            {!loading && members.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(["owner", "admin", "member"] as const).map((r) => {
                  const count = members.filter((m) =>
                    r === "member" ? !["owner", "admin"].includes(m.role) : m.role === r,
                  ).length;
                  return (
                    <div
                      key={r}
                      className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2"
                    >
                      <div className="h-7 w-7 rounded-md bg-background grid place-items-center">
                        {roleIcon(r)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                          {r === "member" ? "Membros" : r === "owner" ? "Owners" : "Admins"}
                        </p>
                        <p className="text-sm font-black leading-none">{count}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                {members.length === 0
                  ? "Nenhum usuário vinculado a esta loja."
                  : "Nenhum usuário corresponde à busca."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((m) => {
                  const display = m.name || m.email || `Usuário ${m.user_id.slice(0, 6)}`;
                  const initials = display
                    .split(/\s+/)
                    .map((p) => p[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const roleClass =
                    m.role === "owner"
                      ? "bg-warning/15 text-warning border-warning/30"
                      : m.role === "admin"
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-muted text-muted-foreground border-border";
                  return (
                    <div
                      key={m.user_id}
                      className="group flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/30 transition-all"
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 grid place-items-center text-primary font-black text-sm shrink-0 border border-primary/20">
                        {initials || <UserIcon className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold truncate">{display}</p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 ${roleClass} flex items-center gap-1`}
                          >
                            {roleIcon(m.role)}
                            <span className="capitalize">{m.role}</span>
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.email || `ID: ${m.user_id.slice(0, 8)}…`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.email && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Copiar e-mail"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(m.email!);
                                toast.success("E-mail copiado");
                              } catch {
                                toast.error("Não foi possível copiar");
                              }
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {m.email && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Enviar e-mail"
                            asChild
                          >
                            <a href={`mailto:${m.email}`}>
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        {phone && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            title="Abrir WhatsApp da loja"
                            asChild
                          >
                            <a
                              href={`https://wa.me/${phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canEdit || saving} className="shadow-md">
            <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
