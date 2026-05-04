import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { channelSeries } from "@/lib/mock";
import { ArrowRight } from "lucide-react";

const Row = ({ label, value, trend, color, dataKey, gradId }: any) => (
  <div className="flex items-center gap-3 py-2.5">
    <div className="h-10 w-10 rounded-xl grid place-items-center shrink-0" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)` }}>
      <span className="text-base">{label === "WhatsApp" ? "💬" : "📷"}</span>
    </div>
    <div className="min-w-0">
      <div className="text-[13px] font-medium leading-tight">{label}</div>
      <div className="text-[11px] text-muted-foreground">{value} <span className="text-success font-semibold">↑ {trend}</span></div>
    </div>
    <div className="ml-auto h-10 w-24">
      <ResponsiveContainer>
        <AreaChart data={channelSeries}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export function ChannelMini() {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
      <h3 className="text-[15px] font-semibold">Atendimentos por canal</h3>
      <div className="divide-y divide-border">
        <Row label="WhatsApp" value="0" trend="0%" color="var(--color-success)" dataKey="whats" gradId="gW" />
        <Row label="Instagram" value="0" trend="0%" color="oklch(0.65 0.2 330)" dataKey="insta" gradId="gI" />
      </div>
      <button className="w-full mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary-glow border border-border rounded-lg py-2 hover:bg-muted transition">
        Ver todos os canais <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
