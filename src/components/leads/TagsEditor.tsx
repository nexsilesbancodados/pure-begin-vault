import { useState } from "react";
import { Tag, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId: string;
  tags: string[];
  onChange?: (tags: string[]) => void;
  compact?: boolean;
}

const SUGGESTIONS = ["quente", "frio", "morno", "novo", "vip", "interessado iPhone", "interessado Android", "promoção"];

export function TagsEditor({ leadId, tags, onChange, compact }: Props) {
  const [current, setCurrent] = useState<string[]>(tags ?? []);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const persist = async (next: string[]) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("leads")
      .update({ tags: next })
      .eq("id", leadId);
    setSaving(false);
    if (error) {
      toast.error("Falhou: " + error.message);
      return;
    }
    setCurrent(next);
    onChange?.(next);
  };

  const add = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t || current.includes(t)) return;
    persist([...current, t]);
    setInput("");
  };

  const remove = (tag: string) => {
    persist(current.filter((t) => t !== tag));
  };

  return (
    <div className={compact ? "" : "space-y-2"}>
      <div className="flex items-center gap-1 flex-wrap">
        {current.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20"
          >
            <Tag className="h-2.5 w-2.5" />
            {t}
            <button onClick={() => remove(t)} className="hover:text-destructive ml-0.5">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {!compact && (
          <div className="inline-flex items-center gap-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(input);
                }
              }}
              placeholder="+ tag"
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted border border-border w-20 outline-none focus:border-primary"
            />
            {input && (
              <button onClick={() => add(input)} disabled={saving}>
                <Plus className="h-3 w-3 text-primary" />
              </button>
            )}
          </div>
        )}
      </div>
      {!compact && SUGGESTIONS.filter((s) => !current.includes(s)).length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">sugestões:</span>
          {SUGGESTIONS.filter((s) => !current.includes(s)).slice(0, 5).map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              disabled={saving}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary transition"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
