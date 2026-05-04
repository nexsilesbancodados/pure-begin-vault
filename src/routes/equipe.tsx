import { createFileRoute, Link } from "@tanstack/react-router";
 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { UsersRound, Plus, MoreHorizontal, Shield, Mail, Phone, Search, UserCircle, MessageCircle, Instagram, GitBranch, Headphones, Zap, BarChart3, Settings, ShieldCheck, Sparkles, LockKeyhole } from "lucide-react";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/equipe")({
  head: () => ({ meta: [{ title: "Equipe — ConectaCRM" }, { name: "description", content: "Gerencie permissões e membros" }] }),
  component: EquipePage,
});

function EquipePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
   const [team, setTeam] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending: true });
      
      if (error) throw error;
      setTeam(data || []);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast.error('Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  };


    const handleInvite = async (newMember: any) => {
      if (!user?.id) return;
      
      try {
        // 1. Criar convite no banco (gera token automático)
        const { data: invite, error: inviteErr } = await supabase
          .from('team_invitations')
          .insert({
            user_id: user.id,
            email: newMember.email,
            role: newMember.role.toLowerCase() === 'administrador' ? 'admin' : 
                  newMember.role.toLowerCase() === 'vendedor' ? 'vendedor' : 'vendedor'
          })
          .select()
          .single();

        if (inviteErr) throw inviteErr;

        // 2. Chamar Edge Function para enviar e-mail com template
        const { error: emailErr } = await supabase.functions.invoke('send-email', {
          body: {
            to: newMember.email,
            subject: `Você foi convidado para o ConectaCRM por ${user.email}`,
            template: 'invite',
            templateData: {
              token: invite.token,
              inviterEmail: user.email
            }
          }
        });

        if (emailErr) throw emailErr;

        toast.success(`Convite enviado para ${newMember.email}`);
        fetchTeam();
      } catch (error: any) {
        console.error('Invite error:', error);
        toast.error('Erro ao enviar convite: ' + (error.message || 'Erro interno'));
      }
    };

   const handleRemoveMember = async (id: string) => {
     if (!confirm("Tem certeza que deseja remover este membro?")) return;
     
     try {
       const { error } = await supabase.from('profiles').delete().eq('id', id);
       if (error) throw error;
       toast.success("Membro removido");
       fetchTeam();
     } catch (error) {
       toast.error("Erro ao remover membro");
     }
   };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0">
         <Topbar title="Equipe & Permissões" subtitle="Gerencie as permissões dos seus membros" toggleSidebar={() => setSidebarOpen(true)} />
         <main className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
           <div className="max-w-7xl mx-auto space-y-6">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
               <div className="relative max-w-sm w-full">
                 <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                   placeholder="Buscar membro por nome ou e-mail..." 
                   className="w-full h-11 pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-100 outline-none text-sm focus:ring-4 focus:ring-indigo-500/5 transition-all" 
                 />
               </div>
               <div className="flex items-center gap-3">
                 <button className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
                   Filtrar por cargo
                 </button>
                 <button 
                   onClick={() => setIsModalOpen(true)}
                   className="h-11 px-5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:opacity-95 transition flex items-center gap-2"
                 >
                   <Plus className="h-4 w-4" strokeWidth={3} /> Convidar Membro
                 </button>
               </div>
             </div>

           {loading ? (
             <div className="flex justify-center p-20">
               <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
             </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {team.map((member) => (
                 <div key={member.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative overflow-hidden">
                   {member.id === user?.id && (
                     <div className="absolute top-0 right-0">
                       <div className="bg-indigo-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl tracking-widest uppercase">VOCÊ</div>
                     </div>
                   )}
                  
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative">
                       <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xl grid place-items-center shadow-lg shadow-indigo-500/20">
                         {member.display_name?.charAt(0) || "U"}
                       </div>
                       <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white ${member.id === user?.id ? "bg-emerald-500" : "bg-slate-300"}`} />
                    </div>
                    <button className="h-9 w-9 grid place-items-center rounded-xl hover:bg-slate-50 text-slate-400 transition-colors">
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mb-6">
                     <h3 className="font-bold text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{member.display_name || "Membro sem nome"}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {member.role || "Membro"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <div className="h-7 w-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span className="truncate">{member.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <div className="h-7 w-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span>(11) 9****-****</span>
                    </div>
                  </div>
                  
                   <div className="grid grid-cols-2 gap-3">
                     <button className="h-10 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                       Configurar
                     </button>
                     <button 
                       onClick={() => handleRemoveMember(member.id)}
                       disabled={member.id === user?.id}
                       className="h-10 rounded-xl border border-slate-200 text-xs font-bold text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-30"
                     >
                       Remover
                     </button>
                   </div>
                 </div>
                  ))}
                </div>
              )}
            </div>

           <InviteMemberModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onInvite={handleInvite} 
          />
        </main>
      </div>
    </div>
  );
}
