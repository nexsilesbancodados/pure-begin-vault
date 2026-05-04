export interface KanbanLead {
  id: string;
  name: string;
  snippet: string;
  time?: string;
  date?: string;
  source?: string;
  task?: string;
}

export interface KanbanStage {
  id: string;
  title: string;
  color: string;
  count: number;
  value: string;
  leads: KanbanLead[];
}

export const kanbanStages: KanbanStage[] = [
  { id: "leads-entrada", title: "Leads de Entrada", color: "oklch(0.55 0.22 268)", count: 0, value: "R$ 0", leads: [] },
  { id: "novo-contato", title: "Novo Contato", color: "oklch(0.72 0.18 45)", count: 0, value: "R$ 0", leads: [] },
  { id: "qualificando", title: "Qualificando", color: "oklch(0.68 0.15 230)", count: 0, value: "R$ 0", leads: [] },
  { id: "proposta-enviada", title: "Proposta Enviada", color: "oklch(0.65 0.2 330)", count: 0, value: "R$ 0", leads: [] },
];
