import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Lock, Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/aceitar-convite/$token")({
  head: () => ({
    meta: [
      { title: "Aceitar convite — ConectaCRM" },
      { name: "description", content: "Entre na equipe da sua empresa no ConectaCRM." },
    ],
  }),
  component: AcceptInvite,
});

function AcceptInvite() {
  const { token } = useParams({ from: "/aceitar-convite/$token" });
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("team_invitations")
        .select("*")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) setError("Convite inválido ou expirado.");
      else if (data.status !== "pending") setError("Este convite já foi utilizado.");
      else if (new Date(data.expires_at) < new Date()) setError("Este convite expirou.");
      else setInvite(data);
      setLoading(false);
    })();
  }, [token]);

  const accept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setSubmitting(true);
    setError("");
    const { error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/painel`,
        data: {
          full_name: name,
          organization_id: invite.organization_id,
          role: invite.role,
        },
      },
    });
    if (signUpErr) {
      setSubmitting(false);
      return setError(signUpErr.message);
    }
    await supabase
      .from("team_invitations")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center">
            <Cloud className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-900">ConectaCRM</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando convite...
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 mb-6 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <div>
                Você foi convidado como <strong>{invite.role}</strong> com o e-mail{" "}
                <strong>{invite.email}</strong>.
              </div>
            </div>
            <form onSubmit={accept} className="space-y-4">
              <input
                required
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
              />
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="password"
                  placeholder="Crie uma senha"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                />
              </div>
              <button
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm disabled:opacity-50"
              >
                {submitting ? "Criando conta..." : "Aceitar convite e entrar"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
