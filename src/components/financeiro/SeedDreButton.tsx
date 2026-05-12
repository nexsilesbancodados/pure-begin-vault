import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useOrg } from "@/lib/useOrg";
import { seedChartOfAccounts } from "@/lib/seedDre";
import { toast } from "sonner";

export function SeedDreButton({ onDone }: { onDone?: () => void }) {
  const { orgId, userId } = useOrg();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!orgId || !userId) return;
    if (!confirm("Vou criar 25+ contas pré-prontas pra loja de celular. Tudo bem?")) return;
    setLoading(true);
    try {
      const r = await seedChartOfAccounts(orgId, userId);
      toast.success(`${r.created} contas criadas (${r.skipped} já existiam)`);
      onDone?.();
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message ?? "erro"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={run} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
      Importar plano padrão (loja celular)
    </Button>
  );
}
