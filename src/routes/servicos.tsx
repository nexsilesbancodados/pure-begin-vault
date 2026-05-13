import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { HubHero } from "@/components/layout/HubHero";
import { FeatureCard, type FeatureCardTone } from "@/components/ui/FeatureCard";
import { OSList } from "@/components/servicos/OSList";
import { Wrench, LayoutDashboard, Plus, Users, ClipboardCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/servicos")({
  component: ServicesPage,
});

const modules: { title: string; desc: string; url: string; icon: any; tone: FeatureCardTone }[] = [
  {
    title: "Dashboard OS",
    desc: "KPIs e SLA das ordens",
    url: "/servicos/dashboard",
    icon: LayoutDashboard,
    tone: "primary",
  },
  {
    title: "Nova Ordem",
    desc: "Abrir uma OS rapidamente",
    url: "/servicos/nova",
    icon: Plus,
    tone: "success",
  },
  {
    title: "Técnicos",
    desc: "Carga e produtividade",
    url: "/servicos/tecnicos",
    icon: Users,
    tone: "info",
  },
  {
    title: "Checklists",
    desc: "Modelos de inspeção",
    url: "/servicos/checklists",
    icon: ClipboardCheck,
    tone: "violet",
  },
  {
    title: "Termos de Garantia",
    desc: "Documentos personalizados",
    url: "/servicos/termos",
    icon: FileText,
    tone: "warning",
  },
];

function ServicesPage() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Assistência Técnica" subtitle="Gestão de Ordens de Serviço" />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <HubHero
            eyebrow="Serviços"
            icon={Wrench}
            title="Da bancada ao cliente, sem retrabalho"
            description="Abra ordens, atribua técnicos, controle SLA e entregue com termos e garantias profissionais."
            actions={[
              { label: "Nova Ordem", to: "/servicos/nova", icon: Plus },
              {
                label: "Ver Dashboard",
                to: "/servicos/dashboard",
                icon: LayoutDashboard,
                variant: "ghost",
              },
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m) => (
              <FeatureCard
                key={m.url}
                to={m.url}
                icon={m.icon}
                title={m.title}
                description={m.desc}
                tone={m.tone}
              />
            ))}
          </div>

          <OSList />
        </main>
      </div>
    </div>
  );
}
