 import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  MessageSquare,
  Search,
  Send,
  Loader2,
  User,
  Bot,
  UserCog,
  PauseCircle,
  PlayCircle,
   RefreshCw,
   Image as ImageIcon,
   X,
   Crop,
   Smile,
   Type,
   Pencil,
   Download,
    Plus,
    ArrowLeft,
} from "lucide-react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { evolution } from "@/lib/evolution";

type Msg = { role: "user" | "assistant" | "agent"; content: string; at?: string; sent?: boolean };
type Conversation = {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  status: string;
  messages_count: number;
  last_message_at: string;
  transcript: Msg[];
};

type EvolutionChat = {
  id?: string;
  remoteJid?: string;
  name?: string;
  pushName?: string;
  profileName?: string;
  unreadCount?: number;
  lastMessageTime?: number | string;
  conversationTimestamp?: number | string;
  messages?: unknown[];
};

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = [obj.data, obj.chats, obj.messages, obj.result].find(Array.isArray);
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};

const getMessageText = (message: any) => {
  const msg = message?.message || message;
  return (
    msg?.conversation ||
    msg?.extendedTextMessage?.text ||
    msg?.imageMessage?.caption ||
    msg?.videoMessage?.caption ||
    msg?.text ||
    msg?.body ||
    (msg?.imageMessage ? "🖼️ Imagem" : 
     msg?.videoMessage ? "🎥 Vídeo" : 
     msg?.audioMessage ? "🎤 Áudio" : 
     msg?.stickerMessage ? "🟦 Figurinha" : 
     msg?.documentMessage ? "📄 Documento" : "")
  );
};

const normalizeTimestamp = (value: unknown) => {
  if (typeof value === "number") {
    return new Date(value > 1e12 ? value : value * 1000).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) {
      return new Date(asNumber > 1e12 ? asNumber : asNumber * 1000).toISOString();
    }
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) return asDate.toISOString();
  }
  return new Date().toISOString();
};

const normalizeTranscript = (messages: any[]): Msg[] =>
  messages
    .map((message) => {
      const content = String(getMessageText(message) ?? "").trim();
      if (!content) return null;
      const fromMe = !!(message?.key?.fromMe ?? message?.fromMe);
      return {
        role: fromMe ? (message?.status === "ERROR" ? "agent" : "assistant") : "user",
        content,
        at: normalizeTimestamp(message?.messageTimestamp ?? message?.timestamp ?? message?.createdAt),
        sent: fromMe ? message?.status !== "ERROR" : undefined,
      } satisfies Msg;
    })
    .filter(Boolean) as Msg[];

