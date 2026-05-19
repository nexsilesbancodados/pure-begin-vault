import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Search, Plus, Loader2, Check, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

type Supplier = {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
};

interface Props {
  value: string;
  onChange: (name: string, supplier?: Supplier) => void;
  placeholder?: string;
}

export function SupplierPicker({ value, onChange, placeholder = "Buscar fornecedor..." }: Props) {
  const { orgId } = useOrg();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newCnpj, setNewCnpj] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, cnpj, phone, email")
      .eq("organization_id", orgId)
      .eq("active", true)
      .order("name");
    if (!error) setItems((data as Supplier[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) =>
      [s.name, s.cnpj, s.email, s.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [items, search]);

  async function handleCreate() {
    if (!orgId) return;
    if (!newName.trim()) {
      toast.error("Informe o nome do fornecedor");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setSaving(false);
      toast.error("Sessão expirada");
      return;
    }
    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        organization_id: orgId,
        user_id: userId,
        name: newName.trim(),
        cnpj: newCnpj.trim() || null,
        phone: newPhone.trim() || null,
        email: newEmail.trim() || null,
        active: true,
      })
      .select("id, name, cnpj, phone, email")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao cadastrar fornecedor", { description: error.message });
      return;
    }
    toast.success("Fornecedor cadastrado");
    const s = data as Supplier;
    setItems((prev) => [s, ...prev]);
    onChange(s.name, s);
    setCreateOpen(false);
    setOpen(false);
    setNewName("");
    setNewCnpj("");
    setNewPhone("");
    setNewEmail("");
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className={value ? "" : "text-muted-foreground"}>
              {value || "Buscar fornecedor"}
            </span>
            <Search className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
                </p>
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChange(s.name, s);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between gap-2 border-b last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[s.cnpj, s.phone, s.email].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  {value === s.name && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
          <div className="p-2 border-t bg-muted/30">
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                setNewName(search);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Cadastrar novo fornecedor
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome / Razão social *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input value={newCnpj} onChange={(e) => setNewCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
