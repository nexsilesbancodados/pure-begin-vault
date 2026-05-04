import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { evolution } from "@/lib/evolution";
import {
  MessageSquare,
  Loader2,
  User,
  Bot,
  Send,
  Search,
  Mic,
  Square,
  Smile,
  RefreshCw,
  PauseCircle,
  Settings2,
  PlayCircle,
  Image as ImageIcon,
   Trash2,
   ChevronDown,
  X,
  Users,
  Info,
  Phone,
  Clock,
  Calendar,
  Edit3,
  ExternalLink,
  Forward,
  Tag as TagIcon,
  UserPlus,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/crm_/conversas")({
  head: () => ({
    meta: [
      { title: "Conversas WhatsApp — CRM" },
      { name: "description", content: "Atenda clientes do WhatsApp direto pelo CRM: texto, áudio e figurinhas." },
    ],
  }),
  component: ConversasPage,
});

type Msg = {
  role: "user" | "assistant" | "agent";
  content: string;
  at?: string;
  sent?: boolean;
  kind?: "text" | "audio" | "sticker" | "image";
  media?: string; sender?: string | null; // url ou data url para preview local
};
type Conversation = {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  status: string;
  messages_count: number;
  last_message_at: string;
  transcript: Msg[];
  profile_pic_url: string | null;
  is_group: boolean; remote_jid: string | null;
};

type EvolutionChat = {
  id?: string;
  remoteJid?: string;
  name?: string;
  pushName?: string;
  profileName?: string;
  updatedAt?: string;
  lastMessageTime?: number | string;
  conversationTimestamp?: number | string;
  lastMessage?: any;
  profilePicUrl?: string;
  profilePictureUrl?: string;
  subject?: string;
};

const STICKERS = [
  "👍", "❤️", "🔥", "👏", "🙏", "😂", "😍", "😎", "🥳", "🤝",
  "✅", "🚀", "💯", "🎉", "👌", "💪", "🤔", "😢", "😡", "🙌",
];

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = [
      obj.data,
      obj.chats,
      obj.records,
      obj.result,
      obj.messages,
      (obj.messages as Record<string, unknown> | undefined)?.records,
    ].find(Array.isArray);
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
};

const getContactPhone = (value: any) => {
  const raw =
    value?.lastMessage?.key?.remoteJidAlt ??
    value?.lastMessage?.key?.remoteJid ??
    value?.key?.remoteJidAlt ??
    value?.key?.remoteJid ??
    value?.remoteJid ??
    "";

  return String(raw).split("@")[0].replace(/\D/g, "");
};

const getMessageText = (m: any) =>
  m?.message?.conversation ??
  m?.message?.extendedTextMessage?.text ??
  m?.message?.imageMessage?.caption ??
  m?.message?.videoMessage?.caption ??
  m?.text ??
  m?.body ??
  "";

const detectKind = (m: any): Msg["kind"] => {
  if (m?.message?.audioMessage || m?.messageType === "audioMessage") return "audio";
  if (m?.message?.stickerMessage || m?.messageType === "stickerMessage") return "sticker";
  if (m?.message?.imageMessage || m?.messageType === "imageMessage") return "image";
  return "text";
};

const normTs = (v: unknown) => {
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000).toISOString();
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (!Number.isNaN(n)) return new Date(n > 1e12 ? n : n * 1000).toISOString();
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
};

