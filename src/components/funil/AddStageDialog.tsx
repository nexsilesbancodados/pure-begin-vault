import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { LayoutGrid, Palette } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AddStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  stagesCount: number;
}

export function AddStageDialog({ open, onOpenChange, onSuccess, stagesCount }: AddStageDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8B5CF6");

  const colors = [
    { name: "Roxo", value: "#8B5CF6" },
    { name: "Rosa", value: "#EC4899" },
    { name: "Azul", value: "#3B82F6" },
    { name: "Verde", value: "#10B981" },
    { name: "Laranja", value: "#F59E0B" },
    { name: "Vermelho", value: "#EF4444" },
    { name: "Ciano", value: "#06B6D4" },
  ];

  const handleAdd = async () => {
    if (!user?.id || !name) {
      toast.error("Nome da etapa é obrigatório");
      return;
    }
    
    setLoading(true);
    try {
      const nextIndex = stagesCount;
      const { error } = await supabase.from("funnel_stages").insert({
        user_id: user.id,
        name,
        order_index: nextIndex,
        color
      });

      if (error) throw error;

      toast.success("Etapa criada com sucesso!");
      onSuccess();
      onOpenChange(false);
      setName("");
    } catch (err: any) {
      toast.error("Erro ao criar etapa: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black italic uppercase tracking-tight text-foreground">
            <LayoutGrid className="h-5 w-5 text-primary" />
            Nova Etapa
          </DialogTitle>
          <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            Organize seu processo comercial
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nome da Etapa</Label>
            <Input 
              placeholder="Ex: Reunião de Diagnóstico" 
              className="h-11 rounded-xl bg-muted/30 border-none focus:ring-1 focus:ring-primary/20"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cor de Destaque</Label>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${color === c.value ? "border-primary scale-110 shadow-md" : "border-transparent opacity-60 hover:opacity-100"}`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
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
            {loading ? "Criando..." : "Criar Etapa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
