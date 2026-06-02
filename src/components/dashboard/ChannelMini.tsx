import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/lib/useOrg";

type DataPoint = { day: string; whats: number; insta: number };

const Row = (props: any = {}) => {
  const {
    label = "",
    value = 0,
    color = "var(--color-primary)",
    dataKey = "whats",
    gradId = "g",
    data = [],
  } = props || {};
  const safeData = Array.isArray(data) ? data : [];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="h-10 w-10 rounded-xl grid place-items-center shrink-0"
        style={{ background: `color-mix(in oklab, ${color} 15%, transparent)` }}
      >
        <span className="text-base">{label === "WhatsApp" ? "💬" : "📷"}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-tight">{label}</div>
        <div className="text-[11px] text-muted-foreground">{value} mensagens (7d)</div>
      </div>
      <div className="ml-auto h-10 w-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={safeData.length > 0 ? safeData : [{ day: "", whats: 0, insta: 0 }]}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#${gradId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export function ChannelMini() {
  const { orgId } = useOrg();
  const navigate = useNavigate();
  const [series, setSeries] = useState<DataPoint[]>([]);
  const [totals, setTotals] = useState({ whats: 0, insta: 0 });

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await (supabase as any)
        .from("messages")
        .select("channel, created_at")
        .eq("organization_id", orgId)
        .gte("created_at", since)
        .limit(5000);

      const days: DataPoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({ day: d.toISOString().slice(5, 10), whats: 0, insta: 0 });
      }
      let w = 0,
        ig = 0;
      for (const m of (data ?? []) as any[]) {
        const k = m.created_at.slice(5, 10);
        const day = days.find((d) => d.day === k);
        const ch = (m.channel ?? "").toLowerCase();
        if (ch.includes("whats")) {
          if (day) day.whats++;
          w++;
        } else if (ch.includes("insta")) {
          if (day) day.insta++;
          ig++;
        }
      }
      setSeries(days);
      setTotals({ whats: w, insta: ig });
    })();
  }, [orgId]);

  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold">Atendimentos por canal</h3>
      <div className="divide-y divide-border">
        <Row
          label="WhatsApp"
          value={totals.whats}
          color="var(--color-success)"
          dataKey="whats"
          gradId="gW"
          data={series}
        />
        <Row
          label="Instagram"
          value={totals.insta}
          color="oklch(0.65 0.2 330)"
          dataKey="insta"
          gradId="gI"
          data={series}
        />
      </div>
      <button
        onClick={() => navigate({ to: "/atendimento" })}
        className="w-full mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary-glow border border-border rounded-lg py-2 hover:bg-muted transition"
      >
        Ver todos os canais <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
