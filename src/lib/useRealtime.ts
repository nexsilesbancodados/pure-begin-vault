import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface Opts {
  table: string;
  event?: Event;
  filter?: string; // ex: "organization_id=eq.{uuid}"
  schema?: string;
  enabled?: boolean;
}

export function useRealtime<T = any>(opts: Opts, onChange: (payload: { event: Event; new: T; old: T }) => void) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (opts.enabled === false) return;
    const channelName = `rt:${opts.table}:${opts.event ?? "*"}:${opts.filter ?? ""}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as any,
        {
          event: opts.event ?? "*",
          schema: opts.schema ?? "public",
          table: opts.table,
          filter: opts.filter,
        },
        (payload: any) => {
          cbRef.current({
            event: payload.eventType as Event,
            new: payload.new as T,
            old: payload.old as T,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [opts.table, opts.event, opts.filter, opts.schema, opts.enabled]);
}

// Presença: quem mais está online vendo a mesma página/sala?
export function usePresence(room: string, user: { id: string; name?: string }) {
  const onlineRef = useRef<any[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`presence:${room}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        onlineRef.current = Object.values(channel.presenceState()).flat();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ id: user.id, name: user.name, online_at: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, user.id]);

  return onlineRef.current;
}
