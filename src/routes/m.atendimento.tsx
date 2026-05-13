import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/lib/useOrg";
import { MessageSquare, Send, ArrowLeft, ChevronRight, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/m/atendimento")({
  head: () => ({
    meta: [
      { title: "Atendimento Mobile — ConectaCRM" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
    ],
  }),
  component: MobileAtendimento,
});

type Conv = {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  last_message_text: string | null;
  last_message_at: string | null;
  status: string | null;
  unread_count: number | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

function MobileAtendimento() {
  const { user } = useAuth();
  const { orgId } = useOrg();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [selected, setSelected] = useState<Conv | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadConvs = async () => {
    if (!user?.id || !orgId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bot_conversations")
      .select(
        "id, contact_name, contact_phone, last_message_text, last_message_at, status, unread_count",
      )
      .eq("organization_id", orgId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    setConvs((data as Conv[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadConvs();
  }, [user?.id, orgId]);

  const loadMessages = async (conv: Conv) => {
    setSelected(conv);
    const { data } = await supabase
      .from("messages")
      .select("id, conversation_id, role, content, created_at")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data as Msg[]) ?? []);
  };

  const send = async () => {
    if (!selected || !draft.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { to: selected.contact_phone, text: draft.trim() },
      });
      if (error) throw error;
      setDraft("");
      setTimeout(() => loadMessages(selected), 1500);
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message ?? "erro"));
    } finally {
      setSending(false);
    }
  };

  if (selected) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 bg-card border-b border-border p-3 flex items-center gap-3 z-10">
          <button onClick={() => setSelected(null)} className="p-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center font-black text-sm">
            {(selected.contact_name ?? selected.contact_phone).slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">
              {selected.contact_name ?? selected.contact_phone}
            </p>
            <p className="text-[10px] text-muted-foreground">{selected.contact_phone}</p>
          </div>
          <button onClick={() => loadMessages(selected)} className="p-1">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">Sem mensagens.</p>
          ) : (
            messages.map((m) => {
              const isUser = m.role === "user" || m.role === "client";
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    isUser
                      ? "bg-muted self-start mr-auto"
                      : "bg-primary text-primary-foreground self-end ml-auto"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p className="text-[9px] opacity-60 mt-0.5">
                    {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-2 flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Mensagem..."
            rows={1}
            className="flex-1 px-3 py-2 rounded-2xl border border-border bg-background text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={!draft.trim() || sending}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-card border-b border-border p-3 z-10">
        <div className="flex items-center justify-between">
          <h1 className="font-black text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Atendimento
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={loadConvs} className="p-2">
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link to="/painel" className="text-xs font-bold text-primary">
              Desktop
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-xs text-muted-foreground py-8">Carregando...</p>
      ) : convs.length === 0 ? (
        <div className="p-8 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-bold">Sem conversas ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Conecte uma instância WhatsApp em /whatsapp.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {convs.map((c) => (
            <button
              key={c.id}
              onClick={() => loadMessages(c)}
              className="w-full p-3 flex items-center gap-3 hover:bg-muted/40 transition text-left"
            >
              <div className="h-11 w-11 rounded-full bg-primary/15 text-primary grid place-items-center font-black text-sm shrink-0">
                {(c.contact_name ?? c.contact_phone).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-sm truncate">{c.contact_name ?? c.contact_phone}</p>
                  {c.last_message_at && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(c.last_message_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.last_message_text ?? "—"}
                </p>
              </div>
              {(c.unread_count ?? 0) > 0 && (
                <span className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black grid place-items-center shrink-0">
                  {c.unread_count}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
