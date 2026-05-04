import { kanbanStages as initialStages, KanbanStage, KanbanLead } from "@/lib/kanban-mock";
import { Plus, Search, Filter, MoreHorizontal, Settings2, Sparkles, MessageSquare, Instagram, Clock, Phone, GripVertical } from "lucide-react";
import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface LeadCardProps {
  lead: KanbanLead;
  isOverlay?: boolean;
}

function LeadCard({ lead, isOverlay }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: lead.id,
    data: {
      type: "Lead",
      lead,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  const sourceIcon = (source?: string) => {
    if (source === "WhatsApp") return <MessageSquare className="h-3 w-3 text-success" />;
    if (source === "Instagram") return <Instagram className="h-3 w-3 text-pink-500" />;
    return <MessageSquare className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border border-border rounded-xl p-3.5 shadow-card hover:shadow-elegant hover:border-primary/30 transition cursor-grab group/card relative active:cursor-grabbing",
        isDragging && "opacity-30",
        isOverlay && "shadow-2xl border-primary/50 cursor-grabbing rotate-2 scale-105"
      )}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div className="text-[13px] font-bold text-foreground truncate max-w-[85%] group-hover/card:text-primary transition">
          {lead.name}
        </div>
        {sourceIcon(lead.source)}
      </div>
      <p className="text-[11.5px] text-muted-foreground line-clamp-2 leading-tight mb-3">
        {lead.snippet}
      </p>
      
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/60">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[9px] font-bold text-muted-foreground uppercase">
            {lead.name.slice(0, 2)}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {lead.time || lead.date}
          </div>
        </div>
        {lead.task === "Sem Tarefas" ? (
          <span className="text-[9px] font-bold uppercase tracking-wide text-destructive/80 bg-destructive/5 px-1.5 py-0.5 rounded">Sem Tarefas</span>
        ) : (
          <Clock className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const [stages, setStages] = useState<KanbanStage[]>(initialStages);

  const [activeLead, setActiveLead] = useState<KanbanLead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const totalLeads = useMemo(() => stages.reduce((acc, stage) => acc + stage.leads.length, 0), [stages]);

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Lead") {
      setActiveLead(event.active.data.current.lead);
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveALead = active.data.current?.type === "Lead";
    const isOverALead = over.data.current?.type === "Lead";

    if (!isActiveALead) return;

    if (isActiveALead && isOverALead) {
      setStages((prev) => {
        const activeStage = prev.find((s) => s.leads.some((l) => l.id === activeId));
        const overStage = prev.find((s) => s.leads.some((l) => l.id === overId));

        if (!activeStage || !overStage) return prev;

        if (activeStage.id !== overStage.id) {
          const activeIndex = activeStage.leads.findIndex((l) => l.id === activeId);
          const overIndex = overStage.leads.findIndex((l) => l.id === overId);

          const newStages = [...prev];
          const activeStageIdx = newStages.findIndex(s => s.id === activeStage.id);
          const overStageIdx = newStages.findIndex(s => s.id === overStage.id);

          const [movedLead] = newStages[activeStageIdx].leads.splice(activeIndex, 1);
          newStages[overStageIdx].leads.splice(overIndex, 0, movedLead);
          
          newStages[activeStageIdx].count = newStages[activeStageIdx].leads.length;
          newStages[overStageIdx].count = newStages[overStageIdx].leads.length;

          return newStages;
        }

        return prev;
      });
    }

    const isOverAStage = over.data.current?.type === "Stage";
    if (isActiveALead && isOverAStage) {
      setStages((prev) => {
        const activeStage = prev.find((s) => s.leads.some((l) => l.id === activeId));
        const overStageId = overId as string;

        if (!activeStage || activeStage.id === overStageId) return prev;

        const activeIndex = activeStage.leads.findIndex((l) => l.id === activeId);
        const newStages = [...prev];
        const activeStageIdx = newStages.findIndex(s => s.id === activeStage.id);
        const overStageIdx = newStages.findIndex(s => s.id === overStageId);

        const [movedLead] = newStages[activeStageIdx].leads.splice(activeIndex, 1);
        newStages[overStageIdx].leads.push(movedLead);

        newStages[activeStageIdx].count = newStages[activeStageIdx].leads.length;
        newStages[overStageIdx].count = newStages[overStageIdx].leads.length;

        return newStages;
      });
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) {
      setActiveLead(null);
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) {
      setActiveLead(null);
      return;
    }

    const isActiveALead = active.data.current?.type === "Lead";
    const isOverALead = over.data.current?.type === "Lead";

    if (isActiveALead && isOverALead) {
      setStages((prev) => {
        const activeStage = prev.find((s) => s.leads.some((l) => l.id === activeId));
        const overStage = prev.find((s) => s.leads.some((l) => l.id === overId));

        if (!activeStage || !overStage || activeStage.id !== overStage.id) return prev;

        const activeIndex = activeStage.leads.findIndex((l) => l.id === activeId);
        const overIndex = overStage.leads.findIndex((l) => l.id === overId);

        const newStages = [...prev];
        const stageIdx = newStages.findIndex(s => s.id === activeStage.id);
        newStages[stageIdx].leads = arrayMove(newStages[stageIdx].leads, activeIndex, overIndex);

        return newStages;
      });
    }

    setActiveLead(null);
  }

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Kanban Header */}
      <div className="h-14 shrink-0 flex items-center justify-between px-6 bg-card border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground uppercase tracking-wider">Venda Direta</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
            <span className="text-sm font-medium text-primary">Leads ativos</span>
          </div>
          <div className="h-8 w-[1px] bg-border mx-2" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition">
            <Search className="h-3.5 w-3.5" />
            <span>Busca e filtro</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] text-muted-foreground text-right mr-2">
            <div className="font-semibold text-foreground">{totalLeads} leads</div>
            <div>R$ 0</div>
          </div>
          <button className="h-9 px-4 rounded-xl border border-border bg-card text-[12px] font-semibold text-primary uppercase tracking-wide hover:bg-muted transition">
            Automatize
          </button>
          <button className="h-9 px-4 rounded-xl bg-gradient-primary text-white text-[12px] font-bold uppercase tracking-wide shadow-elegant hover:opacity-95 transition flex items-center gap-2">
            <Plus className="h-4 w-4" strokeWidth={3} /> Novo Lead
          </button>
        </div>
      </div>

      {/* Kanban Stats Bar */}
      <div className="flex items-center gap-6 px-6 py-2.5 bg-muted/40 border-b border-border overflow-x-auto text-[11px] no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-muted-foreground">Com tarefas para hoje:</span>
          <span className="font-bold">0</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-muted-foreground">Sem tarefas atribuídas:</span>
          <span className="font-bold text-slate-400">0</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-muted-foreground">Com tarefas atrasadas:</span>
          <span className="font-bold">0</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-muted-foreground">Novo hoje / ontem:</span>
          <span className="font-bold text-primary">0 / 0</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span className="text-muted-foreground italic">Vendas em potencial: Sem dados</span>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 flex gap-5 no-scrollbar">
          {stages.map((stage) => (
            <div key={stage.id} className="w-[300px] shrink-0 flex flex-col h-full group">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="text-[13px] font-bold uppercase tracking-wider truncate flex-1">{stage.title}</h3>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-pointer" />
                </div>
                <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
                  <span>{stage.count} leads</span>
                  <span className="font-semibold text-foreground/80">{stage.value}</span>
                </div>
                <div className="h-0.5 w-full bg-muted mt-2 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: stage.color }} />
                </div>
              </div>

              <SortableContext items={stage.leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <div 
                  className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar min-h-[100px]"
                  id={stage.id}
                  {...({ "data-type": "Stage" } as any)}
                >
                  {stage.id !== "leads-entrada" && (
                    <button className="w-full py-2.5 rounded-xl border border-dashed border-border text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-primary transition flex items-center justify-center gap-1.5 bg-card/30">
                      <Plus className="h-3.5 w-3.5" /> Adição rápida
                    </button>
                  )}
                  
                  {stage.leads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.5',
              },
            },
          }),
        }}>
          {activeLead ? (
            <LeadCard lead={activeLead} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
