import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Trash2, ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "os-attachments";

type Attachment = {
  id: string;
  storage_path: string;
  public_url: string | null;
  kind: string;
  category: string | null;
  description: string | null;
  created_at: string;
};

interface Props {
  serviceOrderId: string;
}

export function OSAttachments({ serviceOrderId }: Props) {
  const { orgId } = useOrg();
  const { user } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<"antes" | "depois" | "evidencia">("antes");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!serviceOrderId) return;
    setLoading(true);
    const { data, error: err } = await (supabase as any)
      .from("service_order_attachments")
      .select("*")
      .eq("service_order_id", serviceOrderId)
      .order("created_at", { ascending: true });
    if (err) {
      setError("Tabela service_order_attachments não encontrada — aplique a migration.");
      setLoading(false);
      return;
    }
    setItems((data as Attachment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [serviceOrderId]);

  const onFile = async (file: File) => {
    if (!orgId || !user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${orgId}/${serviceOrderId}/${category}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

      if (upErr) {
        if (upErr.message.includes("Bucket not found")) {
          toast.error(`Crie o bucket público "${BUCKET}" no Supabase Storage primeiro`);
        } else {
          toast.error("Upload falhou: " + upErr.message);
        }
        return;
      }

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: insErr } = await (supabase as any).from("service_order_attachments").insert({
        organization_id: orgId,
        service_order_id: serviceOrderId,
        user_id: user.id,
        storage_path: path,
        public_url: pub?.publicUrl ?? null,
        kind: file.type.startsWith("video/") ? "video" : "photo",
        category,
      });
      if (insErr) throw insErr;
      toast.success("Anexo adicionado");
      load();
    } catch (e: any) {
      toast.error("Falhou: " + (e?.message ?? "erro"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeItem = async (it: Attachment) => {
    if (!confirm("Remover este anexo?")) return;
    await supabase.storage.from(BUCKET).remove([it.storage_path]);
    await (supabase as any).from("service_order_attachments").delete().eq("id", it.id);
    toast.success("Removido");
    load();
  };

  if (error) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-sm">{error}</div>
    );
  }

  const byCat = {
    antes: items.filter((i) => i.category === "antes"),
    depois: items.filter((i) => i.category === "depois"),
    evidencia: items.filter((i) => i.category === "evidencia"),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {(["antes", "depois", "evidencia"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition capitalize ${
              category === c
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border hover:border-primary/40"
            }`}
          >
            {c}
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="ml-auto"
        >
          <Camera className="h-4 w-4 mr-1" />
          {uploading ? "Enviando..." : `Adicionar ${category}`}
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando anexos...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-bold">Sem anexos ainda</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tire foto antes/depois para evitar reclamações futuras.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(["antes", "depois", "evidencia"] as const).map((c) =>
            byCat[c].length === 0 ? null : (
              <div key={c}>
                <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground mb-1 capitalize">
                  {c} ({byCat[c].length})
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {byCat[c].map((it) => (
                    <div
                      key={it.id}
                      className="relative aspect-square rounded-xl overflow-hidden border border-border group"
                    >
                      {it.public_url ? (
                        it.kind === "video" ? (
                          <video
                            src={it.public_url}
                            className="w-full h-full object-cover"
                            controls={false}
                            muted
                            playsInline
                          />
                        ) : (
                          <img src={it.public_url} className="w-full h-full object-cover" alt="" />
                        )
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                      <button
                        onClick={() => removeItem(it)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
