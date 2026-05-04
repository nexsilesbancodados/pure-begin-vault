import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
 import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
    import { Loader2, Plus, Search, Filter, LayoutGrid, List, ArrowUpDown, TrendingUp, MessageSquare, MessageCircle, X, Send, Bot, User, UserCog, PauseCircle, PlayCircle, RefreshCw, ChevronRight, Sparkles, CreditCard, Users, Clock, Wifi, Image as ImageIcon, Smile, Type, Pencil, Download, Crop, Tag, FileText } from "lucide-react";
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
  instance_name?: string | null;
 };
 
 import { StageColumn } from "@/components/funil/StageColumn";
import { AddDealDialog } from "@/components/funil/AddDealDialog";
import { AddStageDialog } from "@/components/funil/AddStageDialog";
import { PipelineTabs } from "@/components/pipeline/PipelineTabs";

 import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/funil")({
  head: () => ({
    meta: [
      { title: "Funil de Vendas — ConectaCRM" },
      { name: "description", content: "Gerencie seus leads em um Kanban intuitivo inspirado no Kommo." },
    ],
  }),
  component: FunnelPage,
});

type Stage = { id: string; name: string; color: string | null; order_index: number };
type Deal = {
  id: string;
  lead_id: string;
  stage_id: string;
  deal_value: number;
  priority: string | null;
  last_message?: string;
  last_message_at?: string;
  last_message_role?: "user" | "assistant" | "agent";
   lead?: {
     name: string;
     phone: string | null;
     source: string | null;
     avatar_url?: string | null;
   }
};

  const normalizePhone = (p: string | null) => {
    if (!p) return "";
    // Remove tudo que não é dígito e remove o sufixo do whatsapp se existir
    return p.split("@")[0].replace(/\D/g, "");
  };
 
 function FunnelPage() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [syncing, setSyncing] = useState(false);
   const syncLockRef = useRef(false);
   const webhookCheckedRef = useRef<string | null>(null);

   const resolveInstance = async () => {
     if (!user?.id) return null;

     const statusPriority = ["open", "connected", "active", "online", "connecting"];
     const [{ data: settings, error: settingsError }, { data: savedInstances, error: instancesError }] = await Promise.all([
       supabase.from("bot_settings").select("whatsapp_instance, webhook_secret").eq("user_id", user.id).maybeSingle(),
       supabase
         .from("whatsapp_instances")
         .select("instance_name, status, created_at")
         .eq("user_id", user.id)
         .order("created_at", { ascending: false }),
     ]);

     if (settingsError) throw settingsError;
     if (instancesError) throw instancesError;

     const configured = settings?.whatsapp_instance?.trim();
     if (configured) return configured;

     const dbCandidate = (savedInstances ?? []).find((instance: any) =>
       statusPriority.includes(String(instance.status ?? "").toLowerCase())
     )?.instance_name;

     if (dbCandidate) {
       await supabase.from("bot_settings").upsert({ user_id: user.id, whatsapp_instance: dbCandidate }, { onConflict: "user_id" });
       return dbCandidate;
     }

     const remoteInstances = await evolution.getInstances();
     const remoteCandidate =
       remoteInstances.find((instance) => statusPriority.includes(String(instance.status ?? "").toLowerCase()))?.instanceName ??
       remoteInstances[0]?.instanceName ??
       null;

     if (remoteCandidate) {
       await supabase.from("bot_settings").upsert({ user_id: user.id, whatsapp_instance: remoteCandidate }, { onConflict: "user_id" });
     } else if (!settings) {
       await supabase.from("bot_settings").upsert({ user_id: user.id }, { onConflict: "user_id" });
     }

     return remoteCandidate;
   };

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
         const { data: inserted, error: insertError } = await supabase
           .from("bot_settings")
           .insert({ user_id: user.id, whatsapp_instance: instance })
           .select()
           .single();

         if (insertError) throw insertError;
         settings = inserted;
       }

       const secret = settings?.webhook_secret;
       const projectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined) ?? null;
       if (!secret || !projectRef) return;

       const expectedUrl = `https://${projectRef}.supabase.co/functions/v1/bot-webhook?uid=${user.id}&secret=${secret}`;
       const current = await evolution.getWebhook(instance);
       const currentUrl = current?.url ?? current?.webhook?.url ?? "";

       webhookCheckedRef.current = instance;
       if (currentUrl === expectedUrl) return;

       await evolution.setWebhook(instance, expectedUrl);
       console.log("Webhook sincronizado no Funil:", expectedUrl);
     } catch (e) {
       webhookCheckedRef.current = null;
       console.warn("Erro ao sincronizar webhook no Funil:", e);
     }
   };

    const syncFromWhatsApp = async (showToast = true, resetPipeline = false) => {
      if (!user?.id || syncLockRef.current) return;

     syncLockRef.current = true;
     setSyncing(true);

      try {
        const instance = activeInstance;
        if (!instance) {
          if (showToast) toast.error("Nenhuma instância do WhatsApp conectada");
          return;
        }

        if (resetPipeline) {
          const { error: resetError } = await supabase
            .from("pipeline_leads")
            .delete()
            .eq("user_id", user.id)
            .eq("instance_name", instance);
          
          if (resetError) {
            console.error("Erro ao resetar pipeline:", resetError);
            toast.error("Erro ao limpar pipeline antes da sincronização");
          } else {
            setDeals([]); // Limpa localmente para feedback visual imediato
            toast.info("Pipeline resetado. Iniciando sincronização completa...");
          }
        }

       await ensureWebhook(instance);

        let existingQuery = supabase
          .from("bot_conversations")
          .select("id, contact_phone, contact_name, transcript, status, last_message_at, instance_name")
          .eq("user_id", user.id);
        
        const { data: existingRows, error: existingError } = await existingQuery
          .order("last_message_at", { ascending: false });

       if (existingError) throw existingError;

       const existingByPhone = new Map(
         ((existingRows as any[]) ?? []).map((row) => [normalizePhone(row.contact_phone), row])
       );

        let chats: any[] = [];
        try {
          const rawChats = await evolution.findChats(instance);
          chats = Array.isArray(rawChats) ? rawChats : (rawChats?.records || rawChats?.chats || []);
        } catch (e) {
          console.warn("Falha ao buscar chats via Evolution API:", e);
        }

        if (!Array.isArray(chats) || chats.length === 0) {
          // Se não houver chats remotos, apenas tentamos carregar o que já temos no banco
          await load(true);
          if (showToast) toast.info("Sincronização concluída (apenas dados locais)");
          return;
        }

        const validChats = chats
          .filter((chat: any) => {
            const remoteJid = chat.remoteJid || chat.id || "";
            return remoteJid && !remoteJid.endsWith("@g.us");
          })
          .slice(0, 50);

        const upsertRows = validChats.map((chat: any): any => {
          const remoteJid = chat.remoteJid || chat.id || "";
          const phone = normalizePhone(remoteJid);
          const existing = existingByPhone.get(phone);


          const lastMsg = chat.lastMessage;
          const fallbackContent =
            lastMsg?.message?.conversation ||
            lastMsg?.message?.extendedTextMessage?.text ||
            existing?.transcript?.[existing.transcript.length - 1]?.content ||
            "Nova conversa";

          const previewTranscript = Array.isArray(existing?.transcript) && existing.transcript.length > 0
            ? existing.transcript
            : [{
                role: lastMsg?.key?.fromMe ? "assistant" : "user",
                content: fallbackContent,
                at: new Date(lastMsg?.messageTimestamp ? lastMsg.messageTimestamp * 1000 : Date.now()).toISOString(),
              }];

          const lastAt =
            previewTranscript[previewTranscript.length - 1]?.at ||
            existing?.last_message_at ||
            new Date().toISOString();

          return {
            ...(existing?.id ? { id: existing.id } : {}),
            user_id: user.id,
            contact_phone: phone,
            contact_name: (() => {
              const rawName = chat.pushName || chat.name || chat.verifiedName;
              const phone = normalizePhone(chat.remoteJid || chat.id || "");
              
              // Filtro defensivo agressivo no frontend para nomes "bugados"
              const isBuggy = !rawName || 
                             rawName === phone || 
                             /^[a-zA-Z0-9]{15,}$/.test(rawName) || 
                             /^\d+$/.test(rawName) ||
                             /cmonb/i.test(rawName) ||
                             /@g\.us/i.test(rawName) ||
                             /[a-f0-9]{8}-[a-f0-9]{4}/.test(rawName);
                             
              return isBuggy ? (existing?.contact_name || null) : rawName;
            })(),
            transcript: previewTranscript,
            status: existing?.status ?? "active",
            messages_count: previewTranscript.length,
            last_message_at: lastAt,
            instance_name: instance || (existing as any)?.instance_name || null,
          };
        }).filter(Boolean);

       if (upsertRows.length === 0) {
         if (showToast) toast.info("Nenhuma conversa válida encontrada");
         return;
       }

       const { error: upsertError } = await supabase
         .from("bot_conversations")
         .upsert(upsertRows as any[], { onConflict: "user_id,contact_phone" });

       if (upsertError) throw upsertError;

        const validUpsertRows = (upsertRows as any[]).filter(row => row !== null);
        
        const syncLeads = async () => {
          for (const row of validUpsertRows) {
            try {
              let profilePic = null;
              try {
                profilePic = await evolution.fetchProfilePictureUrl(instance, row.contact_phone);
              } catch (e) {
                console.warn("Não foi possível buscar foto para:", row.contact_phone);
              }

               // Usamos a função RPC para garantir a sincronização atômica e correta do nome
               await supabase.rpc("ensure_lead_and_pipeline_from_conversation", {
                 _user_id: user.id,
                 _phone: row.contact_phone,
                 _name: row.contact_name,
                 _instance_name: instance,
                 _avatar_url: profilePic
               } as any);
            } catch (e) {
              console.error("Erro ao processar lead individual:", row.contact_phone, e);
            }
          }
        };

        await syncLeads();

       await load(true);
       if (showToast) toast.success("Sincronização concluída");
     } catch (err: any) {
       console.error("Erro na sincronização:", err);
       if (showToast) toast.error("Erro ao sincronizar WhatsApp: " + err.message);
     } finally {
       syncLockRef.current = false;
       setSyncing(false);
     }
   };

     const [activeInstance, setActiveInstance] = useState<string | null>(() => {
       const saved = localStorage.getItem("last_active_instance");
       return (saved === 'undefined' || saved === 'null') ? null : saved;
     });
    const [availableInstances, setAvailableInstances] = useState<any[]>([]);

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

     const handleInstanceChange = async (newInstance: string) => {
       if (!user?.id) return;
       setActiveInstance(newInstance);
       localStorage.setItem("last_active_instance", newInstance);
       
       setLoading(true);
       // Clear current deals to avoid showing data from the old instance
       setDeals([]);
 
       try {
         await supabase.from("bot_settings").upsert(
           { user_id: user.id, whatsapp_instance: newInstance },
           { onConflict: "user_id" }
         );
         
         toast.success(`Instância alterada para ${newInstance}`);
         
         // Small delay to allow the update to propagate if needed, then load and sync
         setTimeout(async () => {
           await load(false);
           await syncFromWhatsApp(false);
         }, 100);
       } catch (e) {
         toast.error("Erro ao trocar de instância");
         setLoading(false);
       }
     };

    const [viewMode, setViewMode] = useState<"kanban" | "chat">("kanban");
   const [stages, setStages] = useState<Stage[]>([]);
   const [deals, setDeals] = useState<Deal[]>([]);
   const [leads, setLeads] = useState<{ id: string; name: string; phone?: string | null }[]>([]);
   const [conversations, setConversations] = useState<Conversation[]>([]);
   const [statusFilter, setStatusFilter] = useState<"all" | "bot" | "manual" | "unread" | "pending">("all");
   const [loading, setLoading] = useState(true);
   const [dragId, setDragId] = useState<string | null>(null);
   const [adding, setAdding] = useState<{ stage_id: string; initial: boolean } | null>(null);
  const [addingStage, setAddingStage] = useState(false);
     const [searchTerm, setSearchTerm] = useState("");
     const [sortBy, setSortBy] = useState<"recent" | "value" | "whatsapp">("recent");
   const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
   const [chatOpen, setChatOpen] = useState(false);
   const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
   const [chatLoading, setChatLoading] = useState(false);
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [dealTags, setDealTags] = useState<string[]>([]);
    const [dealNotes, setDealNotes] = useState("");
    const [editingDeal, setEditingDeal] = useState<any>(null);
    const [tagInput, setTagInput] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const addStage = () => setAddingStage(true);

    const deleteStage = async (id: string) => {
      if (!confirm("Tem certeza que deseja remover esta etapa? Todas as negociações nela serão perdidas.")) return;
      const { error } = await supabase.from("funnel_stages").delete().eq("id", id);
      if (error) toast.error("Erro ao remover etapa: " + error.message);
      else load();
    };
   const loadConversation = async (phone: string) => {
     if (!user?.id || !phone) return;
     setChatLoading(true);
     try {
       // Normaliza: tira tudo que não é dígito
       const normalized = phone.replace(/\D/g, "");
       // Tenta exato primeiro, depois por sufixo (cobre variações com/sem DDI)
       let { data, error } = await supabase
         .from("bot_conversations")
         .select("*")
         .eq("user_id", user.id)
         .or(`contact_phone.eq.${normalized},contact_phone.eq.${phone},contact_phone.like.%${normalized.slice(-10)}`)
         .order("last_message_at", { ascending: false })
         .limit(1)
         .maybeSingle();

       if (error) throw error;
       if (data) {
          const conv = data as any as Conversation;
           const lead = leads.find(l => normalizePhone(l.phone || null) === normalizePhone(conv.contact_phone));
          if (lead && lead.name && !lead.name.startsWith("Lead WhatsApp ")) {
            conv.contact_name = lead.name;
          }
          setCurrentConversation(conv);
       } else {
         // Cria uma conversa vazia local pra permitir enviar a primeira mensagem
         setCurrentConversation({
           id: "",
           user_id: user.id,
           contact_phone: normalized,
           contact_name: null,
           transcript: [],
           status: "active",
           messages_count: 0,
           last_message_at: new Date().toISOString(),
         } as any as Conversation);
       }
     } catch (err) {
       console.error("Erro ao carregar conversa:", err);
       toast.error("Erro ao carregar conversa");
     } finally {
       setChatLoading(false);
     }
   };
 
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

    const sendMessage = async () => {
      if (!currentConversation || (!messageText.trim() && !selectedImage) || sending) return;
     setSending(true);
      try {
        let body: any = {
          phone: currentConversation.contact_phone,
          text: messageText.trim(),
          contactName: currentConversation.contact_name,
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
        setMessageText("");
        clearImage();
        loadConversation(currentConversation.contact_phone);
      } catch (e: any) {
       toast.error(e?.message ?? "Erro ao enviar");
     } finally {
       setSending(false);
     }
   };
 
   const toggleHandoff = async () => {
     if (!currentConversation) return;
     const newStatus = currentConversation.status === "handed_off" ? "active" : "handed_off";
     const { error } = await supabase
       .from("bot_conversations")
       .update({ status: newStatus })
       .eq("id", currentConversation.id);
     
     if (error) toast.error(error.message);
     else {
       toast.success(newStatus === "handed_off" ? "Bot pausado" : "Bot reativado");
       loadConversation(currentConversation.contact_phone);
     }
   };
 
   useEffect(() => {
     if (chatOpen && currentConversation) {
       const timer = setTimeout(() => {
         scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
       }, 100);
       return () => clearTimeout(timer);
     }
   }, [chatOpen, currentConversation?.transcript?.length]);
 
   useEffect(() => {
     if (!user?.id || !chatOpen || !currentConversation) return;
     
     const ch = supabase
       .channel("funil_chat:" + currentConversation.contact_phone)
       .on(
         "postgres_changes",
         { 
           event: "UPDATE", 
           schema: "public", 
           table: "bot_conversations", 
           filter: `id=eq.${currentConversation.id}` 
         },
         (payload) => {
           setCurrentConversation(payload.new as any as Conversation);
         }
       )
       .subscribe();
       
     return () => { supabase.removeChannel(ch); };
   }, [user?.id, chatOpen, currentConversation?.id]);
 
    // Realtime unificado para sicronização em tempo real das mensagens e pipeline
    useEffect(() => {
      if (!user?.id) return;

      const ch = supabase
        .channel(`funil_realtime_sync:${user.id}:${activeInstance || 'no-instance'}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bot_conversations", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (payload.eventType === "DELETE") {
               load(true);
               return;
            }
            
            const conv = payload.new as any;
            // Apenas reage se for da instância ativa (ou se não houver filtro de instância)
            if (!activeInstance || conv.instance_name === activeInstance) {
              if (currentConversation?.id === conv.id) {
                setCurrentConversation(conv);
              }
              load(true);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pipeline_leads", filter: `user_id=eq.${user.id}` },
          (payload: any) => {
            if (payload.eventType === "DELETE") {
               load(true);
               return;
            }
            const deal = payload.new as any;
            if (!activeInstance || deal.instance_name === activeInstance) {
              load(true);
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` },
          () => load(true)
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "leads", filter: `user_id=eq.${user.id}` },
          () => load(true)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ch);
      };
    }, [user?.id, currentConversation?.id, activeInstance]);

    // Dedupe defensivo: nunca renderiza dois cards com mesmo id ou mesmo lead_id
    const dedupedDeals = (() => {
      const seenId = new Set<string>();
      const seenLead = new Set<string>();
      const out: typeof deals = [];
      for (const d of deals) {
        if (!d?.id || seenId.has(d.id)) continue;
        if (d.lead_id && seenLead.has(d.lead_id)) continue;
        seenId.add(d.id);
        if (d.lead_id) seenLead.add(d.lead_id);
        out.push(d);
      }
      return out;
    })();

     const filteredDeals = dedupedDeals
        .filter((d: any) => {
          // Filter by active instance visual check
          if (activeInstance && activeInstance !== "none" && d.instance_name && d.instance_name !== activeInstance) {
            return false;
          }

          const leadName = d.lead?.name?.toLowerCase() || "";
         const leadPhone = d.lead?.phone || "";
         const search = searchTerm.toLowerCase();
         return leadName.includes(search) || leadPhone.includes(searchTerm);
       })
       .sort((a, b) => {
         if (sortBy === "value") return Number(b.deal_value || 0) - Number(a.deal_value || 0);
         if (sortBy === "whatsapp") {
           const hasA = a.lead?.source === 'whatsapp' ? 1 : 0;
           const hasB = b.lead?.source === 'whatsapp' ? 1 : 0;
           if (hasA !== hasB) return hasB - hasA;
         }
         // Default to recent (last message or creation date)
          const dateA = a.last_message_at || (a as any).updated_at || (a as any).created_at || "";
          const dateB = b.last_message_at || (b as any).updated_at || (b as any).created_at || "";
         return new Date(dateB).getTime() - new Date(dateA).getTime();
       });
 
   const totalPipeline = deals.reduce((sum, d) => sum + Number(d.deal_value ?? 0), 0);

   const saveDealDetails = async () => {
     if (!editingDeal || !user?.id) return;
     try {
       const { error } = await supabase
         .from("pipeline_leads")
         .update({
           tags: dealTags,
           notes: dealNotes
         })
         .eq("id", editingDeal.id);

       if (error) throw error;
       toast.success("Detalhes salvos com sucesso!");
       load(true);
     } catch (err: any) {
       toast.error("Erro ao salvar detalhes: " + err.message);
     }
   };

   const addTag = () => {
     if (!tagInput.trim()) return;
     if (dealTags.includes(tagInput.trim())) {
       setTagInput("");
       return;
     }
     setDealTags([...dealTags, tagInput.trim()]);
     setTagInput("");
   };

   const removeTag = (tag: string) => {
     setDealTags(dealTags.filter(t => t !== tag));
   };

   const handleSelectDeal = (deal: any) => {
     setEditingDeal(deal);
     setDealTags(deal.tags || []);
     setDealNotes(deal.notes || "");
     loadConversation(deal.lead?.phone || "");
     setChatOpen(true);
   };

   const load = async (silent = false, retryCount = 0) => {
     if (!user?.id) {
       if (!authLoading) setLoading(false);
       return;
     }
     
      try {
        if (!silent) setLoading(true);
        
        // Inicializa configurações do bot e estágios
        const { data: settings } = await supabase.from("bot_settings").select("id").eq("user_id", user.id).maybeSingle();
        if (!settings) {
          await supabase.from("bot_settings").insert({ user_id: user.id });
        }
        
      // Garante que o usuário tenha as etapas padrão profissionais
      try {
        await supabase.rpc("ensure_default_funnel_stages", { _user_id: user.id });
      } catch (e) {
        console.warn("ensure_default_funnel_stages falhou:", e);
      }

      const currentInstance = activeInstance;
      
      fetchAvailableInstances();

         const stQuery = supabase.from("funnel_stages").select("*").eq("user_id", user.id).order("order_index");
        const ldQuery = supabase.from("leads").select("id, name, phone, avatar_url").eq("user_id", user.id).order("created_at", { ascending: false });
        
         // Busca leads do pipeline filtrados estritamente pela instância ativa
         let dlQuery = supabase.from("pipeline_leads")
           .select("*, lead:leads(name, phone, source, avatar_url)")
           .eq("user_id", user.id);
 
          // Busca conversas filtradas estritamente pela instância ativa
          let convQuery = supabase.from("bot_conversations")
            .select("*")
            .eq("user_id", user.id);
  
          // Always filter by instance to keep view consistency, unless "none" is selected explicitly
          if (currentInstance && currentInstance !== "none") {
            dlQuery = dlQuery.eq("instance_name", currentInstance);
            convQuery = convQuery.eq("instance_name", currentInstance);
          }
 
         dlQuery = dlQuery.order("created_at", { ascending: false });
         convQuery = convQuery.order("last_message_at", { ascending: false });

        const [stRes, dlRes, ldRes, convRes] = await Promise.all([
          stQuery,
          dlQuery,
          ldQuery,
          convQuery
        ]);

       if (stRes.error) {
         console.error("Erro ao carregar estágios:", stRes.error);
         toast.error("Erro ao carregar estágios");
       }
       if (dlRes.error) {
         console.error("Erro ao carregar negociações:", dlRes.error);
         toast.error("Erro ao carregar negociações");
       }
       
       const stageData = (stRes.data as Stage[]) ?? [];
       
       // Se não houver estágios, tenta garantir os estágios padrão e recarrega uma vez
       if (stageData.length === 0 && retryCount < 1) {
         console.log("Nenhum estágio encontrado, tentando criar estágios padrão...");
         await supabase.rpc("ensure_default_funnel_stages", { _user_id: user.id });
         return load(silent, retryCount + 1);
       }
       
       setStages(stageData);
      const convs = (convRes.data as any as Conversation[]) ?? [];
      setConversations(convs);
      
      const leadIds = (dlRes.data as any[])?.map(d => d.lead_id) || [];
      let lastMessagesMap: Record<string, { content: string, created_at: string, role?: any }> = {};
      
      if (leadIds.length > 0) {
        const filteredLeadIds = leadIds.filter(Boolean);
        if (filteredLeadIds.length > 0) {
          const { data: msgData } = await supabase.from("messages").select("lead_id, content, created_at, direction").in("lead_id", filteredLeadIds).order("created_at", { ascending: false });
          if (msgData) msgData.forEach(msg => { 
            if (msg.lead_id && !lastMessagesMap[msg.lead_id]) {
              // Normalize role: inbound -> user, outbound -> agent
              lastMessagesMap[msg.lead_id] = { 
                content: msg.content, 
                created_at: msg.created_at, 
                role: (msg as any).direction === 'inbound' ? 'user' : 'agent' 
              }; 
            }
          });
        }
      }
      
        const dealsWithLastMessage = (dlRes.data as any[])?.map((deal: any) => {
          const dealPhone = normalizePhone(deal.lead?.phone);
          const conv = convs.find(c => normalizePhone(c.contact_phone) === dealPhone || c.contact_phone === dealPhone);
          let lastMessage = deal.lead_id ? lastMessagesMap[deal.lead_id]?.content : undefined;
          let lastMessageAt = deal.lead_id ? lastMessagesMap[deal.lead_id]?.created_at : undefined;
          let lastMessageRole = deal.lead_id ? lastMessagesMap[deal.lead_id]?.role : undefined;
 
         // Prioritize data from bot_conversations for WhatsApp leads
         if (conv) {
           const transcript = conv.transcript as Msg[];
           if (transcript && transcript.length > 0) {
              const last = transcript[transcript.length - 1];
              lastMessage = last.content;
             lastMessageAt = conv.last_message_at;
              lastMessageRole = last.role;
           }
         }
 
         return {
           ...deal,
           last_message: lastMessage,
            last_message_at: lastMessageAt,
            last_message_role: lastMessageRole
         };
       }) ?? [];
      
      // Dedupe por lead_id — mantém apenas o card mais recente por lead
      const seenLead = new Set<string>();
       // Garante que todos os deals tenham um stage_id válido antes de setar
       const uniqueDeals = dealsWithLastMessage
         .filter((d: any) => {
           if (!d.lead_id) return true;
           if (seenLead.has(d.lead_id)) return false;
           seenLead.add(d.lead_id);
           return true;
         })
         .map(d => {
           // Fallback para o primeiro estágio se stage_id for inválido ou nulo
           if (!d.stage_id || !stageData.some(s => s.id === d.stage_id)) {
             return { ...d, stage_id: stageData[0]?.id };
           }
           return d;
         });
         
       setDeals(uniqueDeals.filter(d => d.stage_id)); // Apenas deals com stage
      const loadedLeads = (ldRes.data as any) ?? [];
      setLeads(loadedLeads);

       // A criação automática de leads e negócios agora é feita via gatilho no banco (handle_new_bot_conversation)
       // para garantir sincronização instantânea sem depender de lógica no frontend.
    } catch (err) {
      console.error("Erro no load:", err);
      toast.error("Erro ao carregar dados do funil");
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
      if (!authLoading && !user) {
        navigate({ to: "/login" });
      }
    }, [authLoading, user, navigate]);

    useEffect(() => {
      if (authLoading) return;
      load();
      // Removemos o poller automático e o sync on visibility para evitar loop de sincronização infinito
      // A sincronização manual via botão "Sincronizar WhatsApp" é preferida para controle do usuário.
      
      // Auto-sincronização ao carregar a página se houver uma instância ativa
      const autoSync = async () => {
        const instance = activeInstance || await resolveInstance();
        if (instance) {
          console.log("Iniciando auto-sincronização para instância:", instance);
          syncFromWhatsApp(false);
        }
      };
      
      autoSync();

      // Timeout de segurança: garante que o loading termine mesmo se algo travar
      const safety = setTimeout(() => setLoading(false), 8000);
      return () => {
        clearTimeout(safety);
      };
    }, [user?.id, authLoading, activeInstance]);

  const moveDeal = async (dealId: string, newStageId: string) => {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage_id: newStageId } : d)));
    const { error } = await supabase.from("pipeline_leads").update({ stage_id: newStageId }).eq("id", dealId);
    if (error) { toast.error(error.message); load(); }
  };

  const removeDeal = async (id: string) => {
    if (!confirm("Remover esta negociação?")) return;
    const { error } = await supabase.from("pipeline_leads").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

   return (
      <div className="min-h-screen flex w-full bg-background overflow-hidden relative">
       <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
         <Topbar title="Pipeline de Vendas" subtitle="Gerencie leads e oportunidades em um só lugar" />
          <main className="flex-1 overflow-hidden flex flex-col bg-muted/5">
            <div className="px-6 pt-4">
              <PipelineTabs />
            </div>
            {/* Stats Summary Panel */}
            <div className="px-6 py-4 bg-background border-b border-border/40 grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/10 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70">Total em Pipeline</p>
                   <p className="text-xl font-black text-primary leading-none mt-1">{fmt(totalPipeline)}</p>
                </div>
              </div>
              
               <div className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-2xl p-4 border border-border/50 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-background flex items-center justify-center text-muted-foreground">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Total de Leads</p>
                   <p className="text-xl font-black text-foreground leading-none mt-1">{deals.length}</p>
                </div>
              </div>

               <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 rounded-2xl p-4 border border-amber-500/10 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/70">Aguardando Resposta</p>
                   <p className="text-xl font-black text-amber-600 leading-none mt-1">{deals.filter(d => d.last_message_at && (new Date().getTime() - new Date(d.last_message_at).getTime() > 24 * 60 * 60 * 1000)).length}</p>
                </div>
              </div>

               <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-2xl p-4 border border-green-500/10 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-green-700/70">Taxa de Conversão</p>
                   <p className="text-xl font-black text-green-600 leading-none mt-1">12.5%</p>
                </div>
              </div>
            </div>

            {/* Toolbar Superior Melhorada */}
            <div className="px-6 py-4 border-b border-border/40 bg-background/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Buscar lead ou telefone..." 
                    className="pl-9 w-72 bg-muted/30 border-transparent focus:bg-background focus:border-primary/30 transition-all text-sm h-10 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/20">
                    <div className="flex items-center gap-1 bg-primary/10 p-1 rounded-xl border border-primary/20 shadow-sm">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        disabled={syncing}
                        className={cn("h-8 px-3 gap-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all", syncing ? "bg-primary/20 text-primary animate-pulse" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm")}
                        onClick={() => syncFromWhatsApp(true, true)}
                      >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
                        {syncing ? "Sincronizando..." : "Sincronizar WhatsApp"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={loading || syncing}
                        className="h-8 w-8 rounded-lg hover:bg-primary/20 text-primary font-bold"
                        onClick={() => {
                          toast.info("Recarregando pipeline...");
                          load(false);
                        }}
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-3 gap-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all hover:bg-destructive/10 hover:text-destructive text-muted-foreground" 
                      onClick={async () => { 
                        if (!user?.id) return; 
                         if (!confirm("Tem certeza que deseja apagar todos os cards (negociações) deste pipeline?")) return;
                         setLoading(true);
                         try {
                           let dealQuery = supabase.from("pipeline_leads").delete().eq("user_id", user.id);
                           let convQuery = supabase.from("bot_conversations").delete().eq("user_id", user.id);
                           
                           if (activeInstance) {
                             dealQuery = dealQuery.eq("instance_name", activeInstance);
                             convQuery = convQuery.eq("instance_name", activeInstance);
                           }
                           
                           const [{ error: dealError }, { error: convError }] = await Promise.all([
                             dealQuery,
                             convQuery
                           ]);
                           
                           if (dealError) throw dealError;
                           if (convError) throw convError;
                           
                           toast.success("Pipeline da instância limpo com sucesso");
                           await load(true);
                         } catch (err: any) {
                           console.error("Erro ao excluir cards:", err);
                           toast.error("Erro ao excluir cards");
                         } finally {
                           setLoading(false);
                         }
                      }} 
                    > 
                      <X className="h-3 w-3" /> 
                       Excluir Cards 
                    </Button>
                    <div className="w-[180px]">
                      <Select
                        value={activeInstance || ""}
                        onValueChange={handleInstanceChange}
                      >
                        <SelectTrigger className="h-9 bg-background border-border hover:border-primary/50 hover:bg-muted/50 transition-all rounded-xl px-3 shadow-sm">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] shrink-0 animate-pulse" />
                            <SelectValue placeholder="Selecionar Instância" className="text-xs font-bold" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] rounded-2xl border-border/50 shadow-2xl">
                          <SelectItem value="none" className="text-[10px] py-3 opacity-50">
                            <div className="flex items-center gap-2 italic">
                              <X className="h-2 w-2" />
                              Sem Instância (Ver Tudo)
                            </div>
                          </SelectItem>
                          {availableInstances.length === 0 ? (
                            <div className="p-4 text-center">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Nenhuma instância ativa</p>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-[9px] font-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fetchAvailableInstances();
                                }}
                              >
                                <RefreshCw className="h-3 w-3 mr-1" /> Atualizar Lista
                              </Button>
                            </div>
                          ) : (
                            availableInstances.map((ins) => (
                              <SelectItem key={ins.instanceName} value={ins.instanceName} className="text-[10px] py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.4)]" />
                                  <span className="font-bold">{ins.instanceName}</span>
                                  <span className="text-[8px] opacity-40">({ins.status})</span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-[1px] h-4 bg-border/40 mx-1" />
                   <Button 
                    variant={sortBy === "recent" ? "secondary" : "ghost"} 
                    size="sm" 
                    className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg"
                    onClick={() => setSortBy("recent")}
                   >
                    Recentes
                   </Button>
                    <Button 
                     variant={sortBy === "value" ? "secondary" : "ghost"} 
                     size="sm" 
                     className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg"
                     onClick={() => setSortBy("value")}
                    >
                     Maior Valor
                    </Button>
                    <Button 
                     variant={sortBy === "whatsapp" ? "secondary" : "ghost"} 
                     size="sm" 
                     className="h-8 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg gap-2"
                     onClick={() => setSortBy("whatsapp")}
                    >
                     <MessageCircle className="h-3 w-3" />
                     WhatsApp
                    </Button>
                </div>
              </div>
  
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">IA Ativa</span>
                </div>
                
                <Button className="h-10 px-6 gap-2 text-xs font-black shadow-lg shadow-primary/20 rounded-xl hover:scale-105 transition-all" onClick={() => setAdding({ stage_id: stages[0]?.id || "", initial: true })}>
                  <Plus className="h-4 w-4" /> NOVO NEGÓCIO
                </Button>
              </div>
            </div>

            {/* Seletor de Visualização */}
            <div className="px-6 py-2 border-b border-border/40 bg-background/50 flex items-center gap-2">
              <Button 
                variant={viewMode === "kanban" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("kanban")}
                className={cn("gap-2 text-xs font-bold rounded-xl", viewMode === "kanban" && "bg-primary/10 text-primary hover:bg-primary/20")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Kanban
              </Button>
              <Button 
                variant={viewMode === "chat" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setViewMode("chat")}
                className={cn("gap-2 text-xs font-bold rounded-xl", viewMode === "chat" && "bg-primary/10 text-primary hover:bg-primary/20")}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Conversas
              </Button>
            </div>
 
            {loading ? (
             <div className="flex-1 grid place-items-center">
               <div className="flex flex-col items-center gap-4">
                 <div className="relative">
                   <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                   <div className="absolute inset-0 grid place-items-center">
                     <TrendingUp className="h-5 w-5 text-primary/50" />
                   </div>
                 </div>
                 <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
                   {viewMode === "kanban" ? "Carregando Funil..." : "Carregando Conversas..."}
                 </p>
               </div>
             </div>
            ) : viewMode === "kanban" ? (
              <div className="flex-1 overflow-x-auto p-6 scrollbar-thin">
                <div className="flex gap-6 h-full min-w-max">
                   {stages.length === 0 ? (
                     <div className="flex-1 flex flex-col items-center justify-center p-12 opacity-50">
                       <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
                       <p className="text-xs font-bold uppercase tracking-widest">Nenhuma etapa encontrada</p>
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="mt-4"
                         onClick={() => user?.id && supabase.rpc("ensure_default_funnel_stages", { _user_id: user.id }).then(() => load())}
                       >
                         Criar etapas padrão
                       </Button>
                     </div>
                   ) : (
                     stages.map((stage) => (
                       <StageColumn
                         key={stage.id}
                         stage={stage}
                         deals={filteredDeals.filter((d) => d.stage_id === stage.id)}
                         onAddDeal={(stageId) => setAdding({ stage_id: stageId, initial: true })}
                         onRemoveDeal={removeDeal}
                         onMoveDeal={moveDeal}
                         dragId={dragId}
                         setDragId={setDragId}
                         onDeleteStage={deleteStage}
                         onSelectDeal={handleSelectDeal}
                       />
                     ))
                   )}
                  
                   {/* Coluna de "Adicionar Etapa" Melhorada */}
                    <div 
                      onClick={addStage}
                      className="w-[310px] shrink-0 h-[calc(100vh-280px)] rounded-2xl border-2 border-dashed border-border/40 flex flex-col items-center justify-center gap-4 opacity-40 hover:opacity-100 hover:border-primary/30 hover:bg-primary/5 transition-all group cursor-pointer"
                    >
                     <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center group-hover:bg-primary/10 group-hover:scale-110 group-hover:rotate-90 transition-all">
                      <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground">Nova Etapa</span>
                  </div>
                </div>
              </div>
            ) : (
              /* View de Chat Integrada */
              <div className="flex-1 flex overflow-hidden bg-background">
                {/* Lista de Conversas */}
                <div className="w-80 border-r border-border flex flex-col bg-card/20">
                  <div className="p-4 border-b border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conversas</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => load()}
                      >
                        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                      </Button>
                    </div>
                     <div className="space-y-2">
                       <div className="relative">
                         <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                         <Input 
                           placeholder="Filtrar conversas..." 
                           className="pl-9 h-9 text-xs bg-muted/50 border-none rounded-lg"
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                         />
                       </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { id: 'all', label: 'Todas' },
                        { id: 'bot', label: 'Bot' },
                        { id: 'manual', label: 'Humano' },
                        { id: 'unread', label: 'Não Lidas' },
                        { id: 'pending', label: 'Pendentes' }
                      ].map((f) => (
                           <button
                             key={f.id}
                             onClick={() => setStatusFilter(f.id as any)}
                             className={cn(
                               "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter transition-all",
                               statusFilter === f.id 
                                 ? "bg-primary text-primary-foreground" 
                                 : "bg-muted text-muted-foreground hover:bg-muted-foreground/10"
                             )}
                           >
                             {f.label}
                           </button>
                         ))}
                       </div>
                     </div>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 hover:scrollbar-thumb-muted-foreground/20">
                    {conversations.length === 0 ? (
                      <div className="p-8 text-center">
                        <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nenhuma conversa</p>
                      </div>
                    ) : (
                      conversations.filter(c => {
                        const matchSearch = !searchTerm || 
                          (c.contact_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
                          c.contact_phone.includes(searchTerm);
                        
                        if (!matchSearch) return false;
                        
                        // Visual instance filter safety check
                        if (activeInstance && activeInstance !== "none" && c.instance_name && c.instance_name !== activeInstance) {
                          return false;
                        }

                        if (statusFilter === "bot") return c.status !== "handed_off";
                        if (statusFilter === "manual") return c.status === "handed_off";
                        if (statusFilter === "unread") return (c.transcript ?? []).some(m => m.role === "user" && !m.sent);
                        if (statusFilter === "pending") return c.transcript?.[c.transcript.length - 1]?.role === "user" && !c.transcript?.[c.transcript.length - 1]?.sent;
                        return true;
                      })
                        .map((conv) => (
                          <button
                            key={conv.id}
                            onClick={() => {
                              setCurrentConversation(conv);
                              setChatOpen(true);
                            }}
                            className={cn(
                              "w-full p-4 flex items-start gap-3 border-b border-border/40 hover:bg-primary/5 transition-all text-left relative group",
                              currentConversation?.id === conv.id ? "bg-primary/10 shadow-inner" : "bg-transparent"
                            )}
                          >
                            {currentConversation?.id === conv.id && (
                              <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                            )}
                            <div className="relative shrink-0">
                              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 grid place-items-center group-hover:scale-105 transition-transform">
                                <User className="h-6 w-6 text-primary" />
                              </div>
                              <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className="text-xs font-black truncate text-foreground">{conv.contact_name || conv.contact_phone}</p>
                                <span className="text-[9px] font-bold text-muted-foreground shrink-0 uppercase">
                                  {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate font-medium">
                                {conv.transcript?.[conv.transcript.length - 1]?.content || "Inicie uma conversa"}
                              </p>
                            </div>
                          </button>
                        ))
                    )}
                  </div>
                </div>

                {/* Área de Chat Principal */}
                <div className="flex-1 flex flex-col bg-muted/5 relative">
                  {imagePreview && (
                    <div className="absolute inset-0 z-[60] bg-[#f0f2f5] flex flex-col animate-in fade-in duration-200">
                      <div className="h-16 px-6 flex items-center justify-between bg-[#f0f2f5]">
                        <div className="flex items-center gap-4">
                          <button onClick={clearImage} className="p-2 hover:bg-black/5 rounded-full transition"><X className="h-5 w-5" /></button>
                          <span className="text-sm font-medium">Enviar imagem</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <button className="p-2 hover:bg-black/5 rounded-full transition"><Crop className="h-5 w-5" /></button>
                          <button className="p-2 hover:bg-black/5 rounded-full transition"><Smile className="h-5 w-5" /></button>
                          <button className="p-2 hover:bg-black/5 rounded-full transition"><Type className="h-5 w-5" /></button>
                          <button className="p-2 hover:bg-black/5 rounded-full transition"><Pencil className="h-5 w-5" /></button>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center p-8 bg-[#e9edef] overflow-hidden">
                        <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain shadow-xl" />
                      </div>
                      <div className="p-4 bg-[#f0f2f5] flex flex-col items-center gap-4">
                        <div className="w-full max-w-3xl relative">
                          <input
                            type="text"
                            placeholder="Adicionar legenda..."
                            className="w-full h-12 pl-4 pr-12 rounded-lg bg-white border-none text-sm outline-none shadow-sm"
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#54656f]"><Smile className="h-5 w-5" /></button>
                        </div>
                        <div className="flex items-center justify-between w-full px-4">
                          <div className="flex gap-2">
                            <div className="w-14 h-14 rounded-lg border-2 border-[#00a884] p-1 bg-white overflow-hidden"><img src={imagePreview} className="w-full h-full object-cover rounded-sm" /></div>
                            <button className="w-14 h-14 rounded-lg border border-dashed border-gray-400 flex items-center justify-center text-gray-500 hover:bg-black/5 transition"><Plus className="h-5 w-5" /></button>
                          </div>
                          <button
                            onClick={sendMessage}
                            disabled={sending}
                            className="w-14 h-14 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                          >
                            {sending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6 fill-current" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentConversation ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                      {/* Header do Chat na View Principal */}
                      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center border border-primary/20">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-foreground">{currentConversation.contact_name || currentConversation.contact_phone}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp Ativo</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={toggleHandoff} className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-wider">
                          {currentConversation.status === "handed_off" ? "Reativar Bot" : "Pausar Bot"}
                        </Button>
                      </div>

                      {/* Mensagens */}
                      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-6 space-y-4">
                        {currentConversation.transcript?.map((m, i) => {
                          const mine = m.role === "agent" || m.sent;
                          return (
                            <div key={i} className={cn("flex flex-col max-w-[70%]", mine ? "ml-auto items-end" : "items-start")}>
                              <div className={cn(
                                "px-4 py-3 rounded-2xl text-sm shadow-sm",
                                mine ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none"
                              )}>
                                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                              </div>
                              {m.at && (
                                <span className="text-[9px] font-bold text-muted-foreground/40 mt-1 uppercase">
                                  {formatDistanceToNow(new Date(m.at), { addSuffix: true, locale: ptBR })}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Input Principal */}
                      <div className="p-6 bg-background border-t border-border">
                        <div className="flex items-end gap-3 bg-muted/30 p-2 rounded-2xl border border-border/50">
                          <div className="flex items-center gap-1 px-1">
                            <button onClick={() => document.getElementById("funil-image-upload-main")?.click()} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                              <ImageIcon className="h-5 w-5" />
                            </button>
                            <input id="funil-image-upload-main" type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                          </div>
                          <textarea
                            placeholder="Escreva sua mensagem..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 px-2 resize-none max-h-32"
                            rows={1}
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                          />
                          <Button size="icon" className="h-11 w-11 rounded-xl shadow-lg shadow-primary/20" onClick={sendMessage} disabled={(!messageText.trim() && !selectedImage) || sending}>
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 grid place-items-center opacity-50">
                      <div className="text-center">
                        <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Selecione uma conversa para começar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
           </main>
 
       {/* Painel Lateral de Chat Refinado */}
       {viewMode === "kanban" && chatOpen && (
         <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[450px] bg-background border-l border-border shadow-[0_0_50px_rgba(0,0,0,0.15)] flex flex-col z-[100] animate-in slide-in-from-right duration-300">
            {imagePreview && (
              <div className="absolute inset-0 z-[110] bg-[#f0f2f5] flex flex-col animate-in fade-in duration-200">
                <div className="h-16 px-6 flex items-center justify-between bg-[#f0f2f5]">
                  <div className="flex items-center gap-4">
                    <button onClick={clearImage} className="p-2 hover:bg-black/5 rounded-full transition"><X className="h-5 w-5" /></button>
                    <span className="text-sm font-medium">Enviar imagem</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="p-1.5 hover:bg-black/5 rounded-full transition"><Crop className="h-4 w-4" /></button>
                    <button className="p-1.5 hover:bg-black/5 rounded-full transition"><Smile className="h-4 w-4" /></button>
                    <button className="p-1.5 hover:bg-black/5 rounded-full transition"><Type className="h-4 w-4" /></button>
                    <button className="p-1.5 hover:bg-black/5 rounded-full transition"><Pencil className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-4 bg-[#e9edef] overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="max-w-full max-h-full object-contain shadow-xl" />
                </div>
                <div className="p-4 bg-[#f0f2f5] flex flex-col items-center gap-4">
                  <div className="w-full relative">
                    <input
                      type="text"
                      placeholder="Adicionar legenda..."
                      className="w-full h-11 pl-4 pr-10 rounded-lg bg-white border-none text-sm outline-none shadow-sm"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#54656f]"><Smile className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <div className="flex gap-2">
                      <div className="w-12 h-12 rounded-lg border-2 border-[#00a884] p-1 bg-white overflow-hidden"><img src={imagePreview} className="w-full h-full object-cover rounded-sm" /></div>
                      <button className="w-12 h-12 rounded-lg border border-dashed border-gray-400 flex items-center justify-center text-gray-500 hover:bg-black/5 transition"><Plus className="h-4 w-4" /></button>
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={sending}
                      className="w-12 h-12 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 fill-current" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* Header do Chat */}
            <div className="px-6 py-4 border-b border-border flex flex-col gap-3 bg-card/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="relative">
                    <div className="h-11 w-11 rounded-2xl bg-primary/10 grid place-items-center shrink-0 border border-primary/20">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    {currentConversation?.status !== "handed_off" && (
                      <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                        <Bot className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate text-foreground tracking-tight">
                      {(currentConversation?.contact_name && currentConversation?.contact_name !== currentConversation?.contact_phone) ? currentConversation.contact_name : (currentConversation?.contact_phone || "Lead Sem Nome")}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        Online via WhatsApp
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentConversation && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className={cn("h-9 px-3 gap-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all", 
                        currentConversation.status === "handed_off" ? "border-amber-500/50 text-amber-600 bg-amber-500/5" : "border-primary/30 text-primary bg-primary/5")} 
                      onClick={toggleHandoff}
                    >
                      {currentConversation.status === "handed_off" ? (
                        <><PlayCircle className="h-3.5 w-3.5" /> Reativar Bot</>
                      ) : (
                        <><PauseCircle className="h-3.5 w-3.5" /> Pausar Bot</>
                      )}
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-muted" onClick={() => setChatOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs de Atendimento/Notas */}
            <div className="flex flex-1 overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 border-r border-border/40">
                {/* Área de Mensagens */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-muted/5 scrollbar-thin">
                  {chatLoading ? (
                    <div className="grid place-items-center h-full">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Carregando conversa...</span>
                      </div>
                    </div>
                  ) : !currentConversation ? (
                    <div className="grid place-items-center h-full text-center px-10">
                      <div className="bg-muted/30 p-8 rounded-[40px] border-2 border-dashed border-border/50">
                        <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                          Nenhuma conversa encontrada. Inicie um atendimento agora mesmo enviando uma mensagem.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {currentConversation.transcript?.map((m, i) => {
                        const mine = m.role === "agent" || m.sent;
                        const isBot = m.role === "assistant";
                        
                        return (
                          <div key={i} className={cn("flex flex-col max-w-[85%]", mine ? "ml-auto items-end" : "items-start")}>
                            <div className={cn(
                              "relative px-4 py-3 rounded-2xl text-sm shadow-sm transition-all hover:shadow-md",
                              mine ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border border-border rounded-tl-none",
                              isBot && "border-primary/30 bg-primary/5 text-foreground"
                            )}>
                              {isBot && (
                                <div className="flex items-center gap-1 mb-1 opacity-60">
                                  <Bot className="h-3 w-3" />
                                  <span className="text-[9px] font-black uppercase">Auto-Atendimento</span>
                                </div>
                              )}
                              <p className="whitespace-pre-wrap break-words leading-relaxed font-medium">{m.content}</p>
                            </div>
                            {m.at && (
                              <span className="text-[9px] font-bold text-muted-foreground/50 mt-1.5 px-1 uppercase tracking-tighter">
                                {formatDistanceToNow(new Date(m.at), { addSuffix: true, locale: ptBR })}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar de Notas e Tags */}
              {editingDeal && (
                <div className="w-72 bg-card p-6 overflow-y-auto space-y-6 flex flex-col border-l border-border/40">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      Tags do Lead
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dealTags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-black px-2 py-1 rounded-lg border border-primary/20">
                          {tag}
                          <button onClick={() => removeTag(tag)} className="hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Nova tag..." 
                        className="h-9 text-xs rounded-lg"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addTag()}
                      />
                      <Button size="sm" variant="secondary" onClick={addTag} className="h-9 w-9 rounded-lg px-0"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Notas Internas
                    </div>
                    <textarea
                      className="flex-1 w-full bg-muted/30 rounded-xl p-4 text-xs font-medium border-none resize-none focus:ring-1 focus:ring-primary/20 min-h-[200px]"
                      placeholder="Escreva notas importantes sobre este lead aqui..."
                      value={dealNotes}
                      onChange={(e) => setDealNotes(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={saveDealDetails}
                    className="w-full h-11 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/10"
                  >
                    Salvar Detalhes
                  </Button>
                </div>
              )}
            </div>
 
            {/* Input de Mensagem */}
            <div className="p-6 border-t border-border bg-background shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
              <div className="relative flex items-end gap-3 bg-muted/30 p-2 rounded-2xl border border-border/50 focus-within:border-primary/30 transition-all">
                <div className="flex items-center gap-1 px-1">
                  <button onClick={() => document.getElementById("funil-image-upload-sidebar")?.click()} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <input id="funil-image-upload-sidebar" type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </div>
                <textarea
                  placeholder="Digite sua mensagem aqui..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === "Enter" && !e.shiftKey) { 
                      e.preventDefault(); 
                      sendMessage(); 
                    } 
                  }}
                  rows={1}
                  disabled={!currentConversation || sending}
                  className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none focus:ring-0 text-sm py-3 px-2 resize-none scrollbar-hide"
                />
                <Button 
                 size="icon" 
                 className="h-11 w-11 rounded-xl shrink-0 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all" 
                 onClick={sendMessage} 
                 disabled={!currentConversation || sending || (!messageText.trim() && !selectedImage)}
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
             <div className="flex items-center justify-between mt-3 px-1">
               <p className="text-[10px] text-muted-foreground/60 font-medium">
                 Pressione <span className="font-bold">Enter</span> para enviar
               </p>
                <div className="flex gap-2">
                  <button 
                    className="text-[10px] font-black text-primary/70 uppercase tracking-widest hover:text-primary transition-colors"
                    onClick={() => {
                      const templates = ["Olá, como posso ajudar?", "Agradecemos o seu contato!", "Um momento, por favor."];
                      const choice = prompt("Escolha um template:\n" + templates.map((t, i) => `${i + 1}: ${t}`).join("\n"));
                      if (choice && templates[parseInt(choice) - 1]) {
                        setMessageText(templates[parseInt(choice) - 1]);
                      }
                    }}
                  >
                    Templates
                  </button>
                  <button className="text-[10px] font-black text-primary/70 uppercase tracking-widest hover:text-primary transition-colors" onClick={() => toast.info("Anexos em breve!")}>
                    Anexar
                  </button>
                </div>
             </div>
            </div>
          </div>
        )}

        <AddDealDialog 
         open={!!adding} 
         onOpenChange={(o) => !o && setAdding(null)}
         initialStageId={adding?.stage_id || ""}
         leads={leads}
         onSuccess={load}
       />
       <AddStageDialog
         open={addingStage}
         onOpenChange={setAddingStage}
         onSuccess={load}
         stagesCount={stages.length}
       />
     </div>
    </div>
  );
}