const normalizeTranscript = (messages: any[]): Msg[] =>
  messages
    .map((m) => {
      const kind = detectKind(m);
      const text = String(getMessageText(m) ?? "").trim();
      const fromMe = !!(m?.key?.fromMe ?? m?.fromMe);
      const placeholder =
        kind === "audio" ? "🎤 Áudio" : kind === "sticker" ? "🟦 Figurinha" : kind === "image" ? "🖼️ Imagem" : "";
      const content = text || placeholder;
      if (!content) return null;
      return {
        role: fromMe ? "assistant" : "user",
        kind,
        content,
        at: normTs(m?.messageTimestamp ?? m?.timestamp ?? m?.createdAt),
        sent: fromMe ? m?.status !== "ERROR" : undefined, sender: m?.pushName || m?.verifiedName || m?.name || m?.verifiedName || null,
      } as Msg;
    })
    .filter(Boolean) as Msg[];

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = String(r.result ?? "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });

function ConversasPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Conversation[]>([]);
   const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resolvedInstance, setResolvedInstance] = useState<string | null>(null);
  const [availableInstances, setAvailableInstances] = useState<any[]>([]);
  const [instanceDetails, setInstanceDetails] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "bot" | "manual" | "unread">("all");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const syncLockRef = useRef(false);
  const readyForNotificationsRef = useRef(false);
  const lastIncomingMessageRef = useRef(new Map<string, string>());
  const webhookCheckedRef = useRef<string | null>(null);
  const [readState, setReadState] = useState<Record<string, number>>({});
  const [sideInfoOpen, setSideInfoOpen] = useState(true);
  const [localNotes, setLocalNotes] = useState("");
   const [forwardMsg, setForwardMsg] = useState<Msg | null>(null);
   const [isForwarding, setIsForwarding] = useState(false);
   const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);

   const QUICK_REPLIES = [
     { shortcut: "/oi", text: "Olá! Tudo bem? Como posso ajudar você hoje?" },
     { shortcut: "/pix", text: "Segue nossa chave PIX para pagamento: (Chave aqui). Por favor, envie o comprovante após realizar a transferência." },
     { shortcut: "/obrigado", text: "De nada! Qualquer dúvida, estamos à disposição." },
     { shortcut: "/endereco", text: "Estamos localizados na (Rua, Número, Bairro, Cidade). Horário de funcionamento: 09h às 18h." },
   ];
  const [userFilter, setUserFilter] = useState<"all" | "mine">("all");
   const [tagInput, setTagInput] = useState("");
   const [showScrollBottom, setShowScrollBottom] = useState(false);

   const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
     const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
     setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 300);
   };

  const unreadCount = (c: Conversation) => {
    const seen = readState[c.id] ?? 0;
    const incoming = (c.transcript ?? []).filter((m) => m.role === "user").length;
    return Math.max(0, incoming - seen);
  };

  const markAsRead = (c: Conversation | null) => {
    if (!c) return;
    const incoming = (c.transcript ?? []).filter((m) => m.role === "user").length;
    setReadState((prev) => (prev[c.id] === incoming ? prev : { ...prev, [c.id]: incoming }));
  };

  const getLastIncomingKey = (conversation: Conversation) => {
    const lastIncoming = [...(conversation.transcript ?? [])]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastIncoming) return null;

    return [conversation.contact_phone, lastIncoming.at ?? "", lastIncoming.kind ?? "text", lastIncoming.content]
      .join("|")
      .trim();
  };

  const rememberConversation = (conversation: Conversation) => {
    const key = getLastIncomingKey(conversation);
    if (key) lastIncomingMessageRef.current.set(conversation.contact_phone, key);
  };

  const maybeNotifyIncoming = (conversation: Conversation) => {
    const key = getLastIncomingKey(conversation);
    if (!key) return;

    const previousKey = lastIncomingMessageRef.current.get(conversation.contact_phone);
    lastIncomingMessageRef.current.set(conversation.contact_phone, key);

    if (!readyForNotificationsRef.current || previousKey === key) return;

    const title = conversation.contact_name ?? conversation.contact_phone;
    const lastIncoming = [...(conversation.transcript ?? [])]
      .reverse()
      .find((message) => message.role === "user");
    const description = lastIncoming?.content || "Nova mensagem recebida";

    toast.info(`Nova mensagem de ${title}`, { description });

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      document.visibilityState !== "visible"
    ) {
      new Notification(title, { body: description });
    }
  };

   const applyConversations = (list: Conversation[], notify = false, forceReplace = false) => {
     setItems((prev) => {
       if (forceReplace) {
         const sorted = [...list].sort(
           (a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)
         );
         if (notify) sorted.forEach(maybeNotifyIncoming);
         else sorted.forEach(rememberConversation);
         return sorted;
       }
 
       const dedupMap = new Map<string, Conversation>();
       let changed = false;
       
       for (const c of prev) {
         dedupMap.set(c.contact_phone, c);
       }
       
       for (const conversation of list) {
         const key = conversation.contact_phone;
         const previous = dedupMap.get(key);
         if (!previous) {
           dedupMap.set(key, conversation);
           changed = true;
           continue;
         }
         const previousAt = +new Date(previous.last_message_at);
         const currentAt = +new Date(conversation.last_message_at);
         const previousLen = previous.transcript?.length ?? 0;
         const currentLen = conversation.transcript?.length ?? 0;
         
         if (currentAt > previousAt || currentLen > previousLen) {
           changed = true;
           dedupMap.set(key, {
             ...previous,
             ...conversation,
             transcript: currentLen >= previousLen ? conversation.transcript : previous.transcript
           });
         }
       }
       
       const sorted = [...dedupMap.values()].sort(
         (a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)
       );

      if (notify) {
        sorted.forEach(maybeNotifyIncoming);
      } else {
        sorted.forEach(rememberConversation);
      }

      // Update selected ID based on contact_phone to avoid jumping
      setSelectedId((currentId) => {
        if (!currentId) return sorted[0]?.id ?? null;
        
        // Find current selected item in old items
        const currentItem = prev.find(i => i.id === currentId);
        if (!currentItem) {
          // If not in prev, check if it's already in sorted
          if (sorted.some(c => c.id === currentId)) return currentId;
          return sorted[0]?.id ?? null;
        }
        
        // Find matching item by phone in new sorted list
        const match = sorted.find(c => c.contact_phone === currentItem.contact_phone);
        return match?.id ?? currentId;
      });

      return changed ? sorted : prev;
    });
  };

  const fetchAvailableInstances = async () => {
    try {
      const activeStatus = ["open", "connected", "active", "online"];
      const instances = await evolution.getInstances();
      const active = instances.filter(i => activeStatus.includes(String(i.status ?? "").toLowerCase()));
      setAvailableInstances(active);
      return active;
    } catch (e) {
      console.error("Erro ao buscar instâncias:", e);
      return [];
    }
  };

  const resolveInstance = async (forceInstance?: string) => {
    if (forceInstance) {
      setResolvedInstance(forceInstance);
      return forceInstance;
    }

    if (!user?.id) {
      const active = await fetchAvailableInstances();
      const candidate = active[0] || null;
      const remoteCandidate = candidate?.instanceName ?? null;
      setResolvedInstance(remoteCandidate);
      setInstanceDetails(candidate);
      return remoteCandidate;
    }

    const { data: settings, error: settingsError } = await supabase
      .from("bot_settings")
      .select("whatsapp_instance, webhook_secret")
      .eq("user_id", user.id)
      .maybeSingle();

    if (settingsError) throw settingsError;

    const configured = settings?.whatsapp_instance?.trim();
    if (configured) {
      setResolvedInstance(configured);
      const instances = await fetchAvailableInstances();
      const details = instances.find(i => i.instanceName === configured);
      if (details) setInstanceDetails(details);
      return configured;
    }

    const active = await fetchAvailableInstances();
    const remoteCandidateObj = active[0] || null;
    const remoteCandidate = remoteCandidateObj?.instanceName ?? null;

    if (remoteCandidate) {
      setResolvedInstance(remoteCandidate);
      setInstanceDetails(remoteCandidateObj);
      await supabase.from("bot_settings").upsert(
        { user_id: user.id, whatsapp_instance: remoteCandidate },
        { onConflict: "user_id" }
      );
    } else if (!settings) {
      await supabase.from("bot_settings").insert({ user_id: user.id });
    }

    return remoteCandidate;
  };

  const handleInstanceChange = async (newInstance: string) => {
    if (!user?.id) return;
    setResolvedInstance(newInstance);
    const details = availableInstances.find(i => i.instanceName === newInstance);
    if (details) setInstanceDetails(details);
    
     setLoading(true);
     setSelectedId(null);
     // Clean up local items for the old instance immediately
     setItems([]);

    try {
      await supabase.from("bot_settings").upsert(
        { user_id: user.id, whatsapp_instance: newInstance },
        { onConflict: "user_id" }
      );
      
       toast.success(`Instância alterada para ${newInstance}`);
       // Load from DB first, then sync from WhatsApp replacing old data
       await load(false);
       await syncFromWhatsApp(false, true);
    } catch (e) {
      toast.error("Erro ao trocar de instância");
    } finally {
      setLoading(false);
    }
  };

  // Garante que o webhook da Evolution está apontando para o nosso bot-webhook
  // para que mensagens recebidas cheguem em tempo real (via DB → Realtime).
  const ensureWebhook = async (instance: string) => {
    if (!user?.id || !instance) return;
    if (webhookCheckedRef.current === instance) return;
    try {
      let { data: settings, error: fetchError } = await supabase
        .from("bot_settings")
        .select("webhook_secret, whatsapp_instance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!settings && !fetchError) {
        console.log("[conversas] criando bot_settings inicial...");
        const { data: newSettings, error: insertError } = await supabase
          .from("bot_settings")
          .insert({ user_id: user.id, whatsapp_instance: instance })
          .select()
          .single();
        
        if (insertError) throw insertError;
        settings = newSettings;
      }

      const secret = settings?.webhook_secret;
      if (!secret) return; // bot ainda não configurado; nada a fazer

      webhookCheckedRef.current = instance;
      const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? null;
      if (!projectRef) return;
      const expectedUrl = `https://${projectRef}.supabase.co/functions/v1/bot-webhook?uid=${user.id}&secret=${secret}`;

      const current = await evolution.getWebhook(instance);
      const currentUrl = current?.url ?? current?.webhook?.url ?? "";
      if (currentUrl === expectedUrl) return;

      await evolution.setWebhook(instance, expectedUrl);
      console.log("[conversas] webhook configurado para tempo real:", expectedUrl);
    } catch (e) {
      console.warn("[conversas] não foi possível configurar webhook automaticamente", e);
      webhookCheckedRef.current = null; // permite tentar de novo depois
    }
  };

  const load = async (silent = false) => {
    if (!user?.id) {
      setLoading(false);
      setLoadError(null);
      return;
    }

    if (!silent && items.length === 0) setLoading(true);
    setLoadError(null);
    try {
      const activeInstance = await resolveInstance();
      let query = supabase
        .from("bot_conversations")
        .select("*")
        .eq("user_id", user.id);

      if (activeInstance) {
        query = query.eq("instance_name", activeInstance);
      }

      const { data, error } = await query.order("last_message_at", { ascending: false });

      if (error) throw error;

      const list = (data ?? []) as any as Conversation[];
      applyConversations(list);
    } catch (error: any) {
      console.error("Erro ao carregar conversas", error);
      setLoadError(error?.message ?? "Não foi possível carregar as conversas.");
      toast.error(error?.message ?? "Não foi possível carregar as conversas.");
    } finally {
      setLoading(false);
    }
  };

   const syncFromWhatsApp = async (showToast = false, forceReplace = false) => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    setSyncing(true);
    try {
      const instance = await resolveInstance();
      let existing: Conversation[] = [];

      if (user?.id) {
        const { data: existingRows, error: existingError } = await supabase
          .from("bot_conversations")
          .select("*")
          .eq("user_id", user.id);

        if (existingError) throw existingError;
        existing = (existingRows ?? []) as any as Conversation[];
      }

      if (!instance) { setLoading(false); setSyncing(false); syncLockRef.current = false;
        if (showToast) toast.error("Conecte ou selecione sua instância do WhatsApp primeiro.");
        return;
      }

      // Garante que o webhook está apontando para nosso endpoint (uma vez por instância)
      ensureWebhook(instance);

      const rawChats = await evolution.findChats(instance);
      const chats = asArray<EvolutionChat>(rawChats).filter((c) => !!c?.remoteJid);
      if (chats.length === 0) {
        if (showToast) toast.info("Nenhuma conversa na instância.");
        return;
      }
      const byPhone = new Map(
        existing.map((c) => [c.contact_phone, c])
      );
      const previewRows = chats
        .map((chat) => {
          const phone = getContactPhone(chat);
          if (!phone) return null;
          const isGroup = String(chat.remoteJid ?? "").endsWith("@g.us");

          const existingConversation = byPhone.get(phone);
          const previewTranscript = existingConversation?.transcript?.length
            ? existingConversation.transcript
            : normalizeTranscript(chat.lastMessage ? [chat.lastMessage] : []);

          return {
            id: existingConversation?.id ?? `${instance}:${phone}`,
            contact_phone: phone,
            contact_name:
              chat.subject ??
              chat.name ??
              chat.pushName ??
              chat.profileName ??
              chat.lastMessage?.pushName ??
              existingConversation?.contact_name ??
              null,
            transcript: previewTranscript,
            status: existingConversation?.status ?? "active",
            messages_count: previewTranscript.length,
            last_message_at:
              previewTranscript[previewTranscript.length - 1]?.at ??
              normTs(chat.updatedAt ?? chat.lastMessageTime ?? chat.conversationTimestamp ?? chat.lastMessage?.messageTimestamp),
            profile_pic_url:
              chat.profilePicUrl ??
              chat.profilePictureUrl ??
              existingConversation?.profile_pic_url ??
              null,
            is_group: isGroup,
            remote_jid: chat.remoteJid || null,
          } satisfies Conversation;
        })
        .filter((row): row is Conversation => !!row);

       if (previewRows.length > 0) {
         applyConversations(previewRows, lastIncomingMessageRef.current.size > 0, forceReplace);
         setLoading(false);
       }

      // Limite aumentado e processamento em lotes para evitar sobrecarga
      const MAX_CHATS = 60;
      const rows = await Promise.all(
        chats.slice(0, MAX_CHATS).map(async (chat) => {
          const phone = getContactPhone(chat);
          if (!phone) return null;
          const isGroup = String(chat.remoteJid ?? "").endsWith("@g.us");

          const ex = byPhone.get(phone);
           // Só busca o histórico completo se for a conversa selecionada (para performance)
           const isSelected = chat.remoteJid === selected?.remote_jid || (selectedId?.split(':')[1] === phone);
           const hasNoTranscript = !ex?.transcript?.length;
           const raw = (isSelected || hasNoTranscript) ? await evolution.findMessages(instance, chat.remoteJid!).catch(() => []) : [];
           const transcript = normalizeTranscript(asArray<any>(raw));
           const mergedTranscript = transcript.length > 0 ? transcript : (ex?.transcript ?? normalizeTranscript(chat.lastMessage ? [chat.lastMessage] : [])); 
           mergedTranscript.sort((a, b) => +new Date(a.at || 0) - +new Date(b.at || 0));
          const lastAt =
            mergedTranscript[mergedTranscript.length - 1]?.at ??
            normTs(chat.updatedAt ?? chat.lastMessageTime ?? chat.conversationTimestamp ?? chat.lastMessage?.messageTimestamp);

          let picUrl =
            chat.profilePicUrl ??
            chat.profilePictureUrl ??
            ex?.profile_pic_url ??
            null;
          let displayName =
            chat.subject ??
            chat.name ??
            chat.pushName ??
            chat.profileName ??
            chat.lastMessage?.pushName ??
            ex?.contact_name ??
            null;

          // Para grupos, busca nome e foto via group/findGroupInfos quando faltar
          if (isGroup && (!picUrl || !displayName)) {
            const info = await evolution.findGroupInfo(instance, chat.remoteJid!);
            if (info) {
              displayName = displayName ?? info?.subject ?? info?.name ?? null;
              picUrl = picUrl ?? info?.pictureUrl ?? info?.profilePicUrl ?? null;
            }
          }

          // Para contatos individuais, busca a foto de perfil quando faltar
          if (!isGroup && !picUrl) {
            const number = String(chat.remoteJid ?? "").split("@")[0];
            picUrl = await evolution.fetchProfilePictureUrl(instance, number);
          }

          return {
            id: ex?.id ?? `${instance}:${phone}`,
            contact_phone: phone,
            contact_name: displayName,
            transcript: mergedTranscript,
            status: ex?.status ?? "active",
            messages_count: mergedTranscript.length,
            last_message_at: lastAt,
            profile_pic_url: picUrl,
            is_group: isGroup,
            remote_jid: chat.remoteJid || null,
            instance_name: instance,
          } as any as Conversation;
        })
      );
      const valid = rows.filter((row): row is Conversation => !!row && (row as any).transcript.length > 0) as Conversation[];
      if (user?.id && valid.length > 0) {
        const upsertRows = valid.map((row) => ({
          ...(String(row.id).includes(":") ? {} : { id: row.id }),
          user_id: user.id,
          contact_phone: row.contact_phone,
          contact_name: row.contact_name,
          remote_jid: row.remote_jid,
          transcript: row.transcript as any,
          status: row.status,
          messages_count: row.messages_count,
          last_message_at: row.last_message_at,
          instance_name: (row as any).instance_name,
        }));

        const { error: upsertError } = await supabase
          .from("bot_conversations")
          .upsert(upsertRows, { onConflict: "user_id,contact_phone" });
        if (upsertError) throw upsertError;
      }

       if (user?.id) {
         await load(true);
       } else {
         applyConversations(valid, lastIncomingMessageRef.current.size > 0, forceReplace);
         setLoading(false);
       }

      if (showToast) toast.success("Conversas sincronizadas.");
    } catch (e: any) {
      console.error("Falha ao sincronizar WhatsApp", e);
      toast.error(e?.message ?? "Falha ao sincronizar.");
    } finally {
      setSyncing(false);
      syncLockRef.current = false;
    }
  };

  useEffect(() => {
    fetchAvailableInstances().then(() => load());
    const ch = user?.id
      ? supabase
          .channel("conv:bot_conversations:" + user.id)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "bot_conversations", filter: `user_id=eq.${user.id}` },
            (payload) => {
              console.log("[conversas] evento em tempo real recebido:", payload.eventType, payload.new);
              if (payload.eventType === "DELETE") {
                setItems((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
                return;
              }

               const row = { ...(payload.new as any), transcript: (payload.new as any).transcript || [] } as any as Conversation & { instance_name?: string };
               
               // Ignore real-time updates for conversations not belonging to the resolved instance
               if (resolvedInstance && row.instance_name && row.instance_name !== resolvedInstance) {
                 return;
               }
 
        setItems((prev) => {
          const next = [row, ...prev.filter((c) => c.id !== row.id)].filter((c, i, a) => a.findIndex(t => t.contact_phone === c.contact_phone) === i);
          next.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
          return next;
        });

              maybeNotifyIncoming(row);
            }
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") readyForNotificationsRef.current = true;
          })
      : null;

    // Removido o setInterval agressivo que causava saltos na UI
    // syncFromWhatsApp(false) já é chamado pelo Realtime e visibilitychange
    const initialTimer = window.setTimeout(() => syncFromWhatsApp(false), 300);

     // Sincronização automática em background a cada 30s para evitar excesso de requisições
     const poller = window.setInterval(() => syncFromWhatsApp(false), 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncFromWhatsApp(false);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }

    return () => {
      clearTimeout(initialTimer);
      clearInterval(poller);
      document.removeEventListener("visibilitychange", handleVisibility);
      readyForNotificationsRef.current = false;
      if (ch) supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(
    () =>
       items.filter((c: any) => {
         // Filter by active instance
         if (resolvedInstance && c.instance_name && c.instance_name !== resolvedInstance) {
           return false;
         }
 
        const matchSearch =
          !search ||
          (c.contact_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          c.contact_phone.includes(search);
        if (!matchSearch) return false;
        if (statusFilter === "bot") return c.status !== "handed_off";
        if (statusFilter === "manual") return c.status === "handed_off";
        if (statusFilter === "unread") return unreadCount(c) > 0;
        return true;
      }),
    [items, search, statusFilter, readState, resolvedInstance]
  );

  const selected = useMemo(
    () => items.find((c) => c.id === selectedId) ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    // Mensagens mais recentes ficam no topo — rolar para o início ao abrir/atualizar
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [selected?.transcript?.length, selectedId]);

  // Mark conversation as read when opened or when new messages arrive while open
  useEffect(() => {
    if (selected) markAsRead(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.transcript?.length]);

  const totalUnread = useMemo(
    () => items.reduce((acc, c) => acc + unreadCount(c), 0),
    [items, readState]
  );

  const formatDateLabel = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return "Hoje";
    if (isYesterday(d)) return "Ontem";
    if (isThisWeek(d, { locale: ptBR })) return format(d, "EEEE", { locale: ptBR });
    return format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const sendPayload = async (payload: Record<string, unknown>) => {
    if (!selected) return;
    setSending(true);
    try {
      let jid = selected.remote_jid || selected.contact_phone;
      if (!jid.includes("@")) {
        jid = selected.is_group ? `${jid}@g.us` : `${jid}@s.whatsapp.net`;
      }
      const instance = await resolveInstance();
      if (!instance) throw new Error("Instância do WhatsApp não encontrada.");

      let endpoint = "";
      let body: any = {};

      if (payload.kind === "text") {
        endpoint = `/api/evolution/message/sendText/${instance}`;
        body = { number: jid, text: payload.text, delay: 1200, linkPreview: false, presence: "composing" };
      } else if (payload.kind === "audio") {
        endpoint = `/api/evolution/message/sendWhatsAppAudio/${instance}`;
        body = { number: jid, audio: payload.media, delay: 1200, encoding: true, presence: "composing" };
      } else if (payload.kind === "sticker") {
        endpoint = `/api/evolution/message/sendSticker/${instance}`;
        body = { number: jid, sticker: payload.media, delay: 1200, presence: "composing" };
      } else if (payload.kind === "image") {
        endpoint = `/api/evolution/message/sendMedia/${instance}`;
        body = {
          number: jid,
          mediatype: "image",
          media: payload.media,
          mimetype: payload.mimetype || "image/png",
          caption: payload.text || "",
          delay: 1200,
          fileName: payload.fileName || "image.png",
          presence: "composing"
        };
      }

      if (!endpoint) throw new Error("Tipo de mensagem inválido.");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorDetail = data?.message || data?.error || (typeof data === 'string' ? data : `Erro ${res.status}`);
        throw new Error(`Falha no envio Evolution: ${errorDetail}`);
      }

       // Grava localmente no banco para manter o histórico
           const localConv = items.find(c => c.id === selected.id);
           const transcript = Array.isArray(localConv?.transcript) ? localConv.transcript : [];
           const placeholder = payload.kind === "audio" ? "🎤 Áudio" : payload.kind === "sticker" ? "🟦 Figurinha" : payload.kind === "image" ? "🖼️ Imagem" : payload.text;
           
           const newMsg: Msg = {
             role: "agent",
             kind: payload.kind as any,
             content: String(payload.text || placeholder),
             at: new Date().toISOString(),
             sent: true,
           };

            // Buscamos o registro mais atualizado do banco antes de salvar
            const { data: currentConv } = await supabase
              .from("bot_conversations")
              .select("transcript")
              .eq("id", selected.id)
              .single();

            const latestTranscript = (Array.isArray(currentConv?.transcript) ? currentConv.transcript : transcript) as Msg[];
            const updatedTranscript = [...latestTranscript, newMsg];
            
            // Update local state first for instant feedback
            setItems(prev => prev.map(c => c.id === selected.id ? { 
              ...c, 
              transcript: updatedTranscript, 
              messages_count: updatedTranscript.length,
              last_message_at: newMsg.at!
            } : c));
 
            // Then update DB
            const { error: upsertError } = await supabase.from("bot_conversations").update({
              transcript: updatedTranscript as any,
              messages_count: updatedTranscript.length,
              last_message_at: newMsg.at!,
            }).eq("id", selected.id);

           if (upsertError) console.error("Erro ao atualizar transcript:", upsertError);
       toast.success("Enviada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await sendPayload({ kind: "text", text: t });
  };

  const sendSticker = async (emoji: string) => {
    setStickerOpen(false); 
    // Envia como texto (emoji grande). Evolution sendSticker requer .webp;
    // como atalho usamos texto — visualmente vira figurinha no chat do cliente.
    await sendPayload({ kind: "text", text: emoji });
  };

  const sendImageFile = async (file: File) => {
    const b64 = await blobToBase64(file);
    await sendPayload({
      kind: "image",
      media: b64,
      mimetype: file.type || "image/png",
      fileName: file.name,
      text: text.trim() || undefined,
    });
    setText("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
         const blob = new Blob(chunksRef.current, { type: "audio/ogg; codecs=opus" });
         const b64 = await blobToBase64(blob);
         await sendPayload({ kind: "audio", media: b64, mimetype: "audio/ogg" });
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = (cancel = false) => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecording(false);
    setRecordSecs(0);
    const rec = recorderRef.current;
    if (!rec) return;
    if (cancel) rec.ondataavailable = null;
    if (rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
  };

  const toggleHandoff = async () => {
    if (!selected) return;
    const ns = selected.status === "handed_off" ? "active" : "handed_off";
    const { error } = await supabase.from("bot_conversations").update({ status: ns }).eq("id", selected.id);
    if (error) toast.error(error.message);
    else toast.success(ns === "handed_off" ? "Bot pausado nesta conversa" : "Bot reativado");
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Conversas" subtitle="Gerencie seus atendimentos do WhatsApp em um só lugar" />
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar conversas */}
          <div className="w-[380px] border-r border-border/20 flex flex-col bg-card/50 backdrop-blur-xl">
            <div className="p-4 border-b border-border/20 space-y-4">
               <div className="flex items-center justify-between px-1 mb-1">
                 <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-base font-bold tracking-tight">Conversas</h3>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span className={`h-1 w-1 rounded-full ${instanceDetails?.status === 'open' || instanceDetails?.status === 'connected' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                      {instanceDetails?.status === 'open' || instanceDetails?.status === 'connected' ? 'Conectado' : 'Conectando...'}
                    </span>
                  </div>
                  {totalUnread > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20">
                      {totalUnread}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => { fetchAvailableInstances(); syncFromWhatsApp(true); }}
                    className="h-8 w-8 rounded-full hover:bg-muted/80 transition-colors flex items-center justify-center text-muted-foreground"
                    title="Sincronizar"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              
               <div className="px-1">
                 <Select
                   value={resolvedInstance || ""}
                   onValueChange={handleInstanceChange}
                 >
                   <SelectTrigger className="h-9 bg-primary/5 border-primary/10 text-primary hover:bg-primary/10 transition-all rounded-lg px-3">
                     <div className="flex items-center gap-2 overflow-hidden mr-2">
                       <Phone className="h-3.5 w-3.5 shrink-0" />
                       <SelectValue placeholder="Selecionar instância" />
                     </div>
                   </SelectTrigger>
                   <SelectContent>
                     {availableInstances.length === 0 ? (
                       <div className="p-2 text-xs text-muted-foreground text-center">
                         Nenhuma instância ativa
                       </div>
                     ) : (
                       availableInstances.map((ins) => (
                         <SelectItem key={ins.instanceName} value={ins.instanceName} className="text-xs">
                           <div className="flex items-center justify-between w-full gap-4">
                             <span className="font-medium">{ins.instanceName}</span>
                             {ins.owner && (
                               <span className="text-[9px] opacity-60">
                                 ({ins.owner.split('@')[0]})
                               </span>
                             )}
                           </div>
                         </SelectItem>
                       ))
                     )}
                   </SelectContent>
                 </Select>
               </div>

              <div className="relative group">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                <Input
                  placeholder="Buscar contato..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-background/50 border-border/20 focus-visible:ring-primary/20 transition-all rounded-xl"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl">
                {[
                  { id: "all", label: "Todas" },
                  { id: "unread", label: "Não lidas" },
                  { id: "bot", label: "Bot" },
                  { id: "manual", label: "Manual" },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id as typeof statusFilter)}
                    className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg transition-all duration-200 ${
                      statusFilter === f.id
                         ? "bg-background text-foreground shadow-sm"
                         : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="h-full grid place-items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : loadError ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-3">
                  <MessageSquare className="h-8 w-8 mx-auto opacity-50" />
                  <div>{loadError}</div>
                  <button
                    onClick={() => {
                      load();
                      syncFromWhatsApp(false);
                    }}
                    className="mx-auto h-8 px-3 rounded-lg bg-muted hover:bg-muted/80 transition text-[11px] font-bold flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3 w-3" /> Tentar novamente
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {resolvedInstance
                    ? "Nenhuma conversa encontrada ainda. Vamos continuar sincronizando automaticamente."
                    : "Nenhuma conversa ainda. Conecte a instância do WhatsApp para puxar o histórico."}
                </div>
              ) : (
                filtered.map((c) => {
                  const last = c.transcript?.[c.transcript.length - 1];
                  const displayName = c.contact_name ?? c.contact_phone;
                  const initials = displayName
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  const unread = unreadCount(c);
                  const isSelected = selectedId === c.id;

                  return (
                    <button
                      key={c.id}
                       onClick={() => { if (selectedId !== c.id) { setSelectedId(c.id); markAsRead(c); } }}
                       className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl transition-all duration-300 relative text-left group border border-transparent ${
                        isSelected 
                          ? "bg-primary/[0.08] shadow-[0_4px_20px_-4px_rgba(var(--primary-rgb),0.1)] ring-1 ring-primary/20" 
                          : "hover:bg-muted/50 border-transparent"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className={`h-12 w-12 ring-2 ring-offset-2 ring-transparent transition-all duration-500 group-hover:shadow-lg ${isSelected ? "scale-105 ring-primary/60 ring-offset-background" : "group-hover:scale-105"}`}>
                          {c.profile_pic_url ? (
                            <AvatarImage src={c.profile_pic_url} alt={displayName} />
                          ) : null}
                          <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm shadow-inner">
                            {c.is_group ? <Users className="h-5 w-5" /> : initials || "?"}
                          </AvatarFallback>
                        </Avatar>
                        {c.is_group && (
                          <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground grid place-items-center border-2 border-background shadow-sm">
                            <Users className="h-3 w-3" />
                          </span>
                        )}
                        <div className={`absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full transition-all duration-300 ${isSelected ? "opacity-100" : "opacity-0 scale-y-0"}`} />
                      </div>

                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={`text-sm truncate flex items-center gap-1.5 ${unread > 0 || isSelected ? "text-foreground font-bold" : "text-foreground/80 font-semibold"}`}>
                            {displayName}
                            {c.is_group && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground/80 tracking-tighter uppercase">GP</span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 font-medium shrink-0">
                            {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: false, locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3.5">
                          <p className={`text-xs truncate transition-colors ${unread > 0 ? "text-foreground font-semibold" : "text-muted-foreground/80"}`}>
                            {last?.role === "assistant" || last?.role === "agent" ? (
                              <span className="text-primary/70 font-medium mr-1">Você:</span>
                            ) : ""}
                            {last?.content ?? "—"}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {unread > 0 && (
                              <span className="text-[10px] min-w-[18px] h-[18px] px-1.5 grid place-items-center rounded-full font-black bg-primary text-primary-foreground animate-in zoom-in duration-300 shadow-sm shadow-primary/20">
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                            <div 
                              className={`h-2 w-2 rounded-full ring-4 ring-background ${
                                c.status === "handed_off" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                              }`}
                              title={c.status === "handed_off" ? "Manual" : "Bot Ativo"}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Área de chat */}
          {selected ? (
            <div className="flex-1 flex flex-col bg-card/20 min-w-0">
              <div className="h-[68px] px-6 border-b border-border flex items-center justify-between bg-card">
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    {selected.profile_pic_url ? (
                      <AvatarImage src={selected.profile_pic_url} alt={selected.contact_name ?? selected.contact_phone} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 font-bold text-sm text-white">
                      {selected.is_group ? <Users className="h-5 w-5" /> : (selected.contact_name ?? selected.contact_phone).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="font-bold text-sm truncate flex items-center gap-1.5">
                      {selected.contact_name ?? selected.contact_phone}
                      {selected.is_group && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">GRUPO</span>
                      )}
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
                    <><PlayCircle className="h-4 w-4 text-success" /> Reativar bot</>
                  ) : (
                    <><PauseCircle className="h-4 w-4 text-warning" /> Pausar bot</>
                  )}
                </button>
              </div>

               <div 
                 ref={scrollRef} 
                 onScroll={handleScroll}
                 className="flex-1 p-6 overflow-y-auto space-y-4 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed bg-opacity-5 scroll-smooth custom-scrollbar relative"
               >
                   {showScrollBottom && (
                     <button
                       onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
                       className="fixed bottom-24 right-8 z-50 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center animate-in zoom-in-50 duration-300 hover:scale-110 active:scale-95"
                     >
                       <ChevronDown className="h-5 w-5" />
                     </button>
                   )}
                <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background/80 pointer-events-none" />
                {(selected.transcript ?? []).length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-10">Sem mensagens registradas.</div>
                ) : (
                  [...selected.transcript].sort((a, b) => +new Date(a.at || 0) - +new Date(b.at || 0)).map((m, i, arr) => {
                    const isUser = m.role === "user";
                    const older = arr[i - 1];
                    const showDate =
                      !older ||
                      (m.at && older.at && new Date(m.at).toDateString() !== new Date(older.at).toDateString());
                    return (
                      <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {showDate && m.at && (
                          <div className="flex justify-center my-8">
                            <span className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl bg-muted/60 text-muted-foreground/80 border border-border/20 backdrop-blur-sm shadow-sm">
                              {formatDateLabel(m.at)}
                            </span>
                          </div>
                        )}
                        <div className={`flex gap-2 items-end ${isUser ? "justify-start" : "justify-end"} group`}>
                          {isUser && (
                            <div className="flex flex-col items-center gap-1 shrink-0 mb-1">
                              <div className="h-8 w-8 rounded-full bg-muted border border-border/20 grid place-items-center shadow-sm overflow-hidden">
                                {selected.profile_pic_url ? (
                                  <img src={selected.profile_pic_url} className="h-full w-full object-cover" alt="" />
                                ) : (
                                  <User className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] px-4 py-3 rounded-xl text-[13.5px] leading-relaxed shadow-sm transition-all duration-200 ${
                              isUser
                                 ? "bg-card text-foreground rounded-bl-none border border-border/20 hover:shadow-md"
                                 : "bg-primary text-primary-foreground rounded-br-none shadow-lg shadow-primary/15 hover:shadow-primary/25"
                            } ${m.kind === "sticker" ? "text-4xl bg-transparent shadow-none !px-1 !py-0" : ""}`}
                          >
                            {m.kind === "audio" ? (
                              <span className="flex items-center gap-3.5 py-1 font-medium">
                                <span className="h-8 w-8 rounded-full bg-background/10 inline-flex items-center justify-center">
                                  <Mic className="h-4 w-4" />
                                </span>
                                <span>Áudio do WhatsApp</span>
                              </span>
                            ) : m.kind === "image" ? (
                              <div className="space-y-2">
                                <img
                                  src={m.media || (typeof m.content === "string" && m.content.startsWith("http") ? m.content : "")}
                                  className="rounded-xl max-w-full h-auto cursor-pointer transition hover:brightness-110 shadow-sm"
                                  alt=""
                                  onClick={() => m.media && window.open(m.media, "_blank")}
                                />
                                {m.content && typeof m.content === "string" && !m.content.startsWith("🖼️") && (
                                  <p className="opacity-90">{m.content}</p>
                                )}
                              </div>
                            ) : (
                              <>
                                {selected.is_group && isUser && m.sender && (
                                  <p className="text-[10px] font-black text-primary mb-1.5 opacity-90 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="h-1 w-1 rounded-full bg-primary" />
                                    {m.sender}
                                  </p>
                                )}
                                <span className="whitespace-pre-wrap break-words">{m.content}</span>
                              </>
                            )}

                             <div className={`flex items-center gap-2 mt-1.5 ${isUser ? "justify-start ml-1" : "justify-end mr-1"}`}>
                               {m.at && m.kind !== "sticker" && (
                                 <div className={`text-[9px] font-bold opacity-30 uppercase tracking-tighter ${isUser ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
                                   {format(new Date(m.at), "HH:mm")}
                                   {!isUser && (
                                     <span className="ml-1 text-primary animate-in fade-in slide-in-from-left-1 duration-700 inline-block">
                                       <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3.5">
                                         <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                       </svg>
                                     </span>
                                   )}
                                 </div>
                               )}
                               <button
                                 onClick={() => { setForwardMsg(m); setIsForwarding(true); }}
                                 className="opacity-0 group-hover:opacity-40 transition-opacity hover:opacity-100 p-1 hover:bg-muted rounded-lg"
                                 title="Encaminhar"
                               >
                                 <Forward className="h-3 w-3" />
                               </button>
                             </div>
                           </div>

                           {!isUser && (
                             <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border border-primary/20 grid place-items-center shrink-0 shadow-sm mb-1">
                               <Bot className="h-4 w-4" />
                             </div>
                           )}
                         </div>
                       </div>
                     );
                  })
                )}
              </div>

              {/* Novo Composer Estilizado */}
              <div className="p-5 bg-card/80 border-t border-border/20 backdrop-blur-xl relative">
                <div className="max-w-4xl mx-auto flex items-end gap-2.5 relative">
                  <div className="flex-1 bg-muted/40 rounded-xl border border-border/30 focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5 transition-all duration-300 flex items-end px-3 py-2.5 shadow-inner group">
                    <div className="flex items-center gap-1 mb-0.5 mr-2 shrink-0">
                      <button
                        onClick={() => setStickerOpen(!stickerOpen)}
                        className={`h-9 w-9 rounded-xl transition-all duration-200 flex items-center justify-center ${stickerOpen ? "text-primary bg-background shadow-sm" : "text-muted-foreground hover:bg-background/80 hover:text-foreground"}`}
                      >
                        <Smile className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-background/80 hover:text-foreground transition-all duration-200 flex items-center justify-center"
                      >
                        <ImageIcon className="h-5 w-5" />
                      </button>
                    </div>
                    
                    <textarea
                      rows={1} style={{ overflow: "hidden" }} onInput={(e) => { e.currentTarget.style.height = "auto"; e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"; }}
                      placeholder={recording ? "Gravando áudio..." : "Digite uma mensagem..."}
                      value={text}
                       onChange={(e) => {
                         const val = e.target.value;
                         setText(val);
                        if (val.endsWith("/")) {
                          setQuickRepliesOpen(true);
                        } else if (quickRepliesOpen && !val.includes("/")) {
                          setQuickRepliesOpen(false);
                        }
                       }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !sending) {
                          e.preventDefault();
                          if (text.trim()) sendText();
                        }
                      }}
                      className="flex-1 min-h-[40px] max-h-32 bg-transparent border-none outline-none shadow-none resize-none transition-all py-2 px-0 text-[14px] leading-relaxed"
                      disabled={recording || sending}
                    />

                    <div className="flex items-center gap-1 mb-0.5 ml-2 shrink-0">
                      {recording ? (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                          <span className="text-[11px] font-black text-destructive animate-pulse font-mono tracking-tighter bg-destructive/10 px-2 py-1 rounded-lg">
                            {format(recordSecs * 1000, "mm:ss")}
                          </span>
                          <button 
                            onClick={() => stopRecording(true)} 
                            className="h-9 w-9 rounded-xl bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center text-destructive transition-colors shadow-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-background/80 hover:text-foreground transition-all duration-200 flex items-center justify-center"
                        >
                          <Mic className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={recording ? () => stopRecording(false) : sendText}
                    disabled={(!text.trim() && !recording) || sending}
                    className={`h-[52px] w-[52px] rounded-2xl transition-all duration-500 flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 group/send ${recording ? "bg-emerald-500 text-white animate-pulse" : "bg-primary text-primary-foreground disabled:opacity-50 disabled:grayscale"}`}
                  >
                    {sending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : recording ? (
                      <Send className="h-5 w-5" />
                    ) : (
                      <Send className="h-5 w-5 transition-transform duration-300 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5" />
                    )}
                  </button>

                  {/* Overlay de Encaminhamento */}
                  {isForwarding && forwardMsg && (
                    <div className="absolute inset-0 z-[100] bg-background/95 backdrop-blur-xl animate-in fade-in duration-300 flex flex-col p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                          <Forward className="h-4 w-4 text-primary" /> Encaminhar Mensagem
                        </h3>
                        <button onClick={() => { setIsForwarding(false); setForwardMsg(null); }} className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="bg-muted/20 border border-border/10 rounded-2xl p-4 mb-6 text-xs italic text-muted-foreground line-clamp-3">
                        "{forwardMsg.content}"
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        <p className="text-[10px] font-black text-muted-foreground uppercase mb-3 ml-1">Selecione o destino</p>
                        {items.filter(c => c.id !== selected.id).map(c => (
                          <button
                            key={c.id}
                            onClick={async () => {
                              const target = c;
                              setIsForwarding(false);
                              setForwardMsg(null);
                              toast.promise(
                                (async () => {
                                  // Re-use existing logic but for target
                                  let jid = target.remote_jid || target.contact_phone;
                                  if (!jid.includes("@")) {
                                    jid = target.is_group ? `${jid}@g.us` : `${jid}@s.whatsapp.net`;
                                  }
                                  const res = await fetch(`/api/evolution/message/sendText/${resolvedInstance}`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      number: jid,
                                      text: forwardMsg.content,
                                      delay: 1200,
                                      presence: "composing",
                                      linkPreview: true
                                    }),
                                  });
                                  if (!res.ok) throw new Error("Erro ao encaminhar");
                                  syncFromWhatsApp(false);
                                })(),
                                { loading: "Encaminhando...", success: "Encaminhado com sucesso!", error: "Erro ao encaminhar" }
                              );
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border/10 transition-all text-left"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-[10px] bg-primary text-white">{(c.contact_name || c.contact_phone).slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-bold truncate">{c.contact_name || c.contact_phone}</span>
                            <Plus className="h-3 w-3 ml-auto text-muted-foreground/30" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                   {/* Respostas Rápidas */}
                   {quickRepliesOpen && (
                     <div className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-popover/95 backdrop-blur-xl border border-border/20 rounded-2xl shadow-2xl p-2 w-[300px] animate-in slide-in-from-bottom-2 duration-200">
                       <div className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest mb-2 px-2 py-1">Respostas Rápidas</div>
                       <div className="space-y-1">
                         {QUICK_REPLIES.map((r) => (
                           <button
                             key={r.shortcut}
                             onClick={() => {
                               setText(r.text);
                               setQuickRepliesOpen(false);
                             }}
                             className="w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                           >
                             <div className="text-[11px] font-bold text-primary">{r.shortcut}</div>
                             <div className="text-[12px] text-muted-foreground truncate">{r.text}</div>
                           </button>
                         ))}
                       </div>
                     </div>
                   )}

                    {/* Stickers Popover Estilizado */}
                    {stickerOpen && (
                      <div className="absolute bottom-[calc(100%+12px)] left-0 z-50 bg-popover/95 backdrop-blur-xl border border-border/20 rounded-[24px] shadow-2xl p-4 w-[320px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <span className="text-[11px] font-black text-muted-foreground/60 uppercase tracking-widest">Emojis & Stickers</span>
                        <button onClick={() => setStickerOpen(false)} className="h-6 w-6 rounded-full hover:bg-muted transition-colors flex items-center justify-center">
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="grid grid-cols-5 gap-2 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                        {STICKERS.map((s) => (
                          <button
                            key={s}
                            onClick={() => sendSticker(s)}
                            className="text-2xl h-12 flex items-center justify-center rounded-xl hover:bg-muted transition-all duration-200 hover:scale-110 active:scale-90"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) sendImageFile(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 grid place-items-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          )}
        </div>
      </div>
    </div>
  );
}