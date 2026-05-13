import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

type Msg = {
  id: string;
  name: string;
  text: string;
  time: string;
  channel: string;
  unread: number;
};

const channelDot = (c: string) =>
  c.toLowerCase().includes("whats") ? "bg-success" : "bg-[oklch(0.65_0.2_330)]";

export function MessagesPanel() {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"todas" | "whats" | "insta">("todas");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // últimas mensagens inbound não lidas agrupadas por sender
      const { data } = await (supabase as any)
        .from("messages")
        .select("id, sender_name, content, channel, is_read, created_at, direction")
        .eq("organization_id", orgId)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(50);

      if (cancelled) return;
      const seen = new Set<string>();
      const list: Msg[] = [];
      for (const m of (data ?? []) as any[]) {
        const name = m.sender_name ?? "Cliente";
        if (seen.has(name)) continue;
        seen.add(name);
        list.push({
          id: m.id,
          name,
          text: m.content ?? "",
          channel: m.channel ?? "whatsapp",
          time: new Date(m.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          unread: m.is_read ? 0 : 1,
        });
        if (list.length >= 15) break;
      }
      setMsgs(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const counts = {
    todas: msgs.length,
    whats: msgs.filter((m) => m.channel.toLowerCase().includes("whats")).length,
    insta: msgs.filter((m) => m.channel.toLowerCase().includes("insta")).length,
  };

  const filtered = msgs.filter((m) => {
    if (tab === "todas") return true;
    if (tab === "whats") return m.channel.toLowerCase().includes("whats");
    return m.channel.toLowerCase().includes("insta");
  });

  const tabs = [
    { key: "todas" as const, label: "Todas", count: counts.todas },
    { key: "whats" as const, label: "WhatsApp", count: counts.whats },
    { key: "insta" as const, label: "Instagram", count: counts.insta },
  ];

  return (
    <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden flex flex-col h-full">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-[15px] font-semibold">Central de Mensagens</h3>
        <span className="text-[11px] inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Inbox Unificado
        </span>
      </div>
      <div className="px-5 flex gap-1.5 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative pb-2.5 text-[12.5px] font-medium px-2 transition ${tab === t.key ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}{" "}
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {t.count}
            </span>
            {tab === t.key && (
              <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>
      <ul className="flex-1 overflow-y-auto divide-y divide-border">
        {loading ? (
          <li className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </li>
        ) : filtered.length > 0 ? (
          filtered.map((m) => (
            <li
              key={m.id}
              onClick={() => navigate({ to: "/atendimento" })}
              className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50 cursor-pointer transition"
            >
              <div className="relative shrink-0">
                <div className="h-10 w-10 rounded-full bg-gradient-primary grid place-items-center text-white text-xs font-semibold">
                  {m.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${channelDot(m.channel)}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold truncate">{m.name}</span>
                  <span className="text-[10.5px] text-muted-foreground shrink-0">{m.time}</span>
                </div>
                <p className="text-[12px] text-muted-foreground truncate">{m.text}</p>
              </div>
              {m.unread > 0 && (
                <span className="ml-1 mt-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground grid place-items-center">
                  {m.unread}
                </span>
              )}
            </li>
          ))
        ) : (
          <li className="flex flex-col items-center justify-center py-20 px-10 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 grid place-items-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-[13px] font-medium text-muted-foreground">
              {tab === "todas"
                ? "Sua central de mensagens está limpa"
                : "Sem mensagens neste canal"}
            </p>
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
