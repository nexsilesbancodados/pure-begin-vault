import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Smartphone, AlertCircle, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/minha-conta/seguranca")({
  component: SegurancaPage,
});

function SegurancaPage() {
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      setFactors(data?.totp ?? []);
    } catch (e: any) {
      console.warn(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `App ${new Date().toLocaleDateString("pt-BR")}`,
      });
      if (error) throw error;
      setQr((data as any).totp.qr_code);
      setSecret((data as any).totp.secret);
      setFactorId(data.id);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setEnrolling(false);
    }
  };

  const verify = async () => {
    if (!factorId || !code.trim()) return;
    try {
      const { data: chal } = await supabase.auth.mfa.challenge({ factorId });
      if (!chal) throw new Error("challenge falhou");
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: chal.id,
        code: code.trim(),
      });
      if (error) throw error;
      toast.success("2FA ativado!");
      setQr(null); setFactorId(null); setSecret(null); setCode("");
      load();
    } catch (e: any) {
      toast.error("Código inválido: " + e.message);
    }
  };

  const unenroll = async (id: string) => {
    if (!confirm("Desativar 2FA? Sua conta ficará menos segura.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("2FA desativado");
    load();
  };

  const activeFactors = factors.filter((f) => f.status === "verified");

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Segurança" subtitle="2FA, sessões e login" />
        <main className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full space-y-4">
          <Card className={`p-5 ${activeFactors.length > 0 ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
            <div className="flex items-start gap-3">
              <ShieldCheck className={`h-5 w-5 ${activeFactors.length > 0 ? "text-success" : "text-warning"} shrink-0 mt-0.5`} />
              <div className="flex-1">
                <h2 className="font-black">
                  2FA: {activeFactors.length > 0 ? "✓ Ativo" : "Não configurado"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Autenticação de 2 fatores via app (Google Authenticator, Authy, 1Password)
                  protege sua conta mesmo se a senha vazar.
                </p>
              </div>
            </div>
          </Card>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : qr ? (
            <Card className="p-5 space-y-4">
              <h3 className="font-black">Configurar 2FA</h3>
              <div className="text-center">
                <div className="bg-white p-4 rounded-xl inline-block">
                  <img src={qr} alt="QR Code" className="h-48 w-48" />
                </div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-3">
                  Ou cole manualmente
                </p>
                <code className="text-xs font-mono break-all">{secret}</code>
              </div>

              <ol className="text-sm space-y-2 text-muted-foreground">
                <li>1. Abra Google Authenticator (ou Authy, 1Password)</li>
                <li>2. Escaneie o QR code</li>
                <li>3. Digite o código de 6 dígitos que aparecer</li>
              </ol>

              <div>
                <Label htmlFor="totp-code">Código de 6 dígitos</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setQr(null); setFactorId(null); }}>Cancelar</Button>
                <Button onClick={verify} disabled={code.length !== 6} className="flex-1">
                  <Check className="h-4 w-4 mr-2" /> Confirmar
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <h3 className="font-black mb-3">Fatores configurados</h3>
              {activeFactors.length === 0 ? (
                <div className="text-center py-6">
                  <Smartphone className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-bold mb-1">Sem 2FA ativo</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Recomendamos fortemente ativar. Leva 1 minuto.
                  </p>
                  <Button onClick={startEnroll} disabled={enrolling}>
                    {enrolling ? "Preparando..." : "Ativar 2FA"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeFactors.map((f) => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-border">
                      <div>
                        <p className="font-bold text-sm">{f.friendly_name ?? "Authenticator"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Adicionado {new Date(f.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => unenroll(f.id)}>Desativar</Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="p-4 bg-muted/40 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                <strong>Apps recomendados:</strong> Google Authenticator (Android/iOS), Authy,
                Microsoft Authenticator, 1Password.
              </p>
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
