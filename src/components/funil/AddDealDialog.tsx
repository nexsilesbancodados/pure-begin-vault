import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, UserPlus, CreditCard, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStageId: string;
  leads: { id: string; name: string; phone?: string | null }[];
  onSuccess: () => void;
}

export function AddDealDialog({ open, onOpenChange, initialStageId, leads, onSuccess }: AddDealDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"select" | "create">("select");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [value, setValue] = useState("");

  const handleAdd = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      let leadId = selectedLeadId;

      if (mode === "create") {
        if (!newName || !newPhone) {
          toast.error("Nome e telefone são obrigatórios para novo lead");
          setLoading(false);
          return;
        }

        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            user_id: user.id,
            name: newName,
            phone: newPhone,
            source: "manual"
          })
          .select()
          .single();

        if (leadError) throw leadError;
        leadId = newLead.id;
      }

      if (!leadId) {
        toast.error("Selecione ou crie um lead");
        setLoading(false);
        return;
      }

      const { error: dealError } = await supabase
        .from("pipeline_leads")
        .insert({
          user_id: user.id,
          lead_id: leadId,
          stage_id: initialStageId,
          deal_value: Number(value || 0)
        });

      if (dealError) throw dealError;

      toast.success("Negociação criada com sucesso!");
      onSuccess();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error("Erro ao criar negociação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMode("select");
    setSelectedLeadId("");
    setNewName("");
    setNewPhone("");
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if(!o) reset(); }}>
      <DialogContent className="sm:max-w-[425px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black italic uppercase tracking-tight">
            <Plus className="h-5 w-5 text-primary" />
            Novo Negócio
          </DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Adicione uma oportunidade ao seu funil
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente / Lead</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-[10px] font-black uppercase tracking-wider text-primary"
                onClick={() => setMode(mode === "select" ? "create" : "select")}
              >
                {mode === "select" ? (
                  <><UserPlus className="h-3 w-3 mr-1" /> Criar Novo</>
                ) : (
                  <><User className="h-3 w-3 mr-1" /> Selecionar Existente</>
                )}
              </Button>
            </div>

            {mode === "select" ? (
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none focus:ring-1 focus:ring-primary/20">
                  <SelectValue placeholder="Selecione um lead existente" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {leads.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nenhum lead encontrado</p>
                    </div>
                  ) : (
                    leads.map((l) => (
                      <SelectItem key={l.id} value={l.id} className="rounded-lg">
                        <span className="font-bold">{l.name}</span>
                        {l.phone && <span className="ml-2 text-[10px] opacity-50">{l.phone}</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-3 p-4 bg-muted/20 rounded-2xl border border-border/50">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Ex: João Silva" 
                      className="pl-9 h-10 rounded-xl bg-background border-border/50"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Ex: 11999999999" 
                      className="pl-9 h-10 rounded-xl bg-background border-border/50"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Valor Estimado</Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
              <Input 
                type="number" 
                placeholder="0,00" 
                className="pl-9 h-12 text-lg font-black rounded-xl bg-primary/5 border-primary/10 focus:ring-primary/20"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button 
            variant="ghost" 
            className="flex-1 h-11 text-xs font-black uppercase tracking-widest rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button 
            className="flex-1 h-11 text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20"
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? "Criando..." : "Criar Negócio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
