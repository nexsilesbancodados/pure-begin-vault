import React, { useState } from "react";
import { X, Shield, Mail, User, Check, AlertCircle } from "lucide-react";
 import { UserPermissions, Role } from "@/contexts/AuthContext";
import { DEFAULT_EMPLOYEE_PERMISSIONS } from "@/types/permissions";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (member: any) => void;
}

export function InviteMemberModal({ isOpen, onClose, onInvite }: InviteMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
   const [role, setRole] = useState<Role>("employee");
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_EMPLOYEE_PERMISSIONS);

  if (!isOpen) return null;

   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     const roleLabels: Record<string, string> = {
       owner: "Proprietário",
       admin: "Administrador",
       financeiro: "Financeiro",
       vendedor: "Vendedor",
       employee: "Funcionário",
     };
     onInvite({
       name,
       email,
       role: roleLabels[role] || "Membro",
       permissions,
       status: "offline",
       avatar: name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)
     });
     onClose();
   };

  const togglePermission = (key: keyof UserPermissions) => {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const permissionLabels: Record<keyof UserPermissions, string> = {
    dashboard: "Dashboard",
    vendas: "Módulo Vendas",
    clientes: "Módulo Clientes",
    pdv: "Caixa / PDV",
    orcamentos: "Orçamentos",
    estoque: "Compras / Estoque",
    servicos: "Ordem de Serviço",
    financeiro: "Financeiro",
    fiscal: "Gestão Fiscal",
    relatorios: "Relatórios",
    crm: "CRM / Pipeline",
    configuracoes: "Configurações",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
          <div>
            <h2 className="text-xl font-bold">Convidar Novo Membro</h2>
            <p className="text-sm text-muted-foreground mt-1">Envie um convite e defina o que ele pode acessar</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-muted/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold ml-1">E-mail Corporativo</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="joao@empresa.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-muted/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-bold ml-1">Nível de Acesso</label>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
               {[
                 { id: "employee", label: "Funcionário", icon: User },
                 { id: "vendedor", label: "Vendedor", icon: User },
                 { id: "financeiro", label: "Financeiro", icon: Shield },
                 { id: "admin", label: "Administrador", icon: Shield },
               ].map((r) => (
                 <button
                   key={r.id}
                   type="button"
                   onClick={() => setRole(r.id as Role)}
                   className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all ${role === r.id ? "border-primary bg-primary/5" : "border-border hover:border-border/80"}`}
                 >
                   <r.icon className={`h-4 w-4 mb-1 ${role === r.id ? "text-primary" : "text-muted-foreground"}`} />
                   <span className="font-bold text-[10px] text-center">{r.label}</span>
                 </button>
               ))}
             </div>
          </div>

          {role === "employee" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-sm font-bold">Permissões Específicas</label>
                <span className="text-[10px] uppercase font-bold text-primary tracking-widest bg-primary/10 px-2 py-0.5 rounded">Customizável</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.keys(permissionLabels).map((key) => {
                  const k = key as keyof UserPermissions;
                  const active = permissions[k];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => togglePermission(k)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${active ? "bg-primary text-white border-primary shadow-glow-sm" : "bg-muted/30 border-border text-muted-foreground hover:border-primary/50"}`}
                    >
                      <div className={`h-4 w-4 rounded flex items-center justify-center ${active ? "bg-white/20" : "bg-muted"}`}>
                        {active && <Check className="h-2.5 w-2.5" strokeWidth={4} />}
                      </div>
                      {permissionLabels[k]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {role === "admin" && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-600">Atenção com Administradores</h4>
                <p className="text-[11px] text-amber-600/80 leading-relaxed mt-0.5">
                  Administradores podem gerenciar outros membros, visualizar relatórios financeiros e alterar configurações críticas do CRM.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-border font-bold text-sm hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] h-11 rounded-xl bg-gradient-primary text-white font-bold text-sm shadow-glow hover:opacity-95 transition-all"
            >
              Enviar Convite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
