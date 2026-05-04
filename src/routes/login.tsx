import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, ArrowRight, Eye, EyeOff, Cloud, MessageCircle, Instagram, Users, TrendingUp, LayoutDashboard, GitBranch, Headphones, Zap, BarChart3, Settings, ShieldCheck, Sparkles, LockKeyhole, ChevronDown } from "lucide-react";
 import { useState } from "react";
 import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — ConectaCRM" },
      { name: "description", content: "Acesse sua conta ConectaCRM." },
    ],
  }),
  component: Login,
});

 function Login() {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [email, setEmail] = useState("renato@conectacrm.com");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(true);
   const [error, setError] = useState("");
 
   const handle = async (e: React.FormEvent) => {
     e.preventDefault();
      setError("");
     setLoading(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      navigate({ to: "/funil" });
   };
 
   return (
     <div className="min-h-screen grid lg:grid-cols-2 bg-white font-sans">
        {/* Left side — Login form */}
       <div className="flex flex-col justify-between px-8 sm:px-16 lg:px-24 py-12 bg-white">
         <div />
         <div className="max-w-md w-full mx-auto">
           {/* Logo */}
           <Link to="/" className="flex items-center gap-3 mb-12">
             <div className="relative h-10 w-10">
               <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 opacity-90" />
               <Cloud className="absolute inset-0 m-auto h-6 w-6 text-white" strokeWidth={2.5} />
             </div>
             <span className="font-bold text-2xl tracking-tight text-slate-900">ConectaCRM</span>
           </Link>

           <h1 className="text-4xl font-bold text-slate-900 tracking-tight mb-3">
             Bem-vindo de volta! <span className="inline-block">👋</span>
           </h1>
           <p className="text-slate-500 text-base mb-10 leading-relaxed">
             Entre na sua conta para continuar gerenciando seus leads.
           </p>

           <form onSubmit={handle} className="space-y-5">
             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">E-mail</label>
               <div className="relative">
                 <Mail className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type="email"
                   placeholder="renato@conectacrm.com"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-900 transition-all placeholder:text-slate-400 text-sm"
                   required
                 />
               </div>
             </div>

             <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <label className="text-sm font-medium text-slate-700">Senha</label>
                 <a className="text-sm text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer">Esqueci a senha</a>
               </div>
               <div className="relative">
                 <Lock className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type={showPassword ? "text" : "password"}
                   placeholder="••••••••"
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   className="w-full h-12 pl-11 pr-11 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-900 transition-all placeholder:text-slate-400 text-sm"
                   required
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                 >
                   {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                 </button>
               </div>
             </div>

             <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
               <input
                 type="checkbox"
                 checked={remember}
                 onChange={(e) => setRemember(e.target.checked)}
                 className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer accent-indigo-600"
               />
               <span className="text-sm text-slate-700">Manter-me conectado</span>
             </label>

             {error && (
               <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                 {error}
               </div>
             )}

             <button
               type="submit"
               disabled={loading}
               className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
             >
               {loading ? "Entrando..." : "Entrar"}
               {!loading && <ArrowRight className="h-4 w-4" />}
             </button>
           </form>

           <p className="mt-8 text-center text-sm text-slate-500">
             Não tem uma conta?{" "}
             <Link to="/registro" className="text-indigo-600 font-semibold hover:underline">
               Criar conta grátis
             </Link>
           </p>
         </div>
         <div />
       </div>

       {/* Right side — Marketing preview */}
       <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-12 flex-col justify-between">
         {/* Decorative blobs */}
         <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/20 rounded-full blur-[140px]" />
         <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-[140px]" />

         {/* Top row */}
         <div className="relative z-10 flex items-center justify-between">
           <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
             <span className="relative flex h-2 w-2">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
               <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
             </span>
             <span className="text-xs font-bold tracking-widest text-slate-700">PLATAFORMA ATIVA</span>
           </div>

           <div className="flex items-center">
             <div className="flex -space-x-2">
               {[31, 32, 33, 34].map((i) => (
                 <div key={i} className="h-9 w-9 rounded-full border-2 border-white bg-slate-200 overflow-hidden ring-1 ring-black/5">
                   <img src={`https://i.pravatar.cc/80?img=${i}`} alt="" className="w-full h-full object-cover" />
                 </div>
               ))}
               <div className="h-9 w-9 rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white text-[10px] font-bold">
                 +12k
               </div>
             </div>
           </div>
         </div>

         {/* Headline */}
         <div className="relative z-10 max-w-xl">
           <h2 className="text-5xl font-bold text-slate-900 tracking-tight leading-[1.05] mb-5">
             Conecte seus leads,<br />
             feche{" "}
             <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
               mais vendas.
             </span>
           </h2>
           <p className="text-slate-500 text-base leading-relaxed">
             Centralize conversas do WhatsApp, Instagram e muito mais, agilize
             seus processos, gerencie seu funil de vendas e ofereça um
             atendimento que encanta.
           </p>
         </div>

         {/* Dashboard mockup */}
         <div className="relative z-10">
           <div className="bg-white rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-100 overflow-hidden">
             <div className="grid grid-cols-[180px_1fr]">
               {/* Sidebar */}
               <div className="bg-slate-50/70 p-4 border-r border-slate-100 space-y-1">
                 <div className="flex items-center gap-2 mb-4 px-2">
                   <div className="h-6 w-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 grid place-items-center">
                     <Cloud className="h-3.5 w-3.5 text-white" />
                   </div>
                   <span className="text-xs font-bold text-slate-900">ConectaCRM</span>
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
                     <div key={i} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] ${it.active ? "bg-white shadow-sm text-slate-900 font-semibold" : "text-slate-500"}`}>
                       <Icon className="h-3.5 w-3.5" />
                       <span>{it.label}</span>
                     </div>
                   );
                 })}
                 <div className="pt-3 mt-3 border-t border-slate-200 flex items-center gap-2 px-1">
                   <img src="https://i.pravatar.cc/40?img=12" alt="" className="h-6 w-6 rounded-full" />
                   <div className="flex-1 min-w-0">
                     <div className="text-[10px] font-semibold text-slate-900 truncate">Olá, Renato! 👋</div>
                     <div className="text-[9px] text-slate-400">Administrador</div>
                   </div>
                   <ChevronDown className="h-3 w-3 text-slate-400" />
                 </div>
               </div>

               {/* Main */}
               <div className="p-4 space-y-3">
                 {/* KPI cards */}
                 <div className="grid grid-cols-4 gap-2">
                   {[
                     { icon: MessageCircle, color: "bg-emerald-100 text-emerald-600", label: "WhatsApp", sub: "Conversas ativas", val: "128", trend: "+28%" },
                     { icon: Instagram, color: "bg-pink-100 text-pink-600", label: "Instagram", sub: "Mensagens", val: "32", trend: "+19%" },
                     { icon: Users, color: "bg-indigo-100 text-indigo-600", label: "Leads", sub: "Novos leads", val: "256", trend: "+32%" },
                     { icon: TrendingUp, color: "bg-violet-100 text-violet-600", label: "Conversões", sub: "Tx conversão", val: "9,2%", trend: "+7%" },
                   ].map((k, i) => {
                     const Icon = k.icon;
                     return (
                       <div key={i} className="rounded-xl border border-slate-100 p-2">
                         <div className={`h-6 w-6 rounded-lg grid place-items-center mb-1.5 ${k.color}`}>
                           <Icon className="h-3 w-3" />
                         </div>
                         <div className="text-[8px] font-semibold text-slate-500">{k.label}</div>
                         <div className="text-[7px] text-slate-400">{k.sub}</div>
                         <div className="flex items-baseline gap-1 mt-0.5">
                           <span className="text-sm font-bold text-slate-900">{k.val}</span>
                           <span className="text-[8px] text-emerald-600 font-semibold">{k.trend}</span>
                         </div>
                       </div>
                     );
                   })}
                 </div>

                 {/* Charts */}
                 <div className="grid grid-cols-2 gap-2">
                   <div className="rounded-xl border border-slate-100 p-3">
                     <div className="flex items-center justify-between mb-2">
                       <div>
                         <div className="text-[9px] font-semibold text-slate-700">Desempenho de vendas</div>
                         <div className="text-sm font-bold text-slate-900">R$ 78.540 <span className="text-[8px] text-emerald-600">+18%</span></div>
                       </div>
                       <div className="text-[8px] text-slate-400 border border-slate-200 rounded-md px-1.5 py-0.5">Este mês</div>
                     </div>
                     <svg viewBox="0 0 200 60" className="w-full h-14">
                       <defs>
                         <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                           <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                         </linearGradient>
                       </defs>
                       <path d="M0,50 L20,45 L40,40 L60,42 L80,35 L100,30 L120,25 L140,20 L160,15 L180,12 L200,8 L200,60 L0,60 Z" fill="url(#g1)" />
                       <path d="M0,50 L20,45 L40,40 L60,42 L80,35 L100,30 L120,25 L140,20 L160,15 L180,12 L200,8" fill="none" stroke="#6366f1" strokeWidth="1.5" />
                     </svg>
                   </div>

                   <div className="rounded-xl border border-slate-100 p-3">
                     <div className="text-[9px] font-semibold text-slate-700 mb-2">Origens dos leads</div>
                     <div className="flex items-center gap-3">
                       <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                         <circle cx="18" cy="18" r="14" fill="none" stroke="#10b981" strokeWidth="6" strokeDasharray="40 100" />
                         <circle cx="18" cy="18" r="14" fill="none" stroke="#ec4899" strokeWidth="6" strokeDasharray="22 100" strokeDashoffset="-40" />
                         <circle cx="18" cy="18" r="14" fill="none" stroke="#6366f1" strokeWidth="6" strokeDasharray="14 100" strokeDashoffset="-62" />
                         <circle cx="18" cy="18" r="14" fill="none" stroke="#f59e0b" strokeWidth="6" strokeDasharray="9 100" strokeDashoffset="-76" />
                         <circle cx="18" cy="18" r="14" fill="none" stroke="#94a3b8" strokeWidth="6" strokeDasharray="5 100" strokeDashoffset="-85" />
                       </svg>
                       <div className="space-y-0.5 text-[8px]">
                         <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />WhatsApp <span className="text-slate-400 ml-1">45%</span></div>
                         <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-pink-500" />Instagram <span className="text-slate-400 ml-1">25%</span></div>
                         <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />Site <span className="text-slate-400 ml-1">15%</span></div>
                         <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />Indicação <span className="text-slate-400 ml-1">10%</span></div>
                         <div className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-400" />Outros <span className="text-slate-400 ml-1">5%</span></div>
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Recent attendances */}
                 <div className="rounded-xl border border-slate-100 p-3">
                   <div className="text-[9px] font-semibold text-slate-700 mb-2">Atendimentos recentes</div>
                   <div className="space-y-1.5">
                     {[
                       { name: "Juliana Martins", channel: "WhatsApp", time: "10:32", img: 47 },
                       { name: "Bruno Silva", channel: "Instagram", time: "10:21", img: 12 },
                       { name: "Carlos Eduardo", channel: "WhatsApp", time: "10:15", img: 33 },
                     ].map((a, i) => (
                       <div key={i} className="flex items-center gap-2">
                         <img src={`https://i.pravatar.cc/40?img=${a.img}`} alt="" className="h-5 w-5 rounded-full" />
                         <div className="flex-1 min-w-0">
                           <div className="text-[9px] font-semibold text-slate-900 truncate">{a.name}</div>
                           <div className="text-[8px] text-slate-400">{a.channel}</div>
                         </div>
                         <div className="text-[8px] text-slate-400">{a.time}</div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
             </div>
           </div>

           {/* Floating "Leads" pill */}
           <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-2.5 flex items-center gap-3">
             <div className="h-8 w-8 rounded-xl bg-indigo-100 grid place-items-center">
               <Users className="h-4 w-4 text-indigo-600" />
             </div>
             <div>
               <div className="text-[10px] font-semibold text-slate-700">Leads</div>
               <div className="text-[8px] text-slate-400">Novos leads</div>
             </div>
             <div className="text-base font-bold text-slate-900">128 <span className="text-[9px] text-emerald-600">+21%</span></div>
             <div className="flex -space-x-1.5 ml-2">
               {[20, 21, 22].map((i) => (
                 <img key={i} src={`https://i.pravatar.cc/40?img=${i}`} className="h-6 w-6 rounded-full border-2 border-white" alt="" />
               ))}
               <div className="h-6 w-6 rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white text-[8px] font-bold">+41</div>
             </div>
           </div>
         </div>

         {/* Bottom badges */}
         <div className="relative z-10 grid grid-cols-3 gap-4 pt-10">
           {[
             { icon: ShieldCheck, color: "text-emerald-600 bg-emerald-100", title: "Seus dados protegidos", sub: "com segurança de ponta." },
             { icon: Sparkles, color: "text-violet-600 bg-violet-100", title: "Automações inteligentes", sub: "que economizam seu tempo." },
             { icon: LockKeyhole, color: "text-indigo-600 bg-indigo-100", title: "Conformidade com", sub: "LGPD e criptografia." },
           ].map((b, i) => {
             const Icon = b.icon;
             return (
               <div key={i} className="flex items-center gap-3">
                 <div className={`h-10 w-10 rounded-xl grid place-items-center ${b.color}`}>
                   <Icon className="h-5 w-5" />
                 </div>
                 <div className="text-xs leading-tight">
                   <div className="font-semibold text-slate-700">{b.title}</div>
                   <div className="text-slate-500">{b.sub}</div>
                 </div>
               </div>
             );
           })}
         </div>
       </div>
     </div>
    );
  }
