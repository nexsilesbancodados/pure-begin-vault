import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  MessageSquare,
  Instagram,
  Mail,
  Phone,
  Loader2,
  Send,
  Sparkles,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox unificada — ConectaCRM" },
      { name: "description", content: "WhatsApp, Instagram e email em um só lugar" },
    ],
  }),
  component: InboxPage,
});

type Channel = "whatsapp" | "instagram" | "email";
type Thread = {
  key: string;
  channel: Channel;
  contactName: string;
  contactKey: string; // phone or email
  leadId?: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  count: number;
};

function detectChannel(source: string | null, phone: string | null, email: string | null): Channel {
  const s = (source ?? "").toLowerCase();
  if (s.includes("instagram") || s.includes("ig")) return "instagram";
  if (s.includes("email") || (email && !phone)) return "email";
  return "whatsapp";
}

const channelMeta: Record<Channel, { icon: any; label: string; cls: string }> = {
  whatsapp: {
    icon: MessageSquare,
    label: "WhatsApp",
    cls: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  instagram: {
    icon: Instagram,
    label: "Instagram",
    cls: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  },
  email: { icon: Mail, label: "Email", cls: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

function InboxPage() {
  const { user, profile } = useAuth();
  const { orgId } = useOrg();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [filter, setFilter] = useState<Channel | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [qualifying, setQualifying] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Pega todos os leads da organização
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, phone, email, source")
        .eq("organization_id", profile?.organization_id ?? "")
        .order("updated_at", { ascending: false });

      // Pega últimas mensagens por lead
      const baseMsg = supabase
        .from("messages")
        .select("id, lead_id, content, direction, created_at, phone");
      const { data: msgs } = await (
        orgId ? baseMsg.eq("organization_id", orgId) : baseMsg.eq("user_id", user.id)
      )
        .order("created_at", { ascending: false })
        .limit(500);

      const byLead = new Map<string, any[]>();
      (msgs ?? []).forEach((m: any) => {
        const k = m.lead_id ?? `phone:${m.phone}`;
        if (!byLead.has(k)) byLead.set(k, []);
        byLead.get(k)!.push(m);
      });

      const list: Thread[] = [];
      (leads ?? []).forEach((l: any) => {
        const ms = byLead.get(l.id) ?? [];
        if (ms.length === 0) return;
        const channel = detectChannel(l.source, l.phone, l.email);
        list.push({
          key: l.id,
          channel,
          contactName: l.name || l.phone || l.email || "Sem nome",
          contactKey: l.phone || l.email || "",
          leadId: l.id,
          lastMessage: ms[0].content ?? "",
          lastAt: ms[0].created_at,
          unread: ms.filter((x: any) => x.direction === "inbound").length,
          count: ms.length,
        });
      });

      list.sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));
      setThreads(list);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id, profile?.organization_id]);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", selected)
        .order("created_at", { ascending: true });
      setMessages(data ?? []);
    })();
  }, [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter !== "all" && t.channel !== filter) return false;
      if (!q) return true;
      return t.contactName.toLowerCase().includes(q) || t.contactKey.toLowerCase().includes(q);
    });
  }, [threads, filter, search]);

  const current = threads.find((t) => t.key === selected) ?? null;

  const send = async () => {
    if (!current || !reply.trim() || !user?.id) return;
    setSending(true);
    try {
      if (current.channel === "whatsapp" && current.contactKey) {
        await supabase.functions.invoke("send-whatsapp", {
          body: { phone: current.contactKey, text: reply.trim(), contactName: current.contactName },
        });
      } else {
        await supabase.from("messages").insert({
          user_id: user.id,
          organization_id: orgId,
          lead_id: current.leadId,
          content: reply.trim(),
          direction: "outbound",
          phone: current.contactKey || null,
        });
      }
      setReply("");
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("lead_id", current.leadId!)
        .order("created_at");
      setMessages(data ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const qualify = async () => {
    if (!current?.leadId || !user?.id) return;
    setQualifying(true);
    try {
      const last = messages.filter((m) => m.direction === "inbound").slice(-1)[0]?.content;
      const { data, error } = await supabase.functions.invoke("pipeline-qualifier", {
        body: { user_id: user.id, lead_id: current.leadId, message: last ?? "" },
      });
      if (error) throw error;
      if ((data as any)?.moved_to) toast.success(`IA classificou como: ${(data as any).moved_to}`);
      else toast.info("IA analisou mas não mudou o estágio");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setQualifying(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Inbox unificada" subtitle="WhatsApp, Instagram e email em um só lugar" />
        <main className="flex-1 flex overflow-hidden">
          {/* Lista */}
          <aside className="w-[360px] border-r border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "whatsapp", "instagram", "email"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    {f === "all" ? "Todos" : channelMeta[f as Channel].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="h-full grid place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">
                  Nenhuma conversa
                </div>
              ) : (
                filtered.map((t) => {
                  const Icon = channelMeta[t.channel].icon;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setSelected(t.key)}
                      className={`w-full text-left p-3 border-b border-border/50 hover:bg-muted/30 transition ${selected === t.key ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${channelMeta[t.channel].cls} flex items-center gap-1`}
                        >
                          <Icon className="h-2.5 w-2.5" /> {channelMeta[t.channel].label}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(t.lastAt), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <div className="font-bold text-sm truncate">{t.contactName}</div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {t.lastMessage}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Conversa */}
          <section className="flex-1 flex flex-col bg-muted/10">
            {!current ? (
              <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
                Selecione uma conversa
              </div>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
                  <div>
                    <div className="font-bold">{current.contactName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> {current.contactKey} ·{" "}
                      {channelMeta[current.channel].label}
                    </div>
                  </div>
                  <Button
                    onClick={qualify}
                    disabled={qualifying}
                    variant="outline"
                    className="gap-2"
                  >
                    {qualifying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-primary" />
                    )}
                    Qualificar com IA
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${m.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}
                      >
                        {m.content}
                        <div className="text-[10px] opacity-70 mt-1">
                          {formatDistanceToNow(new Date(m.created_at), {
                            locale: ptBR,
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-border bg-card flex gap-2">
                  <Input
                    placeholder="Digite uma resposta..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                  />
                  <Button onClick={send} disabled={sending || !reply.trim()} className="gap-2">
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}{" "}
                    Enviar
                  </Button>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
