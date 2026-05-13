import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/minha-conta/lgpd")({
  component: LGPDPage,
});

function LGPDPage() {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportData = async () => {
    setDownloading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/export-data", {
        headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error("Erro: " + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conectaphone-meus-dados-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch (e: any) {
      toast.error("Falhou: " + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETAR MINHA CONTA") {
      toast.error("Digite EXATAMENTE: DELETAR MINHA CONTA");
      return;
    }
    if (
      !confirm(
        "Tem certeza? Esta ação é IRREVERSÍVEL. Você perde acesso a TODAS as suas lojas e dados.",
      )
    )
      return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).rpc("delete_my_account");
      if (error) throw error;
      toast.success("Conta deletada");
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/" }), 1500);
    } catch (e: any) {
      toast.error("Falhou: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Privacidade (LGPD)" subtitle="Seus direitos sobre dados pessoais" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl mx-auto w-full">
          <Card className="p-5 bg-success/5 border-success/30">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-success mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-black">Seus direitos (LGPD Art. 18)</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Você tem direito a acesso, correção, portabilidade e eliminação dos seus dados
                  pessoais. Use as opções abaixo para exercer esses direitos.
                </p>
              </div>
            </div>
          </Card>

          {/* Portabilidade */}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-black">Exportar meus dados</h2>
                <p className="text-xs text-muted-foreground">
                  Direito de portabilidade — Art. 18 VI
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Baixe um arquivo JSON com todos seus dados: perfil, lojas, vendas, clientes, produtos,
              OS, mensagens, automações, etc.
            </p>
            <Button onClick={exportData} disabled={downloading}>
              <Download className="h-4 w-4 mr-2" />
              {downloading ? "Gerando..." : "Baixar meus dados (JSON)"}
            </Button>
          </Card>

          {/* DPO */}
          <Card className="p-5">
            <h3 className="font-black mb-2">Encarregado de Dados (DPO)</h3>
            <p className="text-sm text-muted-foreground">
              Para dúvidas sobre tratamento de dados: <strong>dpo@conectaphone.com</strong>
            </p>
          </Card>

          {/* Deletar */}
          <Card className="p-5 border-destructive/30">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
                <Trash2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-black text-destructive">Excluir minha conta</h2>
                <p className="text-xs text-muted-foreground">
                  Direito de esquecimento — Art. 18 VI/X
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-destructive/5 border border-destructive/30 p-3 mb-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-muted-foreground">
                  <strong className="text-destructive">Ação irreversível.</strong> Apaga: conta,
                  perfil, vínculo com lojas, notificações, logs de auditoria pessoais. Dados das
                  lojas que você é dono permanecem (passe a propriedade antes se necessário).
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-xs">
                Para confirmar, digite: <code className="font-mono">DELETAR MINHA CONTA</code>
              </Label>
              <Input
                id="confirm"
                placeholder="DELETAR MINHA CONTA"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={deleteAccount}
                disabled={deleting || confirmText !== "DELETAR MINHA CONTA"}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting ? "Excluindo..." : "Excluir conta permanentemente"}
              </Button>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