export function UnifiedChat() {
  const { user } = useAuth();
  const [activeInstance, setActiveInstance] = useState<string | null>(null);
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "handed_off">("all");
  const [syncing, setSyncing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bot_conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const list = (data ?? []) as any as Conversation[];
      setItems(list);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
    } catch {
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const syncFromWhatsApp = useCallback(async (showToast = false, forcedInstance?: string) => {
    if (!user?.id || syncing) return;

    const instanceToUse = forcedInstance || activeInstance;
    if (!instanceToUse && !forcedInstance) {
      const { data: settings } = await supabase
        .from("bot_settings")
        .select("whatsapp_instance")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (settings?.whatsapp_instance) {
        setActiveInstance(settings.whatsapp_instance);
      } else {
        if (showToast) toast.error("Selecione a instância do WhatsApp em CRM > Bot.");
        return;
      }
    }

    setSyncing(true);
    try {
      const { data: existing, error: existingError } = await supabase
        .from("bot_conversations")
        .select("*")
        .eq("user_id", user.id);

      if (existingError) throw existingError;

      const rawChats = await evolution.findChats(instanceToUse || forcedInstance!);
      const chats = asArray<EvolutionChat>(rawChats)
        .filter((chat) => !!chat?.remoteJid && !String(chat.remoteJid).endsWith("@g.us"));

      if (chats.length === 0) {
        if (showToast) toast.info("Nenhuma conversa encontrada na instância.");
        return;
      }

      const existingByPhone = new Map(
        ((existing ?? []) as any as Conversation[]).map((conversation) => [conversation.contact_phone, conversation])
      );

      const rows = await Promise.all(
        chats.slice(0, 50).map(async (chat) => {
          const phone = String(chat.remoteJid).split("@")[0];
          const remoteJid = chat.remoteJid!;
          const existingConversation = existingByPhone.get(phone);
          const rawMessages = await evolution.findMessages(instanceToUse || forcedInstance!, remoteJid);
          const transcript = normalizeTranscript(asArray<any>(rawMessages));
          const lastAt = transcript[transcript.length - 1]?.at
            ?? normalizeTimestamp(chat.lastMessageTime ?? chat.conversationTimestamp);

          return {
            id: existingConversation?.id,
            user_id: user.id,
            contact_phone: phone,
            contact_name: chat.name ?? chat.pushName ?? chat.profileName ?? existingConversation?.contact_name ?? null,
            transcript,
            status: existingConversation?.status ?? "active",
            messages_count: transcript.length,
            last_message_at: lastAt,
          };
        })
      );

      const validRows = rows.filter((row) => row.transcript.length > 0);
      if (validRows.length > 0) {
        const { error: upsertError } = await supabase
          .from("bot_conversations")
          .upsert(validRows, { onConflict: "user_id,contact_phone" });

        if (upsertError) throw upsertError;
      }

      await load();
      if (showToast) toast.success("Conversas sincronizadas com o WhatsApp.");
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível sincronizar as conversas do WhatsApp.");
    } finally {
      setSyncing(false);
    }
  }, [user?.id, activeInstance, load, syncing]);

  useEffect(() => {
    if (!user?.id) return;
    load();
    
    // Auto-sync on mount
    syncFromWhatsApp(false);

    const channel = supabase
      .channel("uc:bot_conversations:" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_conversations", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((c) => c.id !== (payload.old as any).id);
            }
            const row = payload.new as any as Conversation;
            const next = [row, ...prev.filter((c) => c.id !== row.id)];
            next.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  // Monitor instance changes
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = supabase
      .channel("uc:bot_settings:" + user.id)
      .on(
        "postgres_changes",
        { 
          event: "UPDATE", 
          schema: "public", 
          table: "bot_settings", 
          filter: `user_id=eq.${user.id}` 
        },
        (payload) => {
          const newInstance = (payload.new as any).whatsapp_instance;
          if (newInstance && newInstance !== activeInstance) {
            setActiveInstance(newInstance);
            syncFromWhatsApp(false, newInstance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeInstance, syncFromWhatsApp]);

  const filtered = useMemo(
    () =>
      items.filter((c) => {
        if (filter !== "all" && c.status !== filter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (c.contact_name ?? "").toLowerCase().includes(q) ||
          c.contact_phone.includes(search)
        );
      }),
    [items, search, filter]
  );

  const selected = useMemo(
    () => items.find((c) => c.id === selectedId) ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [selected?.transcript?.length, selectedId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else if (file) {
      toast.error("Por favor, selecione um arquivo de imagem.");
    }
  };

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
  };

  const send = async () => {
    if (!selected || sending) return;
    if (!text.trim() && !selectedImage) return;
    
    setSending(true);
    try {
      let body: any = {
        phone: selected.contact_phone,
        text: text.trim(),
        contactName: selected.contact_name,
      };

      if (selectedImage) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
        });
        reader.readAsDataURL(selectedImage);
        const base64 = await base64Promise;

        body = {
          ...body,
          kind: "image",
          media: base64,
          mimetype: selectedImage.type,
          fileName: selectedImage.name,
        };
      }

      const { data, error } = await supabase.functions.invoke("send-whatsapp", { body });
      
      if (error) throw error;
      if (data?.error) {
        toast.error("Mensagem registrada, mas Evolution falhou: " + data.error);
      } else if (!data?.ok) {
        toast.warning("Mensagem registrada, mas envio pode ter falhado.");
      } else {
        toast.success("Enviada!");
      }
      setText("");
      clearImage();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const toggleHandoff = async () => {
    if (!selected) return;
    const newStatus = selected.status === "handed_off" ? "active" : "handed_off";
    const { error } = await supabase
      .from("bot_conversations")
      .update({ status: newStatus })
      .eq("id", selected.id);
    if (error) toast.error(error.message);
    else toast.success(newStatus === "handed_off" ? "Bot pausado nesta conversa" : "Bot reativado");
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div className="hidden lg:block w-64 shrink-0 border-r border-border bg-card">
        <AppSidebar />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-[#f0f2f5]/30">
        <div className="lg:hidden h-[68px]">
          <Topbar title="Atendimento" />
        </div>
        
        <div className="hidden lg:flex h-[68px] items-center px-6 border-b border-border bg-card justify-between">
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight">Atendimento</h1>
            <p className="text-xs text-muted-foreground">Gerencie suas conversas do WhatsApp</p>
          </div>
          <div className="flex items-center gap-3">
            {activeInstance && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 text-success text-[10px] font-bold border border-success/20">
                <div className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                INSTÂNCIA: {activeInstance.toUpperCase()}
              </div>
            )}
            <button
              onClick={() => syncFromWhatsApp(true)}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:opacity-90 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-full sm:w-[360px] border-r border-border flex flex-col bg-card">
            <div className="p-4 border-b border-border space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Buscar por nome ou número..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl bg-muted/40 border border-transparent focus:border-primary/20 text-sm outline-none transition"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "active", "handed_off"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {f === "all" ? "Todas" : f === "active" ? "Bot ativo" : "Manual"}
                  </button>
                ))}
              </div>
              <div className="lg:hidden">
                <button
                  onClick={() => syncFromWhatsApp(true)}
                  className="w-full py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Sincronizando..." : "Atualizar"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="h-full grid place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 mx-auto grid place-items-center text-muted-foreground/30">
                    <MessageSquare className="h-8 w-8" />
                  </div>
                  <p className="text-xs text-muted-foreground px-4">Nenhuma conversa encontrada na instância selecionada.</p>
                </div>
              ) : (
                filtered.map((c) => {
                  const last = c.transcript?.[c.transcript.length - 1];
                  const initials = (c.contact_name ?? c.contact_phone)
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full flex items-start gap-3 p-3 border-b border-border/50 transition relative text-left ${
                        selectedId === c.id ? "bg-primary/[0.03]" : "hover:bg-muted/20"
                      }`}
                    >
                      {selectedId === c.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                      )}
                      <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-white font-bold text-sm">
                        {initials || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm truncate">
                            {c.contact_name ?? c.contact_phone}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.last_message_at), {
                              addSuffix: false,
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {last?.content ?? "—"}
                          </p>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                              c.status === "handed_off"
                                ? "bg-warning/15 text-warning"
                                : "bg-success/15 text-success"
                            }`}
                          >
                            {c.status === "handed_off" ? "MANUAL" : "BOT"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selected ? (
            <div className={`flex-1 flex flex-col bg-card min-w-0 relative ${!selectedId ? 'hidden sm:flex' : 'flex'}`}>
              {imagePreview && (
                <div className="absolute inset-0 z-[60] bg-[#f0f2f5] flex flex-col animate-in fade-in duration-200">
                  {/* Header */}
                  <div className="h-16 px-6 flex items-center justify-between bg-[#f0f2f5]">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={clearImage}
                        className="p-2 hover:bg-black/5 rounded-full transition"
                      >
                        <X className="h-6 w-6 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <button className="p-2.5 hover:bg-black/5 rounded-lg transition"><Crop className="h-5 w-5" /></button>
                      <button className="p-2.5 hover:bg-black/5 rounded-lg transition"><Smile className="h-5 w-5" /></button>
                      <button className="p-2.5 hover:bg-black/5 rounded-lg transition"><Pencil className="h-5 w-5" /></button>
                      <button className="p-2.5 hover:bg-black/5 rounded-lg transition"><Type className="h-5 w-5" /></button>
                      <button className="p-2.5 hover:bg-black/5 rounded-lg transition ml-2 border-l border-muted-foreground/20 pl-4"><Download className="h-5 w-5" /></button>
                    </div>
                  </div>

                  {/* Main Preview */}
                  <div className="flex-1 flex items-center justify-center p-4 md:p-12 overflow-hidden bg-[#e9edef]">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-h-full max-w-full object-contain shadow-2xl rounded-sm transition-transform duration-300"
                    />
                  </div>

                  {/* Footer Area */}
                  <div className="bg-[#f0f2f5] pt-2 pb-8 px-6 space-y-6">
                    <div className="max-w-3xl mx-auto space-y-6">
                      {/* Caption Input */}
                      <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-black/5">
                        <button className="text-muted-foreground hover:text-foreground transition">
                          <Smile className="h-6 w-6" />
                        </button>
                        <input 
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              send();
                            }
                          }}
                          placeholder="Adicione uma legenda..."
                          className="flex-1 outline-none text-[15px] bg-transparent"
                          autoFocus
                        />
                      </div>

                      {/* Thumbnails and Send */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 overflow-x-auto py-2">
                          <div className="h-14 w-14 rounded-lg border-2 border-[#00a884] overflow-hidden shrink-0 shadow-md">
                            <img src={imagePreview} className="h-full w-full object-cover" />
                          </div>
                          <button className="h-14 w-14 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground hover:bg-black/5 transition hover:border-muted-foreground/50">
                            <Plus className="h-6 w-6" />
                          </button>
                        </div>
                        
                        <button 
                          onClick={send}
                          disabled={sending}
                          className="h-14 w-14 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-lg hover:brightness-105 active:scale-95 transition disabled:opacity-50 disabled:scale-100"
                        >
                          {sending ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <Send className="h-6 w-6 fill-current translate-x-0.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="h-[68px] px-4 sm:px-6 border-b border-border flex items-center justify-between bg-card shadow-sm z-10">
                <button 
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden p-2 -ml-2 hover:bg-muted rounded-full transition"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 grid place-items-center font-bold text-sm text-white shrink-0">
                    {(selected.contact_name ?? selected.contact_phone).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-sm truncate">
                      {selected.contact_name ?? selected.contact_phone}
                    </h2>
                    <p className="text-[10px] text-muted-foreground">
                      {selected.contact_phone} · {selected.messages_count} mensagens
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleHandoff}
                  className="h-9 px-3 rounded-lg bg-muted hover:bg-muted/70 transition text-xs font-bold flex items-center gap-1.5"
                >
                  {selected.status === "handed_off" ? (
                    <>
                      <PlayCircle className="h-4 w-4 text-success" /> Reativar bot
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-4 w-4 text-warning" /> Pausar bot
                    </>
                  )}
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-[#e5ddd5]/30">
                {(selected.transcript ?? []).length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-10">
                    Sem mensagens registradas.
                  </div>
                ) : (
                  selected.transcript.map((m, i) => {
                    const isUser = m.role === "user";
                    const isBot = m.role === "assistant";
                    return (
                      <div
                        key={i}
                        className={`flex gap-3 ${isUser ? "justify-start" : "justify-end"}`}
                      >
                        {isUser && (
                          <div className="h-8 w-8 rounded-full bg-card shadow-sm border border-border grid place-items-center shrink-0 mt-1">
                            <User className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-[13px] sm:text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words ${
                            isUser
                              ? "bg-card border border-border rounded-tl-sm text-foreground"
                              : isBot
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-success text-white rounded-tr-sm"
                          }`}
                        >
                          {m.content}
                          {m.at && (
                            <div className={`text-[9px] mt-1 opacity-70`}>
                              {new Date(m.at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {!isUser && m.sent === false && " · falhou"}
                            </div>
                          )}
                        </div>
                        {isBot && (
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-1">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                        )}
                        {m.role === "agent" && (
                          <div className="h-8 w-8 rounded-full bg-success/10 text-success grid place-items-center shrink-0 mt-1">
                            <UserCog className="h-3.5 w-3.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3 sm:p-4 bg-card border-t border-border shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                <div className="relative">
                  <div className="flex items-end gap-3">
                   <div className="relative">
                     <input
                       type="file"
                       accept="image/*"
                       id="image-upload"
                       className="hidden"
                       onChange={handleImageSelect}
                     />
                     <label
                       htmlFor="image-upload"
                       className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center hover:bg-muted transition cursor-pointer"
                     >
                       <ImageIcon className="h-5 w-5 text-muted-foreground" />
                     </label>
                   </div>

                   <textarea
                     value={text}
                     onChange={(e) => setText(e.target.value)}
                     onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !selectedImage) {
                          e.preventDefault();
                          send();
                        } else if (e.key === "Enter" && !e.shiftKey && selectedImage) {
                          e.preventDefault();
                        }
                     }}
                     placeholder={selectedImage ? "Adicione uma legenda..." : "Digite sua mensagem..."}
                     className="flex-1 bg-muted/40 rounded-2xl border border-border/50 focus:border-primary/20 focus:bg-muted/60 outline-none p-3 text-sm min-h-[44px] sm:min-h-[48px] max-h-32 resize-none transition"
                     rows={1}
                   />
                    {!selectedImage && (
                      <button
                        onClick={send}
                        disabled={sending || (!text.trim() && !selectedImage)}
                        className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center hover:opacity-95 shadow-md active:scale-95 transition disabled:opacity-50 disabled:scale-100"
                      >
                        {sending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    )}
                   </div>
                 </div>
               </div>
             </div>
          ) : (
            <div className="hidden sm:grid flex-1 place-items-center bg-muted/5">
              <div className="text-center space-y-3 max-w-sm px-6">
                <div className="h-20 w-20 rounded-3xl bg-card border border-border shadow-elegant mx-auto grid place-items-center text-primary/20">
                  <MessageSquare className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold font-display tracking-tight">Selecione uma conversa</h3>
                <p className="text-sm text-muted-foreground">
                  As mensagens recebidas no WhatsApp aparecem aqui em tempo real.
                 </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}