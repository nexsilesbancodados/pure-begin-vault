import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

type N = { id: string; type: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<N[]>([]);
  const unread = items.filter((i) => !i.is_read).length;

  const load = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as N[]);
  };

  useEffect(() => {
    load();
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => {
          const n = p.new as N;
          setItems((prev) => [n, ...prev].slice(0, 20));
          toast(n.title, { description: n.body ?? undefined });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setItems((p) => p.map((i) => (i.id === id ? { ...i, is_read: true } : i)));
  };
  const markAll = async () => {
    if (!user?.id) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setItems((p) => p.map((i) => ({ ...i, is_read: true })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-10 w-10 grid place-items-center rounded-xl hover:bg-muted">
          <Bell className="h-[18px] w-[18px] text-foreground/70" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-bold text-sm">Notificações</h4>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAll} className="gap-1 h-7 text-xs">
              <CheckCheck className="h-3 w-3" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
          ) : items.map((n) => (
            <button
              key={n.id}
              onClick={() => { markRead(n.id); if (n.link) navigate({ to: n.link as any }); }}
              className={`w-full text-left p-3 border-b hover:bg-muted/50 transition flex gap-2 ${!n.is_read ? "bg-primary/5" : ""}`}
            >
              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? "bg-primary" : "bg-transparent"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{n.title}</div>
                {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
              {!n.is_read && <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
