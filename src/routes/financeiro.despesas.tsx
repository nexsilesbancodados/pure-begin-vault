import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, TrendingDown, Receipt } from "lucide-react";
import { ExpenseForm } from "@/components/financeiro/ExpenseForm";

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

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6 lg:p-8 space-y-6">
          <HubHero
            eyebrow="Financeiro"
            icon={TrendingDown}
            title="Despesas"
            subtitle="Cadastre contas a pagar, saídas e despesas operacionais."
            actions={
              <Button
                onClick={() => setOpen(true)}
                className="bg-white text-primary hover:bg-white/90 font-semibold shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Lançamento
              </Button>
            }
          />

          <div className="flex flex-col items-center justify-center text-center py-24 rounded-2xl border border-dashed border-border bg-card/40">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mb-4">
              <Receipt className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground mb-2">
              Nenhuma despesa cadastrada
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Comece registrando seu primeiro lançamento para acompanhar o que entra e o que sai.
            </p>
            <Button onClick={() => setOpen(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>
        </main>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lançamento</DialogTitle>
          </DialogHeader>
          <ExpenseForm onSuccess={() => setOpen(false)} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
