 import { messages } from "@/lib/mock";
  import { ArrowRight, Filter, MoreHorizontal, MessageSquare } from "lucide-react";
 import { useState } from "react";
 import { useNavigate } from "@tanstack/react-router";

const channelDot = (c: string) => c === "whatsapp" ? "bg-success" : "bg-[oklch(0.65_0.2_330)]";
const tabs = [
  { key: "todas", label: "Todas", count: 24 },
  { key: "wa", label: "WhatsApp", count: 14 },
  { key: "ig", label: "Instagram", count: 10 },
];

 export function MessagesPanel() {
   const [tab, setTab] = useState("todas");
   const navigate = useNavigate();
 
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold">Central de Mensagens</h3>
          <span className="text-[11px] inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Inbox Unificado
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"><Filter className="h-4 w-4" /></button>
          <button className="h-8 w-8 grid place-items-center rounded-md hover:bg-muted text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="px-5 flex gap-1.5 border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative pb-2.5 text-[12.5px] font-medium px-2 transition ${tab === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label} <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{t.count}</span>
            {tab === t.key && <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />}
          </button>
        ))}
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-border">
        {messages.length > 0 ? messages.map((m) => (
          <li key={m.name} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50 cursor-pointer transition">
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-full bg-gradient-primary grid place-items-center text-white text-xs font-semibold">
                {m.name.split(" ").map(s => s[0]).slice(0,2).join("")}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${channelDot(m.channel)}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold truncate">{m.name}</span>
                <span className="text-[10.5px] text-muted-foreground shrink-0">{m.time}</span>
              </div>
              <p className="text-[12px] text-muted-foreground truncate">{m.text}</p>
            </div>
            {m.unread > 0 && (
              <span className="ml-1 mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground grid place-items-center">{m.unread}</span>
            )}
          </li>
        )) : (
          <li className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 grid place-items-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-[13px] font-medium text-muted-foreground">Sua central de mensagens está limpa</p>
          </li>
        )}
      </ul>
       <div className="p-3 border-t border-border">
         <button 
           onClick={() => navigate({ to: "/atendimento" })}
           className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-muted rounded-lg py-2 transition"
         >
           Ver todas as conversas <ArrowRight className="h-3.5 w-3.5" />
         </button>
       </div>
    </div>
  );
}
