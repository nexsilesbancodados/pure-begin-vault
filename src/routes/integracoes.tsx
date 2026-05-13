import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag,
  Truck,
  CreditCard,
  Building2,
  MessageSquare,
  Receipt,
  Code,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — ConectaCRM" },
      { name: "description", content: "Conecte o ConectaCRM com WhatsApp, Instagram, Mercado Pago, transportadoras e mais para automatizar a operação da sua loja." },
      { property: "og:title", content: "Integrações do ConectaCRM" },
      { property: "og:description", content: "Conecte sua loja com WhatsApp, Instagram, gateways de pagamento e logística." },
    ],
  }),
  component: IntegracoesPage,
});

type Integration = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "available" | "coming_soon" | "active";
  icon: any;
  href?: string;
  setupLink?: string;
};

const INTEGRATIONS: Integration[] = [
  // Marketplaces
  { id: "ml", name: "Mercado Livre", description: "Sincroniza estoque + recebe pedidos automaticamente", category: "Marketplaces", status: "coming_soon", icon: ShoppingBag, setupLink: "https://developers.mercadolivre.com.br/" },
  { id: "shopee", name: "Shopee", description: "Integração com Shopee Open Platform", category: "Marketplaces", status: "coming_soon", icon: ShoppingBag, setupLink: "https://open.shopee.com/" },
  { id: "magalu", name: "Magalu Marketplace", description: "Sincronização via Magalu Pay", category: "Marketplaces", status: "coming_soon", icon: ShoppingBag },
  { id: "amazon", name: "Amazon BR", description: "Selling Partner API", category: "Marketplaces", status: "coming_soon", icon: ShoppingBag },

  // Frete
  { id: "correios", name: "Correios", description: "Calcular frete + gerar etiqueta + rastreio", category: "Logística", status: "coming_soon", icon: Truck, setupLink: "https://www.correios.com.br/" },
  { id: "jadlog", name: "JadLog", description: "Mesma região + sul/sudeste mais barato", category: "Logística", status: "coming_soon", icon: Truck },
  { id: "loggi", name: "Loggi", description: "Entregas same-day urbanas", category: "Logística", status: "coming_soon", icon: Truck, setupLink: "https://www.loggi.com/" },

  // Pagamentos
  { id: "mp", name: "Mercado Pago", description: "Assinatura SaaS (já configurado)", category: "Pagamentos", status: "active", icon: CreditCard },
  { id: "asaas", name: "Asaas", description: "Boletos registrados + Pix + assinaturas", category: "Pagamentos", status: "coming_soon", icon: CreditCard, setupLink: "https://www.asaas.com/" },
  { id: "pjbank", name: "PJBank", description: "Boletos + Pix recebimento", category: "Pagamentos", status: "coming_soon", icon: CreditCard, setupLink: "https://www.pjbank.com.br/" },
  { id: "iugu", name: "Iugu", description: "Cobrança recorrente B2B", category: "Pagamentos", status: "coming_soon", icon: CreditCard },
  { id: "stone", name: "Stone TEF", description: "Pinpad cartão no PDV", category: "Pagamentos", status: "coming_soon", icon: CreditCard, setupLink: "https://www.stone.com.br/" },
  { id: "cielo", name: "Cielo LIO", description: "TEF + cartão", category: "Pagamentos", status: "coming_soon", icon: CreditCard },
  { id: "rede", name: "Rede / Itaú", description: "TEF + cartão", category: "Pagamentos", status: "coming_soon", icon: CreditCard },

  // Open Finance
  { id: "pluggy", name: "Pluggy", description: "Open Finance: extratos bancários automáticos", category: "Open Finance", status: "coming_soon", icon: Building2, setupLink: "https://pluggy.ai/" },
  { id: "belvo", name: "Belvo", description: "Conexão com 30+ bancos brasileiros", category: "Open Finance", status: "coming_soon", icon: Building2 },

  // Mensageria
  { id: "evolution", name: "Evolution API (WhatsApp não-oficial)", description: "Usando atualmente — não oficial", category: "Mensageria", status: "active", icon: MessageSquare },
  { id: "waba", name: "WhatsApp Business API (Meta oficial)", description: "Selo verificado, sem risco de ban", category: "Mensageria", status: "coming_soon", icon: MessageSquare, setupLink: "https://business.whatsapp.com/products/business-platform" },
  { id: "ig", name: "Instagram Direct (Meta oficial)", description: "Mensagens diretas Instagram Business", category: "Mensageria", status: "coming_soon", icon: MessageSquare },
  { id: "telegram", name: "Telegram Bot", description: "Canal adicional via Bot API", category: "Mensageria", status: "coming_soon", icon: MessageSquare },

  // Fiscal (opcional)
  { id: "focusnfe", name: "Focus NFe", description: "Emissão NF-e/NFC-e (não usamos por padrão)", category: "Fiscal", status: "coming_soon", icon: Receipt, setupLink: "https://focusnfe.com.br/" },
  { id: "enotas", name: "eNotas", description: "Emissão NF-e simplificada", category: "Fiscal", status: "coming_soon", icon: Receipt },
  { id: "plugnotas", name: "PlugNotas", description: "API fiscal simplificada", category: "Fiscal", status: "coming_soon", icon: Receipt },

  // Outros
  { id: "google-reviews", name: "Google Reviews", description: "Solicita review pós-venda automático", category: "Reputação", status: "coming_soon", icon: ExternalLink },
  { id: "zapier", name: "Zapier", description: "Use API pública pra conectar com 5000+ apps", category: "Outros", status: "active", icon: Code, href: "/api-keys" },
  { id: "n8n", name: "n8n", description: "Automações low-code self-hosted via API pública", category: "Outros", status: "active", icon: Code, href: "/api-keys" },
];

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  active: { label: "Ativa", class: "bg-success/15 text-success" },
  available: { label: "Disponível", class: "bg-primary/15 text-primary" },
  coming_soon: { label: "Em breve", class: "bg-muted text-muted-foreground" },
};

function IntegracoesPage() {
  const grouped: Record<string, Integration[]> = {};
  for (const i of INTEGRATIONS) {
    if (!grouped[i.category]) grouped[i.category] = [];
    grouped[i.category].push(i);
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title="Integrações" subtitle="Conecte com marketplaces, pagamentos, frete e mais" />
        <main className="flex-1 overflow-y-auto p-6 space-y-4">
          <Card className="p-4 bg-muted/40 text-sm">
            <p>
              <strong>Como funciona:</strong> integrações marcadas <Badge className="mx-1 bg-success/15 text-success text-[9px]">Ativa</Badge>
              já funcionam. As <Badge className="mx-1 text-[9px]" variant="outline">Em breve</Badge> dependem de você criar conta
              no provedor e nos enviar token API — implementamos a integração específica.
            </p>
          </Card>

          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <h3 className="font-black text-sm uppercase tracking-widest mb-2 text-muted-foreground">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {items.map((i) => {
                  const Icon = i.icon;
                  const status = STATUS_LABELS[i.status];
                  return (
                    <Card key={i.id} className={`p-4 ${i.status === "active" ? "border-success/30" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          i.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold">{i.name}</p>
                            <Badge className={`${status.class} text-[9px]`}>{status.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{i.description}</p>
                          {i.setupLink && i.status === "coming_soon" && (
                            <a
                              href={i.setupLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-primary hover:underline mt-1 inline-flex items-center gap-1"
                            >
                              Criar conta no provedor <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {i.href && (
                            <a href={i.href} className="text-xs font-bold text-primary hover:underline mt-1 inline-flex items-center gap-1">
                              Configurar <ChevronRight className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
