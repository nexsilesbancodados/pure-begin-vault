 import { formatDistanceToNow } from "date-fns";
 import { ptBR } from "date-fns/locale";
   import { Trash2, Phone, Calendar, DollarSign, GripVertical, Instagram, MessageCircle, MessageSquare, Clock, AlertCircle, ExternalLink, User, Tag, FileText } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { motion } from "framer-motion";
 
 interface DealCardProps {
   deal: any;
   onRemove: (id: string) => void;
   onDragStart: (id: string) => void;
   onDragEnd: () => void;
   onClick?: () => void;
 }
 
 export function DealCard({ deal, onRemove, onDragStart, onDragEnd, onClick }: DealCardProps) {
   const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
   
    // Check if the deal is "stale" (no message in 24h)
    const isStale = deal.last_message_at && (new Date().getTime() - new Date(deal.last_message_at).getTime() > 24 * 60 * 60 * 1000);
    const isNewFromUser = deal.last_message_role === 'user';
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -2 }}
        draggable
        onDragStart={() => onDragStart(deal.id)}
        onDragEnd={onDragEnd}
        onClick={onClick}
         className={cn(
           "bg-card border border-border/60 rounded-2xl p-4 shadow-sm hover:shadow-xl hover:border-primary/50 hover:bg-accent/5 transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden active:scale-[0.99] flex flex-col gap-3",
           isStale && "border-l-4 border-l-amber-500",
           isNewFromUser && "ring-2 ring-green-500/30 bg-green-500/[0.03]"
         )}
       >
        {/* Background decorative element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-primary/10 transition-colors" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Lead Avatar */}
            <div className="relative shrink-0">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-300">
                {deal.lead?.avatar_url ? (
                  <img src={deal.lead.avatar_url} alt={deal.lead.name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-6 w-6 text-primary/40" />
                )}
              </div>
              {deal.lead?.source === 'whatsapp' && (
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-green-500 border-2 border-background flex items-center justify-center shadow-sm">
                  <MessageCircle className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>

           <div className="flex flex-col min-w-0 flex-1">
             <div className="text-[15px] font-black truncate text-foreground group-hover:text-primary transition-colors duration-300">
               {deal.lead?.name ?? "Lead sem nome"}
             </div>
             <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
               {deal.lead?.phone && (
                 <span className="text-[10px] text-muted-foreground/80 font-bold bg-muted/50 px-1.5 py-0.5 rounded-md">
                   {deal.lead.phone}
                 </span>
               )}
               {deal.tags && deal.tags.length > 0 && (
                 <div className="flex flex-wrap gap-1">
                   {deal.tags.map((tag: string, i: number) => (
                     <span key={i} className="text-[9px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex items-center gap-1">
                       <Tag className="h-2 w-2" />
                       {tag}
                     </span>
                   ))}
                 </div>
               )}
             </div>
           </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(deal.id); }} 
              className="opacity-0 group-hover:opacity-100 h-8 w-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
 
        {/* Message Preview */}
        <div 
          className={cn(
            "relative px-4 py-3 rounded-2xl border transition-all cursor-pointer group/msg",
            isNewFromUser 
              ? "bg-green-500/[0.08] border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]" 
              : "bg-muted/30 border-border/40 hover:bg-muted/50"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-6 w-6 rounded-lg flex items-center justify-center shadow-sm",
                isNewFromUser ? "bg-green-500 text-white" : "bg-primary/10 text-primary"
              )}>
                <MessageSquare className="h-3 w-3" />
              </div>
              <span className={cn("text-[10px] font-black uppercase tracking-widest", isNewFromUser ? "text-green-600" : "text-muted-foreground/70")}>
                {isNewFromUser ? "Nova Mensagem" : "Conversa"}
              </span>
            </div>
            {deal.last_message_at && (
              <span className="text-[10px] text-muted-foreground/60 font-bold flex items-center gap-1 bg-background/50 px-1.5 py-0.5 rounded-md">
                <Clock className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(deal.last_message_at), { addSuffix: true, locale: ptBR })}
              </span>
            )}
          </div>

          <p className={cn(
            "text-[12px] leading-relaxed min-h-[1.5em]",
            isNewFromUser ? "text-foreground font-extrabold line-clamp-3" : "text-foreground/70 line-clamp-2"
          )}>
            {deal.last_message || "Inicie uma conversa..."}
          </p>

          {isNewFromUser && (
            <div className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 border-2 border-background"></span>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/40 relative z-10">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-tighter">Valor estimado</span>
            <div className="flex items-center gap-1 text-[15px] font-black text-primary tracking-tight">
              <DollarSign className="h-3.5 w-3.5" />
              <span>{fmt(Number(deal.deal_value ?? 0))}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {deal.notes && (
                <div className="h-5 w-5 rounded-md bg-amber-100 flex items-center justify-center text-amber-600" title="Possui notas">
                  <FileText className="h-3 w-3" />
                </div>
              )}
              {deal.priority === 'high' ? (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-[9px] font-black uppercase tracking-wider border border-destructive/20 animate-pulse">
                  <AlertCircle className="h-3 w-3" />
                  URGENTE
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground/70 text-[9px] font-black uppercase tracking-widest border border-border/50">
                  {deal.lead?.source || 'Lead'}
                </div>
              )}
            </div>
            
            {isNewFromUser && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
                Responder
                <ExternalLink className="h-2.5 w-2.5" />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }