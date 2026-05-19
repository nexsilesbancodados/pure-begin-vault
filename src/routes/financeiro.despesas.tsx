import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — ConectaCRM" },
      { name: "description", content: "Lançamentos de despesas e contas a pagar." },
    ],
  }),
  component: DespesasPage,
});

function DespesasPage() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { orgId } = useOrg();

  const handleSave = async (data: any) => {
    if (!user?.id) return;
    try {
      const payload = { ...data, type: "expense" };
      const { error } = await supabase
        .from("finance_transactions")
        .insert([{ ...payload, user_id: user.id, organization_id: orgId }]);
      if (error) throw error;
      toast.success("Despesa lançada!");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao salvar despesa");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Despesas" subtitle="Contas a pagar e saídas" />
        <main className="flex-1 p-6 lg:p-8">
          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>
        </main>
      </div>

      <ExpenseForm open={open} onOpenChange={setOpen} onSave={handleSave} variant="expense" />
    </div>
  );
}
