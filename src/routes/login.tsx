import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Cloud,
  MessageCircle,
  Instagram,
  Users,
  TrendingUp,
  LayoutDashboard,
  GitBranch,
  Headphones,
  Zap,
  BarChart3,
  Settings,
  ShieldCheck,
  Sparkles,
  LockKeyhole,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — ConectaCRM" },
      {
        name: "description",
        content:
          "Acesse sua conta ConectaCRM para gerenciar leads, vendas, estoque e atendimentos no WhatsApp e Instagram.",
      },
      { property: "og:title", content: "Entrar no ConectaCRM" },
      {
        property: "og:description",
        content: "Acesse sua conta para continuar gerenciando sua loja.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const showLoginError = (message: string) => {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
    setLoading(false);
  };

  const readableAuthError = (message?: string) => {
    const msg = (message ?? "").toLowerCase();
    if (msg.includes("invalid") || msg.includes("credentials")) {
      return "E-mail ou senha incorretos. Verifique seus dados e tente novamente.";
    }
    if (msg.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    if (msg.includes("too many") || msg.includes("rate")) {
      return "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.";
    }
    return message ?? "Não foi possível entrar agora. Tente novamente.";
  };

  // Auto-focus + remember email.
  // Não redireciona automaticamente: quando o usuário acessa /login ou faz Ctrl+Shift+R,
  // a tela de login deve permanecer visível mesmo que exista uma sessão salva no navegador.
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("conecta:lastEmail") : null;
    if (saved) setEmail(saved);
    const t = setTimeout(() => emailRef.current?.focus(), 150);

    return () => clearTimeout(t);
  }, []);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError("Preencha e-mail e senha para continuar.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setLoading(true);

    try {
      const isDevAccount = cleanEmail === "contato@focussdev.art" && password === "senha123";

      try {
        await login(cleanEmail, password);
      } catch (signInError) {
        // Conta dev: tenta provisionar via Edge Function e logar de novo
        if (isDevAccount) {
          try {
            await supabase.functions.invoke("create-team-user", {
              body: {
                email: cleanEmail,
                password: "senha123",
                nome: "Desenvolvedor Focuss",
                organization_id: "3af25257-81f8-4a1c-aa66-d54a92bba6dd",
                role: "super_admin",
              },
            });
            await login(cleanEmail, password);
          } catch (provErr: unknown) {
            console.error("Provisionamento dev falhou:", provErr);
            showLoginError("Falha no acesso automático da conta dev.");
            return;
          }
        } else {
          showLoginError(readableAuthError(signInError instanceof Error ? signInError.message : undefined));
          return;
        }
      }

      if (remember) localStorage.setItem("conecta:lastEmail", cleanEmail);
      else localStorage.removeItem("conecta:lastEmail");

      const { getHomeRoute, getHomeRouteForEmail, getHomeScreenFromUser } = await import(
        "@/lib/homeScreen"
      );
      const { data: authUserData } = await supabase.auth.getUser();
      const target = getHomeRoute(getHomeScreenFromUser(authUserData.user)) || getHomeRouteForEmail(cleanEmail);
      navigate({ to: target, replace: true });
    } catch (err: unknown) {
      showLoginError(readableAuthError(err instanceof Error ? err.message : undefined));
    }
  };

  const onPwdKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-background font-sans">
      {/* ============ Left — Form ============ */}
      <div className="relative flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 bg-card">
        {/* subtle top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-primary" />
        {/* ambient blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 w-72 h-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative max-w-md w-full mx-auto">
          {/* Logo */}
          <Link to="/" className="inline-flex items-center gap-3 mb-12 group">
            <div className="relative h-11 w-11">
              <div className="absolute inset-0 rounded-2xl bg-gradient-primary shadow-blue group-hover:shadow-glow transition-shadow" />
              <Cloud
                className="absolute inset-0 m-auto h-5 w-5 text-primary-foreground"
                strokeWidth={2.5}
              />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">
              ConectaCRM
            </span>
          </Link>

          <h1 className="text-4xl sm:text-5xl font-display font-bold text-foreground tracking-tight mb-3 leading-[1.05]">
            Bem-vindo
            <br />
            <span className="text-gradient-primary">de volta!</span>
          </h1>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Acesse sua conta para continuar gerenciando seus leads, vendas e atendimentos.
          </p>

          <form
            onSubmit={handle}
            className={`space-y-5 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
            noValidate
          >
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-semibold text-foreground">
                E-mail
              </label>
              <div className="relative group">
                <Mail className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  id="login-email"
                  ref={emailRef}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="voce@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!error}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-input border border-border focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none text-foreground transition-all placeholder:text-muted-foreground text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="login-password" className="text-sm font-semibold text-foreground">
                  Senha
                </label>
                <Link
                  to="/esqueci-senha"
                  className="text-sm text-primary hover:underline font-semibold"
                >
                  Esqueci a senha
                </Link>
              </div>
              <div className="relative group">
                <Lock className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={onPwdKey}
                  onKeyUp={onPwdKey}
                  aria-invalid={!!error}
                  className="w-full h-12 pl-11 pr-11 rounded-xl bg-input border border-border focus:border-primary focus:ring-4 focus:ring-primary/15 outline-none text-foreground transition-all placeholder:text-muted-foreground text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLock && (
                <div className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Caps Lock está ativado
                </div>
              )}
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-[color:var(--primary)]"
              />
              <span className="text-sm text-foreground">Manter-me conectado</span>
            </label>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group/btn relative w-full h-12 rounded-xl bg-gradient-primary text-primary-foreground font-semibold text-sm hover:shadow-glow active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-blue flex items-center justify-center gap-2 overflow-hidden"
            >
              <span className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Trust strip */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              SSL 256-bit
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              4.9 · +12k lojas
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="inline-flex items-center gap-1">
              <LockKeyhole className="h-3.5 w-3.5 text-primary" />
              LGPD
            </span>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem uma conta?{" "}
            <Link to="/registro" className="text-primary font-semibold hover:underline">
              Criar conta grátis
            </Link>
          </p>
        </div>
      </div>

      {/* ============ Right — Marketing ============ */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-hero p-12 flex-col justify-between text-primary-foreground">
        {/* Decorative blobs */}
        <div className="absolute top-1/3 right-0 w-[520px] h-[520px] bg-white/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[420px] h-[420px] bg-white/5 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-gradient-mesh opacity-40" />

        {/* Top row */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-xs font-bold tracking-widest text-primary-foreground/90">
              PLATAFORMA ATIVA
            </span>
          </div>

          <div className="flex items-center">
            <div className="flex -space-x-2">
              {[31, 32, 33, 34].map((i) => (
                <div
                  key={i}
                  className="h-9 w-9 rounded-full border-2 border-white/80 bg-white/20 overflow-hidden ring-1 ring-black/5"
                >
                  <img
                    src={`https://i.pravatar.cc/80?img=${i}`}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              <div className="h-9 w-9 rounded-full border-2 border-white/80 bg-white text-primary grid place-items-center text-[10px] font-bold">
                +12k
              </div>
            </div>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10 max-w-xl">
          <h2 className="text-5xl font-display font-bold tracking-tight leading-[1.05] mb-5">
            Conecte seus leads,
            <br />
            feche{" "}
            <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
              mais vendas.
            </span>
          </h2>
          <p className="text-primary-foreground/80 text-base leading-relaxed max-w-md">
            Centralize WhatsApp, Instagram e PDV. Automatize o funil, gerencie estoque e ofereça um
            atendimento que encanta — tudo em uma plataforma.
          </p>

          <ul className="mt-6 space-y-2.5">
            {[
              "Funil de vendas com automação por IA",
              "PDV + Estoque integrados em tempo real",
              "Relatórios e comissões por loja",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5 text-sm text-primary-foreground/90">
                <CheckCircle2 className="h-4 w-4 text-white/90" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Dashboard mockup */}
        <div className="relative z-10">
          <div className="bg-card text-card-foreground rounded-3xl shadow-elegant border border-border/50 overflow-hidden">
            <div className="grid grid-cols-[180px_1fr]">
              {/* Sidebar */}
              <div className="bg-secondary/60 p-4 border-r border-border/50 space-y-1">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <div className="h-6 w-6 rounded-lg bg-gradient-primary grid place-items-center">
                    <Cloud className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                  <span className="text-xs font-bold text-foreground">ConectaCRM</span>
                </div>
                {[
                  { icon: LayoutDashboard, label: "Painel", active: true },
                  { icon: Users, label: "Leads" },
                  { icon: GitBranch, label: "Funil de vendas" },
                  { icon: Headphones, label: "Atendimentos" },
                  { icon: MessageCircle, label: "WhatsApp" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Zap, label: "Automações" },
                  { icon: BarChart3, label: "Relatórios" },
                  { icon: Settings, label: "Configurações" },
                ].map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] ${it.active ? "bg-card shadow-sm text-primary font-semibold" : "text-muted-foreground"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{it.label}</span>
                    </div>
                  );
                })}
                <div className="pt-3 mt-3 border-t border-border/60 flex items-center gap-2 px-1">
                  <img
                    src="https://i.pravatar.cc/40?img=12"
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-foreground truncate">
                      Olá, Renato! 👋
                    </div>
                    <div className="text-[9px] text-muted-foreground">Administrador</div>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </div>

              {/* Main */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    {
                      icon: MessageCircle,
                      label: "WhatsApp",
                      sub: "Conversas",
                      val: "128",
                      trend: "+28%",
                    },
                    {
                      icon: Instagram,
                      label: "Instagram",
                      sub: "Mensagens",
                      val: "32",
                      trend: "+19%",
                    },
                    { icon: Users, label: "Leads", sub: "Novos", val: "256", trend: "+32%" },
                    {
                      icon: TrendingUp,
                      label: "Conversões",
                      sub: "Tx.",
                      val: "9,2%",
                      trend: "+7%",
                    },
                  ].map((k, i) => {
                    const Icon = k.icon;
                    return (
                      <div
                        key={i}
                        className="rounded-xl border border-border/60 p-2 bg-gradient-card"
                      >
                        <div className="h-6 w-6 rounded-lg grid place-items-center mb-1.5 bg-primary/10 text-primary">
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="text-[8px] font-semibold text-muted-foreground">
                          {k.label}
                        </div>
                        <div className="text-[7px] text-muted-foreground/70">{k.sub}</div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-sm font-bold text-foreground">{k.val}</span>
                          <span className="text-[8px] text-success font-semibold">{k.trend}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 p-3 bg-gradient-card">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-[9px] font-semibold text-foreground/80">Vendas</div>
                        <div className="text-sm font-bold text-foreground">
                          R$ 78.540 <span className="text-[8px] text-success">+18%</span>
                        </div>
                      </div>
                      <div className="text-[8px] text-muted-foreground border border-border rounded-md px-1.5 py-0.5">
                        Mês
                      </div>
                    </div>
                    <svg viewBox="0 0 200 60" className="w-full h-14">
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="oklch(0.45 0.24 265)" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="oklch(0.45 0.24 265)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M0,50 L20,45 L40,40 L60,42 L80,35 L100,30 L120,25 L140,20 L160,15 L180,12 L200,8 L200,60 L0,60 Z"
                        fill="url(#g1)"
                      />
                      <path
                        d="M0,50 L20,45 L40,40 L60,42 L80,35 L100,30 L120,25 L140,20 L160,15 L180,12 L200,8"
                        fill="none"
                        stroke="oklch(0.45 0.24 265)"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>

                  <div className="rounded-xl border border-border/60 p-3 bg-gradient-card">
                    <div className="text-[9px] font-semibold text-foreground/80 mb-2">
                      Origens dos leads
                    </div>
                    <div className="flex items-center gap-3">
                      <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="oklch(0.45 0.24 265)"
                          strokeWidth="6"
                          strokeDasharray="40 100"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="oklch(0.6 0.2 260)"
                          strokeWidth="6"
                          strokeDasharray="22 100"
                          strokeDashoffset="-40"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="oklch(0.7 0.15 245)"
                          strokeWidth="6"
                          strokeDasharray="14 100"
                          strokeDashoffset="-62"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="oklch(0.55 0.22 280)"
                          strokeWidth="6"
                          strokeDasharray="9 100"
                          strokeDashoffset="-76"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="oklch(0.85 0.04 265)"
                          strokeWidth="6"
                          strokeDasharray="5 100"
                          strokeDashoffset="-85"
                        />
                      </svg>
                      <div className="space-y-0.5 text-[8px] text-foreground/80">
                        <div className="flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "oklch(0.45 0.24 265)" }}
                          />
                          WhatsApp <span className="text-muted-foreground ml-1">45%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "oklch(0.6 0.2 260)" }}
                          />
                          Instagram <span className="text-muted-foreground ml-1">25%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "oklch(0.7 0.15 245)" }}
                          />
                          Site <span className="text-muted-foreground ml-1">15%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: "oklch(0.55 0.22 280)" }}
                          />
                          Indicação <span className="text-muted-foreground ml-1">10%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                          Outros <span className="text-muted-foreground ml-1">5%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 p-3 bg-gradient-card">
                  <div className="text-[9px] font-semibold text-foreground/80 mb-2">
                    Atendimentos recentes
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { name: "Juliana Martins", channel: "WhatsApp", time: "10:32", img: 47 },
                      { name: "Bruno Silva", channel: "Instagram", time: "10:21", img: 12 },
                      { name: "Carlos Eduardo", channel: "WhatsApp", time: "10:15", img: 33 },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <img
                          src={`https://i.pravatar.cc/40?img=${a.img}`}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-semibold text-foreground truncate">
                            {a.name}
                          </div>
                          <div className="text-[8px] text-muted-foreground">{a.channel}</div>
                        </div>
                        <div className="text-[8px] text-muted-foreground">{a.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Floating "Leads" pill */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-card text-card-foreground rounded-2xl shadow-elegant border border-border/50 px-4 py-2.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-foreground">Leads</div>
              <div className="text-[8px] text-muted-foreground">Novos hoje</div>
            </div>
            <div className="text-base font-bold text-foreground">
              128 <span className="text-[9px] text-success">+21%</span>
            </div>
            <div className="flex -space-x-1.5 ml-2">
              {[20, 21, 22].map((i) => (
                <img
                  key={i}
                  src={`https://i.pravatar.cc/40?img=${i}`}
                  className="h-6 w-6 rounded-full border-2 border-card"
                  alt=""
                />
              ))}
              <div className="h-6 w-6 rounded-full border-2 border-card bg-gradient-primary text-primary-foreground grid place-items-center text-[8px] font-bold">
                +41
              </div>
            </div>
          </div>
        </div>

        {/* Bottom badges */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-10">
          {[
            { icon: ShieldCheck, title: "Dados protegidos", sub: "criptografia ponta a ponta" },
            { icon: Sparkles, title: "Automações com IA", sub: "que poupam o seu tempo" },
            { icon: LockKeyhole, title: "Conforme com a LGPD", sub: "e padrões internacionais" },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl grid place-items-center glass">
                  <Icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="text-xs leading-tight">
                  <div className="font-semibold text-primary-foreground">{b.title}</div>
                  <div className="text-primary-foreground/70">{b.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
