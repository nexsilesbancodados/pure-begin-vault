 import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
 import { Mail, Lock, ArrowRight, User, Cloud, MessageCircle, Instagram, Users, TrendingUp, LayoutDashboard, GitBranch, Headphones, Zap, BarChart3, Settings, ShieldCheck, Sparkles, LockKeyhole, ChevronDown, Eye, EyeOff } from "lucide-react";
 import { useState } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";

 export const Route = createFileRoute("/registro")({
   head: () => ({
     meta: [
       { title: "Criar Conta — ConectaCRM" },
       { name: "description", content: "Crie sua conta no ConectaCRM." },
     ],
   }),
   component: Register,
 });

 function Register() {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [name, setName] = useState("");
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [showPassword, setShowPassword] = useState(false);
   const [error, setError] = useState("");

   const handleRegister = async (e: React.FormEvent) => {
     e.preventDefault();
     setError("");
     setLoading(true);

     if (!name || !email || !password) {
       setError("Por favor, preencha todos os campos.");
       setLoading(false);
       return;
     }

     const { data, error: signUpError } = await supabase.auth.signUp({
       email: email.trim(),
       password,
       options: {
         data: {
           display_name: name,
         },
       },
     });

     if (signUpError) {
       setError(signUpError.message);
       setLoading(false);
       return;
     }

     toast.success("Conta criada com sucesso! Você já pode entrar.");
     navigate({ to: "/login" });
   };

   return (
     <div className="min-h-screen grid lg:grid-cols-2 bg-white font-sans">
        {/* Left side — Register form */}
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
             Criar conta <span className="inline-block">🚀</span>
           </h1>
           <p className="text-slate-500 text-base mb-10 leading-relaxed">
             Comece a gerenciar seus leads e vendas de forma inteligente.
           </p>

           <form onSubmit={handleRegister} className="space-y-5">
             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Nome Completo</label>
               <div className="relative">
                 <User className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type="text"
                   placeholder="Seu nome"
                   value={name}
                   onChange={(e) => setName(e.target.value)}
                   className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-900 transition-all placeholder:text-slate-400 text-sm"
                   required
                 />
               </div>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">E-mail</label>
               <div className="relative">
                 <Mail className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type="email"
                   placeholder="seu@email.com"
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-slate-900 transition-all placeholder:text-slate-400 text-sm"
                   required
                 />
               </div>
             </div>

             <div className="space-y-2">
               <label className="text-sm font-medium text-slate-700">Senha</label>
               <div className="relative">
                 <Lock className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input
                   type={showPassword ? "text" : "password"}
                   placeholder="Mínimo 6 caracteres"
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

             {error && (
               <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                 {error}
               </div>
             )}

             <button
               type="submit"
               disabled={loading}
               className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 mt-2"
             >
               {loading ? "Criando conta..." : "Criar conta grátis"}
               {!loading && <ArrowRight className="h-4 w-4" />}
             </button>
           </form>

           <p className="mt-8 text-center text-sm text-slate-500">
             Já tem uma conta?{" "}
             <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
               Fazer login
             </Link>
           </p>
         </div>
         <div />
       </div>

       {/* Right side — Marketing preview (Same as login) */}
       <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-violet-50/40 p-12 flex-col justify-between">
         <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-violet-200/20 rounded-full blur-[140px]" />
         <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-[140px]" />

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
               <div className="h-9 w-9 rounded-full border-2 border-white bg-gradient-to-br from-indigo-500 to-violet-600 grid place-items-center text-white text-[10px] font-bold">+12k</div>
             </div>
           </div>
         </div>

         <div className="relative z-10 max-w-xl">
           <h2 className="text-5xl font-bold text-slate-900 tracking-tight leading-[1.05] mb-5">
             Transforme sua gestão <br />
             em{" "}
             <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
               resultados reais.
             </span>
           </h2>
           <p className="text-slate-500 text-base leading-relaxed">
             Junte-se a milhares de empresas que já usam o ConectaCRM para escalar suas operações e fechar mais vendas todos os dias.
           </p>
         </div>

         <div className="relative z-10">
           <div className="bg-white rounded-3xl shadow-2xl shadow-slate-300/40 border border-slate-100 overflow-hidden">
             <div className="grid grid-cols-[180px_1fr]">
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
               </div>
               <div className="p-4 space-y-3">
                 <div className="grid grid-cols-4 gap-2">
                   {[
                     { icon: MessageCircle, color: "bg-emerald-100 text-emerald-600", val: "128", trend: "+28%" },
                     { icon: Instagram, color: "bg-pink-100 text-pink-600", val: "32", trend: "+19%" },
                     { icon: Users, color: "bg-indigo-100 text-indigo-600", val: "256", trend: "+32%" },
                     { icon: TrendingUp, color: "bg-violet-100 text-violet-600", val: "9,2%", trend: "+7%" },
                   ].map((k, i) => {
                     const Icon = k.icon;
                     return (
                       <div key={i} className="rounded-xl border border-slate-100 p-2">
                         <div className={`h-6 w-6 rounded-lg grid place-items-center mb-1.5 ${k.color}`}>
                           <Icon className="h-3 w-3" />
                         </div>
                         <div className="flex items-baseline gap-1">
                           <span className="text-[10px] font-bold text-slate-900">{k.val}</span>
                           <span className="text-[7px] text-emerald-600 font-semibold">{k.trend}</span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
                 <div className="rounded-xl border border-slate-100 p-3">
                   <div className="text-[9px] font-semibold text-slate-700 mb-2">Desempenho de vendas</div>
                   <svg viewBox="0 0 200 60" className="w-full h-14">
                     <path d="M0,50 L20,45 L40,40 L60,42 L80,35 L100,30 L120,25 L140,20 L160,15 L180,12 L200,8" fill="none" stroke="#6366f1" strokeWidth="1.5" />
                   </svg>
                 </div>
               </div>
             </div>
           </div>
         </div>

         <div className="relative z-10 grid grid-cols-3 gap-4 pt-10">
           {[
             { icon: ShieldCheck, color: "text-emerald-600 bg-emerald-100", title: "Dados seguros" },
             { icon: Sparkles, color: "text-violet-600 bg-violet-100", title: "Automações" },
             { icon: LockKeyhole, color: "text-indigo-600 bg-indigo-100", title: "Conformidade" },
           ].map((b, i) => {
             const Icon = b.icon;
             return (
               <div key={i} className="flex items-center gap-3">
                 <div className={`h-10 w-10 rounded-xl grid place-items-center ${b.color}`}>
                   <Icon className="h-5 w-5" />
                 </div>
                 <div className="text-[10px] font-semibold text-slate-700 leading-tight">{b.title}</div>
               </div>
             );
           })}
         </div>
       </div>
     </div>
   );
 }