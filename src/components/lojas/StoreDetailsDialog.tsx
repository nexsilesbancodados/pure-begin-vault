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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const canEdit = role === "owner" || role === "admin";
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

      setMembers(mems || []);
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
    try {
      // Upsert settings
      const { error } = await (supabase as any)
        .from("organization_settings")
        .upsert(
          {
            organization_id: orgId,
            brand_name: name,
            brand_logo_url: logoUrl || null,
            support_email: email || null,
            support_whatsapp: phone || null,
          },
          { onConflict: "organization_id" },
        );
      if (error) throw error;

      // Persist extras locally
      localStorage.setItem(lsKey(orgId), JSON.stringify({ cnpj, address }));

      toast.success("Informações salvas");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? e));
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
                    disabled={!canEdit}
                  >
                    <Upload className="h-3.5 w-3.5 mr-1" /> Enviar imagem
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs uppercase tracking-widest font-black text-muted-foreground flex items-center gap-2">
                <Users className="h-3.5 w-3.5" /> Usuários ativos
              </h4>
              <Badge variant="outline">{members.length}</Badge>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[0, 1].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                Nenhum usuário vinculado.
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition"
                  >
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 grid place-items-center text-primary">
                      {roleIcon(m.role)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">
                        {m.name || m.email || m.user_id.slice(0, 8)}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">{m.role}</p>
                    </div>
                  </div>
                ))}
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
