 import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
 import { Trash2 } from "lucide-react";
 import { Plus, MoreVertical, TrendingUp, ChevronRight } from "lucide-react";
 import { DealCard } from "./DealCard";
 import { motion, AnimatePresence } from "framer-motion";
 import { cn } from "@/lib/utils";
 
 interface StageColumnProps {
   stage: any;
   deals: any[];
   onAddDeal: (stageId: string) => void;
   onRemoveDeal: (id: string) => void;
   onMoveDeal: (dealId: string, newStageId: string) => void;
   dragId: string | null;
   setDragId: (id: string | null) => void;
    onSelectDeal?: (deal: any) => void;
    onDeleteStage?: (id: string) => void;
 }
 
  export function StageColumn({ stage, deals, onAddDeal, onRemoveDeal, onMoveDeal, dragId, setDragId, onSelectDeal, onDeleteStage }: StageColumnProps) {
   const total = deals.reduce((s, d) => s + Number(d.deal_value ?? 0), 0);
   const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
 
   return (
     <div
       onDragOver={(e) => e.preventDefault()}
       onDrop={() => { if (dragId) onMoveDeal(dragId, stage.id); setDragId(null); }}
        className={cn(
          "w-[280px] sm:w-[310px] shrink-0 flex flex-col h-full rounded-2xl transition-all duration-200",
          dragId ? "bg-primary/5 border-2 border-dashed border-primary/20" : "bg-muted/30 border border-transparent hover:border-border/50"
        )}
     >
       {/* Header da Coluna */}
       <div className="p-4 flex flex-col gap-2 relative group">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2.5 min-w-0">
             <div className="h-3 w-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)] ring-2 ring-background" style={{ backgroundColor: stage.color ?? "#888" }} />
              <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-foreground/70 truncate">{stage.name || "Sem Nome"}</h3>
           </div>
           <div className="flex items-center gap-1.5 shrink-0">
             <span className="text-[10px] font-black bg-background/80 px-2 py-0.5 rounded-full border border-border/50 text-primary shadow-sm">
               {deals.length}
             </span>
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <button className="text-muted-foreground hover:text-foreground transition p-1 hover:bg-background/50 rounded-md">
                   <MoreVertical className="h-3.5 w-3.5" />
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-40">
                 <DropdownMenuItem onClick={() => onDeleteStage?.(stage.id)} className="text-destructive focus:text-destructive gap-2">
                   <Trash2 className="h-4 w-4" /> Remover Etapa
                 </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
           </div>
         </div>
         
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-1.5 text-[11px] font-black text-primary/80">
             <TrendingUp className="h-3.5 w-3.5" />
             {fmt(total)}
           </div>
           <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">
             Volume Total
           </div>
         </div>
         
         {/* Linha colorida de destaque no topo */}
         <div 
           className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl opacity-80" 
           style={{ backgroundColor: stage.color ?? "#888" }} 
         />
       </div>
 
       {/* Botão de Adição Rápida */}
       <div className="px-4 pb-3">
         <button
           onClick={() => onAddDeal(stage.id)}
           className="w-full py-2.5 rounded-xl border-2 border-dashed border-border/40 text-[10px] font-black text-muted-foreground/80 hover:bg-background hover:text-primary hover:border-primary/30 hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] group"
         >
           <Plus className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform" /> 
           ADICIONAR NEGÓCIO
         </button>
       </div>
 
        {/* Lista de Cards */}
        <div className={cn(
          "flex-1 overflow-y-auto px-4 pb-4 space-y-3.5 scrollbar-hide min-h-[200px] transition-all",
          dragId && "pb-20"
        )}>
          <AnimatePresence mode="popLayout">
            {deals.map((d) => (
              <DealCard
                key={d.id}
                deal={d}
                onRemove={onRemoveDeal}
                onDragStart={setDragId}
                onDragEnd={() => setDragId(null)}
                onClick={() => onSelectDeal?.(d)}
              />
            ))}
          </AnimatePresence>
         
         {deals.length === 0 && !dragId && (
           <div className="h-full flex flex-col items-center justify-center pt-12 opacity-20">
             <div className="h-16 w-16 rounded-3xl border-2 border-dashed border-muted-foreground mb-4 rotate-12" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-center max-w-[120px] leading-relaxed">
               Nenhum negócio nesta etapa
             </p>
           </div>
         )}
 
         {dragId && (
           <div className="py-8 border-2 border-dashed border-primary/20 rounded-2xl bg-primary/5 flex flex-col items-center justify-center gap-2 animate-pulse">
             <ChevronRight className="h-5 w-5 text-primary/40 rotate-90" />
             <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">Soltar aqui</span>
           </div>
         )}
       </div>
     </div>
   );
 }