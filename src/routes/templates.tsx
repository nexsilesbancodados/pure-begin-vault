import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Loader2, MessageSquare, Image as ImageIcon, Video, FileText, Trash2, Copy, Tag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Modelos de Mensagem — ConectaCRM" },
      { name: "description", content: "Modelos com mídia para WhatsApp e Instagram" },
    ],
  }),
  component: TemplatesPage,
});

type Tpl = {
  id: string;
  name: string;
  category: string;
  body: string;
  media_url: string | null;
  media_type: string | null;
  variables: any;
  created_at: string;
};

const CATEGORIES = ["geral", "boas-vindas", "follow-up", "pos-venda", "promocao", "agendamento"];

function detectVars(body: string): string[] {
  const matches = body.match(/\{\{\s*([\w_]+)\s*\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/[{}\s]/g, "")))];
}

function TemplatesPage() {
  const { user, profile } = useAuth();
  const [list, setList] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [form, setForm] = useState({ name: "", category: "geral", body: "", media_url: "", media_type: "" });

  const load = async () => {
    if (!profile?.organization_id) { setLoading(false); return; }
    const { data } = await supabase
      .from("message_templates" as any)
      .select("*")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false });
    setList((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.organization_id]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "geral", body: "", media_url: "", media_type: "" });
    setOpen(true);
  };

  const openEdit = (t: Tpl) => {
    setEditing(t);
    setForm({ name: t.name, category: t.category, body: t.body, media_url: t.media_url || "", media_type: t.media_type || "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.body.trim() || !user?.id) return;
    const variables = detectVars(form.body);
    const payload: any = {
      name: form.name.trim(),
      category: form.category,
      body: form.body,
      media_url: form.media_url.trim() || null,
      media_type: form.media_type.trim() || null,
      variables,
      organization_id: profile?.organization_id,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from("message_templates" as any).update(payload).eq("id", editing.id)
      : await supabase.from("message_templates" as any).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Modelo atualizado" : "Modelo criado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir modelo?")) return;
    await supabase.from("message_templates" as any).delete().eq("id", id);
    toast.success("Excluído");
    load();
  };

  const copyBody = (t: Tpl) => {
    navigator.clipboard.writeText(t.body);
    toast.success("Copiado");
  };

  const mediaIcon = (type: string | null) => {
    if (type === "image") return <ImageIcon className="h-3.5 w-3.5" />;
    if (type === "video") return <Video className="h-3.5 w-3.5" />;
    if (type === "document") return <FileText className="h-3.5 w-3.5" />;
    return <MessageSquare className="h-3.5 w-3.5" />;
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <Topbar title="Modelos de Mensagem" subtitle="Templates com mídia para WhatsApp e Instagram" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">{list.length} modelo(s) salvos. Use <code className="px-1 bg-muted rounded">{"{{nome}}"}</code> para variáveis.</div>
            <button onClick={openNew} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm inline-flex items-center gap-2 hover:opacity-90">
              <Plus className="h-4 w-4" /> Novo modelo
            </button>
          </div>

          {loading ? <div className="grid place-items-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
            list.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <div className="font-bold mb-1">Nenhum modelo ainda</div>
                <div className="text-sm text-muted-foreground mb-4">Crie modelos de mensagem com texto, imagem, vídeo ou documento</div>
                <button onClick={openNew} className="h-10 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm">Criar primeiro modelo</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((t) => (
                  <div key={t.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-bold text-base">{t.name}</div>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {mediaIcon(t.media_type)} {t.category}
                      </span>
                    </div>
                    {t.media_url && (
                      <div className="mb-2 rounded-lg overflow-hidden bg-muted aspect-video grid place-items-center">
                        {t.media_type === "image" ? (
                          <img src={t.media_url} alt={t.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">{mediaIcon(t.media_type)} {t.media_type || "mídia"}</div>
                        )}
                      </div>
                    )}
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4 flex-1">{t.body}</div>
                    {Array.isArray(t.variables) && t.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.variables.map((v: string) => (
                          <span key={v} className="text-[10px] inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground"><Tag className="h-2.5 w-2.5" />{v}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1 mt-3 pt-3 border-t border-border">
                      <button onClick={() => copyBody(t)} className="flex-1 h-8 rounded-lg border border-border text-xs font-bold hover:bg-muted inline-flex items-center justify-center gap-1"><Copy className="h-3 w-3" />Copiar</button>
                      <button onClick={() => openEdit(t)} className="flex-1 h-8 rounded-lg border border-border text-xs font-bold hover:bg-muted">Editar</button>
                      <button onClick={() => remove(t.id)} className="h-8 w-8 grid place-items-center rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </main>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/50 grid place-items-center z-50 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-3 my-8" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg">{editing ? "Editar modelo" : "Novo modelo"}</h3>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do modelo" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={"Olá {{nome}}, tudo bem? Vi seu interesse em..."}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm min-h-[140px] font-mono"
            />
            <div className="grid grid-cols-3 gap-2">
              <select value={form.media_type} onChange={(e) => setForm({ ...form, media_type: e.target.value })} className="h-10 px-2 rounded-lg border border-border bg-background text-sm">
                <option value="">Sem mídia</option>
                <option value="image">Imagem</option>
                <option value="video">Vídeo</option>
                <option value="document">Documento</option>
                <option value="audio">Áudio</option>
              </select>
              <input
                value={form.media_url}
                onChange={(e) => setForm({ ...form, media_url: e.target.value })}
                placeholder="URL da mídia (opcional)"
                className="col-span-2 h-10 px-3 rounded-lg border border-border bg-background text-sm"
              />
            </div>
            {form.body && detectVars(form.body).length > 0 && (
              <div className="text-xs text-muted-foreground">Variáveis detectadas: {detectVars(form.body).map((v) => <span key={v} className="ml-1 px-1.5 py-0.5 rounded bg-muted font-mono">{v}</span>)}</div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg border border-border text-sm font-bold">Cancelar</button>
              <button onClick={save} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
