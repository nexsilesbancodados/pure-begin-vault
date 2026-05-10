// Helper para criar notificações in-app (fire-and-forget).
import { supabase } from "@/integrations/supabase/client";

export async function notify(opts: {
  user_id: string;
  organization_id?: string | null;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  if (!opts.user_id) return;
  await supabase.from("notifications").insert({
    user_id: opts.user_id,
    organization_id: opts.organization_id ?? null,
    type: opts.type,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  });
}
