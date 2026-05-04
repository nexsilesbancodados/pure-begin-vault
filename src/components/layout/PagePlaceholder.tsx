import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Construction } from "lucide-react";

export function PagePlaceholder({ title, subtitle, description }: { title: string; subtitle?: string; description?: string }) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="rounded-2xl bg-card border border-border shadow-card p-12 grid place-items-center text-center">
            <div className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow mb-4">
              <Construction className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold font-display">{title}</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-2">
              {description ?? "Esta seção está pronta para receber seus dados quando o Lovable Cloud (banco de dados) estiver ativo."}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
