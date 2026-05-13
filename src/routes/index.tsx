import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Check, Smartphone, Box, Wrench, BarChart3, Users, Bot, FileText,
  CreditCard, Tag, MessageCircle, Zap, ShieldCheck, Sparkles, ArrowRight,
  Star, Globe, Calendar, Bell, Crown, TrendingUp, ShieldCheck as ShieldIcon,
} from "lucide-react";
import heroDashboard from "@/assets/hero-dashboard.webp";
import ownerStore from "@/assets/owner-store.jpg";
import customerHappy from "@/assets/customer-happy.jpg";
import attendantLaptop from "@/assets/attendant-laptop.jpg";
import featImei from "@/assets/feat-imei.jpg";
import featPdv from "@/assets/feat-pdv.jpg";
import featAssist from "@/assets/feat-assist.jpg";
import featCrm from "@/assets/feat-crm.jpg";
import featReports from "@/assets/feat-reports.jpg";
import featAi from "@/assets/feat-ai.jpg";
import featDevices from "@/assets/feat-devices.jpg";
import testimonialLeandro from "@/assets/testimonial-leandro.jpg";
import { X as XIcon, Clock, Heart, Quote, Store, Headphones, BadgeCheck, Cloud, ShieldCheck as ShieldIcon2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ConectaCRM — ERP, CRM e IA para lojas de celular" },
      { name: "description", content: "ERP + CRM + IA para lojas de celular: estoque por IMEI, OS, vendas, fiscal, financeiro e WhatsApp em uma única plataforma." },
      { property: "og:title", content: "ConectaCRM — Sistema completo para lojas de celular" },
      { property: "og:description", content: "ERP + CRM + IA + App mobile em uma única plataforma. Controle total da sua loja de celular." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://pure-begin-vault.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://pure-begin-vault.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "ConectaCRM",
          url: "https://pure-begin-vault.lovable.app/",
          description: "ERP, CRM e IA para lojas de celular: estoque por IMEI, ordem de serviço, vendas, fiscal, financeiro e WhatsApp.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "ConectaCRM",
          url: "https://pure-begin-vault.lovable.app/",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            { "@type": "Question", name: "Posso testar antes de pagar?", acceptedAnswer: { "@type": "Answer", text: "Sim. Você tem 3 dias grátis para testar todos os recursos do plano Pro Max, sem precisar de cartão." } },
            { "@type": "Question", name: "Tem fidelidade?", acceptedAnswer: { "@type": "Answer", text: "Não. Você pode cancelar quando quiser. O pacote anual oferece desconto, mas é opcional." } },
            { "@type": "Question", name: "Meus dados ficam seguros?", acceptedAnswer: { "@type": "Answer", text: "Sim. Usamos criptografia em repouso e em trânsito, com backups diários e isolamento total entre lojas." } },
            { "@type": "Question", name: "Funciona offline?", acceptedAnswer: { "@type": "Answer", text: "O sistema é cloud-first, mas o app mobile mantém ações essenciais em cache para continuar vendendo se a internet cair." } },
            { "@type": "Question", name: "Importam meus dados do sistema antigo?", acceptedAnswer: { "@type": "Answer", text: "Sim. Importamos seu estoque, clientes e histórico via planilha, sem custo, em qualquer plano." } },
          ],
        }),
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Box, title: "Estoque por IMEI/SN", desc: "Controle aparelhos, peças e acessórios com rastreio individual por IMEI ou número de série." },
  { icon: Wrench, title: "Ordem de Serviço", desc: "OS completa com checklists, termos de garantia personalizados e acompanhamento técnico." },
  { icon: CreditCard, title: "PDV e Vendas", desc: "Venda, upgrade, troca e assistência em segundos. Múltiplas formas de pagamento." },
  { icon: FileText, title: "Módulo Fiscal", desc: "NF-e, NFC-e e NF de Upgrade emitidas direto do sistema, sem retrabalho." },
  { icon: BarChart3, title: "+30 Relatórios e Dashboards", desc: "DRE, fluxo de caixa, vendas por vendedor, ranking de produtos, margem real e muito mais." },
  { icon: Bot, title: "IA Blue — Pós-venda automático", desc: "IA que conversa, agradece, pede avaliação e reativa clientes inativos no WhatsApp." },
  { icon: MessageCircle, title: "CRM Multicanal", desc: "WhatsApp, Instagram e Phone unificados. Funil Kanban com etapas e automações." },
  { icon: Smartphone, title: "App Android e iOS", desc: "Sua loja no bolso: vendas, OS, estoque e mensagens com sincronização em tempo real." },
  { icon: Globe, title: "Catálogo Online", desc: "Vitrine pública com link compartilhável, integrada ao seu estoque." },
  { icon: Tag, title: "Etiquetas e Códigos", desc: "Imprima etiquetas para produtos, peças e ordens de serviço com 1 clique." },
  { icon: Calendar, title: "Aniversários automáticos", desc: "Mensagem de aniversário enviada sozinha — clientes voltam mais." },
  { icon: Zap, title: "Automação total", desc: "Gatilhos, fluxos e mensagens programadas. Configure uma vez, funciona para sempre." },
];

const plans = [
  {
    name: "Plus",
    pitch: "Ideal para quem está começando",
    annual: "86,00",
    monthly: "129,00",
    cta: "Quero o Plus",
    highlight: false,
    features: [
      "Controle de estoque de acessórios e aparelhos por IMEI e SN",
      "Vendas com upgrade e termos de garantia personalizados",
      "Financeiro completo com contas a pagar e receber",
      "Relatórios e dashboards essenciais",
      "1 login (sem App iOS/Android)",
      "Consultas IMEI, CPF, CNPJ e assinaturas digitais (pagas por uso)",
    ],
  },
  {
    name: "Pro",
    pitch: "O equilíbrio ideal entre recursos e investimento",
    annual: "146,00",
    monthly: "219,00",
    cta: "Quero o Pro",
    highlight: false,
    features: [
      "Todos os recursos do Plus",
      "Ordem de serviço com termos de garantia personalizados",
      "Módulo Fiscal completo: NF de Venda e NF de Upgrade",
      "App para Android e iOS",
      "Etiquetas para produtos, peças e ordem de serviço",
      "Até 5 logins simultâneos",
      "Consultas IMEI, CPF, CNPJ e assinaturas digitais (pagas por uso)",
    ],
  },
  {
    name: "Pro Max",
    pitch: "Ideal para quem deseja vender mais",
    annual: "266,00",
    monthly: "399,00",
    cta: "Quero o Pro Max",
    highlight: true,
    badge: "Mais vendidos",
    features: [
      "Todos os recursos do plano Pro",
      "IA Blue para Pós-venda e mensagem de aniversário automática",
      "API de integração com outros sistemas",
      "Catálogo online compartilhável",
      "CRM Phone para atendimentos no WhatsApp e Instagram",
      "Consultas IMEI, CPF, CNPJ e assinaturas digitais ilimitadas",
      "Logins ilimitados",
    ],
  },
];

const differentials = [
  { icon: Sparkles, title: "Setup em 5 minutos", desc: "Crie sua conta, importe seu estoque e comece a vender hoje mesmo." },
  { icon: ShieldCheck, title: "Dados isolados por loja", desc: "Multi-tenant com criptografia. Seus dados nunca se misturam com os de outra loja." },
  { icon: TrendingUp, title: "Atualizações semanais", desc: "Novas funcionalidades toda semana, sem custo extra." },
  { icon: Bell, title: "Suporte humano", desc: "Time de atendimento real, em português, todos os dias." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground">
              <Smartphone className="h-4 w-4" />
            </span>
            ConectaCRM
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#funcionalidades" className="hover:text-foreground transition">Funcionalidades</a>
            <a href="#planos" className="hover:text-foreground transition">Planos</a>
            <a href="#diferenciais" className="hover:text-foreground transition">Diferenciais</a>
            <a href="#faq" className="hover:text-foreground transition">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/registro">
              <Button size="sm" className="rounded-full">Começar grátis <ArrowRight className="h-3.5 w-3.5 ml-1" /></Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/3 -left-32 h-[520px] w-[520px] rounded-full bg-primary/15 blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-emerald-500/15 blur-[120px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20 grid lg:grid-cols-2 gap-10 lg:gap-6 items-center">
          {/* LEFT — copy */}
          <div className="text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-muted-foreground">+3.000 lojas já transformaram a operação</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              O sistema completo para sua{" "}
              <span className="bg-gradient-to-r from-primary via-emerald-400 to-primary bg-clip-text text-transparent">
                loja de celular
              </span>{" "}
              vender mais todos os dias
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl">
              Controle total de estoque por IMEI, vendas, assistência técnica,
              CRM e pós-venda em uma única plataforma simples e poderosa.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/registro">
                <Button size="lg" className="rounded-full text-base px-8 h-12 w-full sm:w-auto">
                  Começar grátis por 3 dias <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <a href="#planos">
                <Button size="lg" variant="outline" className="rounded-full text-base px-8 h-12 w-full sm:w-auto">
                  Ver planos
                </Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {[0,1,2,3,4].map(i => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-2">4.9/5 — 1.200+ avaliações</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <div className="flex items-center gap-1.5">
                <ShieldIcon className="h-4 w-4 text-emerald-500" />
                <span>Sem cartão de crédito</span>
              </div>
            </div>
          </div>

          {/* RIGHT — hero image */}
          <div className="relative">
            <img
              src={heroDashboard}
              alt="Dashboard ConectaCRM em notebook e celular mostrando vendas, estoque por IMEI e atendimento WhatsApp"
              width={1536}
              height={1024}
              className="w-full h-auto drop-shadow-2xl"
            />
          </div>
        </div>

        {/* PILLARS strip */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
            {[
              { icon: Zap, title: "Vendas em segundos", desc: "PDV rápido e intuitivo" },
              { icon: Box, title: "Estoque por IMEI", desc: "Controle total e preciso" },
              { icon: BarChart3, title: "+30 relatórios", desc: "Dados que geram resultado" },
              { icon: Bot, title: "Pós-venda com IA", desc: "Atendimento que fideliza" },
            ].map((p) => (
              <div key={p.title} className="flex items-center gap-3">
                <span className="h-11 w-11 rounded-xl bg-emerald-500/10 grid place-items-center text-emerald-500 shrink-0">
                  <p.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPARISON SEM/COM */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* LEFT: copy + comparison */}
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Feito para lojas que querem crescer</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3 leading-tight">
              Menos dor de cabeça, mais tempo e{" "}
              <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">mais lucro.</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              O ConectaCRM nasceu para resolver os principais desafios das lojas de celular e assistência técnica.
            </p>

            <div className="mt-10 grid sm:grid-cols-2 gap-5 relative">
              {/* Sem */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 p-6">
                <h3 className="font-bold text-rose-600 dark:text-rose-400 mb-4">Sem o ConectaCRM</h3>
                <ul className="space-y-4">
                  {[
                    ["Estoque desorganizado e sem controle", "Você não sabe o que tem, o que vendeu e o que falta."],
                    ["Perda de vendas e clientes", "Orçamentos perdidos e atendimentos sem follow-up."],
                    ["Assistência técnica bagunçada", "Ordens de serviço em papel, anotações e planilhas."],
                    ["Falta de informações para decidir", "Sem relatórios, você trabalha no escuro."],
                    ["Processos manuais que tomam tempo", "Mais trabalho, menos produtividade e mais erros."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-0.5 h-5 w-5 rounded-full bg-rose-500 text-white grid place-items-center shrink-0">
                        <XIcon className="h-3 w-3" />
                      </span>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{t}</p>
                        <p className="text-xs text-muted-foreground mt-1">{d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Com */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-6">
                <h3 className="font-bold text-emerald-600 dark:text-emerald-400 mb-4">Com o ConectaCRM</h3>
                <ul className="space-y-4">
                  {[
                    ["Estoque 100% controlado por IMEI", "Saiba exatamente o que tem e onde está."],
                    ["Vendas registradas em segundos", "PDV rápido, integrado e sem complicação."],
                    ["Assistência técnica organizada", "Ordens, status e histórico de cada aparelho."],
                    ["Relatórios completos e inteligentes", "Dashboards que mostram o que importa."],
                    ["Automação que faz o trabalho por você", "Mais eficiência para focar no que realmente importa."],
                  ].map(([t, d]) => (
                    <li key={t} className="flex gap-3">
                      <span className="mt-0.5 h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0">
                        <Check className="h-3 w-3" />
                      </span>
                      <div>
                        <p className="font-semibold text-sm leading-tight">{t}</p>
                        <p className="text-xs text-muted-foreground mt-1">{d}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Arrow */}
              <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background border border-border shadow-lg items-center justify-center z-10">
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
            </div>
          </div>

          {/* RIGHT: image + floating card */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl">
              <img
                src={ownerStore}
                alt="Lojista feliz usando o ConectaCRM no celular"
                width={1024}
                height={1024}
                loading="lazy"
                className="w-full h-auto object-cover aspect-[4/3]"
              />
            </div>
            <div className="absolute -right-2 sm:-right-4 top-6 bg-card border border-border rounded-2xl shadow-xl px-5 py-4 flex flex-col items-center text-center w-36">
              <span className="h-9 w-9 rounded-full bg-emerald-500/15 grid place-items-center text-emerald-500 mb-2">
                <CreditCard className="h-4 w-4" />
              </span>
              <p className="font-bold text-lg leading-none">+3.000</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">lojas já confiam no ConectaCRM</p>
            </div>
          </div>
        </div>

        {/* Bottom result strip */}
        <div className="mt-16 rounded-3xl border border-border bg-card overflow-hidden grid md:grid-cols-[1fr_2fr_1fr]">
          <div className="hidden md:block">
            <img src={customerHappy} alt="Cliente satisfeita" width={1024} height={768} loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div className="p-8 md:p-12 text-center flex flex-col justify-center">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">O resultado que sua loja merece</span>
            <h3 className="text-2xl md:text-3xl font-bold mt-3">
              Organize sua loja, encante seus clientes e venda muito mais!
            </h3>
            <div className="grid grid-cols-3 gap-4 mt-8">
              {[
                { icon: Clock, title: "Economize tempo", desc: "Automatize tarefas e foque em vender." },
                { icon: TrendingUp, title: "Aumente suas vendas", desc: "Atendimento rápido e informações na palma da mão." },
                { icon: Heart, title: "Clientes satisfeitos", desc: "Pós-venda eficiente e relacionamento que fideliza." },
              ].map((b) => (
                <div key={b.title} className="flex flex-col items-center text-center">
                  <b.icon className="h-7 w-7 text-emerald-500 mb-2" />
                  <p className="font-semibold text-sm">{b.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:block">
            <img src={attendantLaptop} alt="Atendente trabalhando no ConectaCRM" width={1024} height={768} loading="lazy" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>


      <section id="funcionalidades" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">Funcionalidades</span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mt-4 leading-[1.05] tracking-tight">
            Tudo que sua loja precisa.<br />
            Em um <span className="text-primary">só sistema.</span>
          </h2>
          <p className="mt-5 text-muted-foreground text-base md:text-lg">
            Do atendimento à venda, do estoque ao pós-venda — tudo conectado e automatizado para você vender mais e se preocupar menos.
          </p>
        </div>

        {/* Feature cards grid: image left, content right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[
            {
              img: featImei, icon: Box, title: "Estoque por IMEI",
              desc: "Controle total de cada aparelho com histórico completo, entradas, saídas e localização.",
              mock: (
                <div className="rounded-xl bg-card border border-border shadow-sm p-3 text-[11px]">
                  <div className="flex items-center justify-between mb-2 text-muted-foreground">
                    <span className="font-semibold text-foreground">Estoque por IMEI</span>
                    <span className="text-[10px]">Buscar IMEI ▾</span>
                  </div>
                  {[
                    ["iPhone 14 128GB","356789102345678"],
                    ["Samsung S23 256GB","359071102346679"],
                    ["Xiaomi Redmi Note 12","861152060012456"],
                    ["Motorola Edge 30","351682120045678"],
                  ].map(([a,b])=>(
                    <div key={b} className="flex justify-between py-1 border-t border-border/60">
                      <span>{a}</span><span className="text-muted-foreground">{b}</span>
                    </div>
                  ))}
                  <div className="text-right text-primary font-semibold mt-2">Ver tudo →</div>
                </div>
              ),
            },
            {
              img: featPdv, icon: CreditCard, title: "PDV rápido",
              desc: "Venda em segundos com leitura de IMEI, formas de pagamento e emissão de comprovantes.",
              mock: (
                <div className="rounded-xl bg-card border border-border shadow-sm p-3 text-[11px]">
                  <div className="font-semibold mb-2">Nova venda</div>
                  <div className="flex items-center justify-between py-1.5 border-t border-border/60">
                    <div>
                      <div className="font-medium">iPhone 14 128GB</div>
                      <div className="text-muted-foreground text-[10px]">IMEI: 356789102345678</div>
                    </div>
                    <span className="font-semibold">R$ 3.499,00</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-border/60">
                    <span>Total</span><span className="text-primary font-bold">R$ 3.499,00</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t border-border/60">
                    <span>Pagamento</span><span className="text-muted-foreground">Pix</span>
                  </div>
                </div>
              ),
            },
            {
              img: featAssist, icon: Wrench, title: "Assistência técnica",
              desc: "Ordens de serviço organizadas do início ao fim, com status, histórico e garantias.",
              mock: (
                <div className="rounded-xl bg-card border border-border shadow-sm p-3 text-[11px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Ordens de serviço</span>
                    <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">+ Nova OS</span>
                  </div>
                  {[
                    ["#1254","Tela quebrada","Em andamento","bg-amber-500/15 text-amber-600"],
                    ["#1253","Não liga","Aguardando peça","bg-orange-500/15 text-orange-600"],
                    ["#1252","Troca de bateria","Concluída","bg-emerald-500/15 text-emerald-600"],
                    ["#1251","Alto-falante","Orçamento","bg-sky-500/15 text-sky-600"],
                  ].map(([id,t,s,c])=>(
                    <div key={id} className="flex justify-between items-center py-1 border-t border-border/60">
                      <span className="text-muted-foreground">{id}</span>
                      <span className="flex-1 ml-2">{t}</span>
                      <span className={`text-[9.5px] px-1.5 py-0.5 rounded ${c}`}>{s}</span>
                    </div>
                  ))}
                  <div className="text-right text-primary font-semibold mt-2">Ver todas →</div>
                </div>
              ),
            },
            {
              img: featCrm, icon: MessageCircle, title: "CRM com WhatsApp",
              desc: "Atenda, registre e venda diretamente pelo WhatsApp. Tudo salvo no CRM da sua loja.",
              mock: (
                <div className="rounded-xl bg-card border border-border shadow-sm p-3 text-[11px] space-y-1.5">
                  <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                    <div className="h-7 w-7 rounded-full bg-emerald-500/20 grid place-items-center text-emerald-600 font-bold">C</div>
                    <div>
                      <div className="font-semibold leading-tight">Cliente</div>
                      <div className="text-[9.5px] text-emerald-600">online</div>
                    </div>
                  </div>
                  <div className="bg-muted/60 rounded-lg rounded-tl-none px-2.5 py-1.5 max-w-[80%]">Olá! Ainda tem iPhone 14 128GB?</div>
                  <div className="bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 rounded-lg rounded-tr-none px-2.5 py-1.5 max-w-[80%] ml-auto">Temos sim! Quer reservar?</div>
                  <div className="bg-muted/60 rounded-lg rounded-tl-none px-2.5 py-1.5 max-w-[80%]">Quero sim, pode separar 😊</div>
                </div>
              ),
            },
            {
              img: featReports, icon: BarChart3, title: "Relatórios inteligentes",
              desc: "Dashboards completos para você tomar decisões melhores e aumentar seus lucros.",
              mock: (
                <div className="rounded-xl bg-card border border-border shadow-sm p-3 text-[11px]">
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">Resumo geral</span>
                    <span className="text-[10px] text-muted-foreground">Este mês ▾</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[["Vendas","R$ 85.560","+12,5%"],["Lucro","R$ 18.750","+15,8%"],["Tickets","1.248","+9,4%"]].map(([l,v,p])=>(
                      <div key={l}>
                        <div className="text-[9.5px] text-muted-foreground">{l}</div>
                        <div className="font-bold">{v}</div>
                        <div className="text-emerald-600 text-[9.5px]">{p}</div>
                      </div>
                    ))}
                  </div>
                  <svg viewBox="0 0 100 30" className="w-full h-10">
                    <polyline fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary"
                      points="0,25 12,20 24,22 36,15 48,18 60,10 72,12 84,5 100,8" />
                  </svg>
                </div>
              ),
            },
            {
              img: featAi, icon: Bot, title: "Automação com IA",
              desc: "O sistema trabalha por você: sugere ações, alerta oportunidades e automatiza tarefas do dia a dia.",
              mock: (
                <div className="rounded-xl bg-card border border-border shadow-sm p-3 text-[11px] space-y-1.5">
                  <div className="font-semibold mb-1">Sugestões para sua loja</div>
                  {[
                    [Users,"3 clientes não retornaram","Faça um follow-up"],
                    [Box,"Estoque baixo","7 produtos com estoque crítico"],
                    [TrendingUp,"Oportunidade de venda","5 clientes interessados"],
                  ].map(([Ic,t,d]:any,i)=>(
                    <div key={i} className="flex gap-2 py-1 border-t border-border/60">
                      <div className="h-7 w-7 rounded-lg bg-primary/15 grid place-items-center text-primary shrink-0"><Ic className="h-3.5 w-3.5"/></div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
          ].map((f) => (
            <div key={f.title} className="group relative rounded-3xl border border-border bg-card overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="grid grid-cols-2 h-full">
                <div className="relative overflow-hidden">
                  <img src={f.img} alt={f.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-5 flex flex-col gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 grid place-items-center text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg leading-tight">{f.title}</h3>
                  <p className="text-[12.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
              <div className="px-5 pb-5 -mt-1">
                {f.mock}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom big card: "Enquanto você vende, o sistema organiza tudo" */}
        <div className="mt-8 rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
            <div className="lg:col-span-3 p-8 lg:p-10">
              <span className="text-[11px] font-semibold text-primary uppercase tracking-[0.18em]">Controle total da sua operação</span>
              <h3 className="mt-3 text-2xl md:text-3xl font-bold leading-tight">
                Enquanto você vende,<br />
                o sistema organiza tudo<br />
                <span className="text-primary">automaticamente.</span>
              </h3>
              <div className="grid grid-cols-1 gap-4 mt-6">
                {[
                  [ShieldCheck,"Seguro e confiável","Seus dados sempre protegidos"],
                  [Cloud,"Acesse de onde estiver","Na loja, em casa ou pelo celular"],
                  [Headphones,"Suporte humano","Atendimento rápido e especializado"],
                ].map(([Ic,t,d]:any)=>(
                  <div key={t} className="flex gap-3 items-start">
                    <div className="h-9 w-9 rounded-lg bg-primary/15 grid place-items-center text-primary shrink-0"><Ic className="h-4 w-4"/></div>
                    <div>
                      <div className="font-semibold text-sm">{t}</div>
                      <div className="text-xs text-muted-foreground">{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-6 relative h-full min-h-[280px]">
              <img src={featDevices} alt="Sistema em laptop e celular" loading="lazy" className="w-full h-full object-contain p-4" />
            </div>
            <div className="lg:col-span-3 p-8 lg:p-10 lg:border-l border-border">
              <Quote className="h-7 w-7 text-primary/50 mb-3" />
              <p className="text-sm md:text-[15px] leading-relaxed text-foreground/90">
                O ConectaCRM mudou totalmente a forma como gerencio minha loja. Hoje tenho tempo, controle e resultados de verdade!
              </p>
              <div className="flex items-center gap-3 mt-5">
                <img src={testimonialLeandro} alt="Leandro Silva" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-sm">Leandro Silva</div>
                  <div className="text-[11px] text-muted-foreground">Loja Conexão Cell · Cliente desde 2023</div>
                </div>
              </div>
              <div className="flex gap-0.5 mt-2">
                {[0,1,2,3,4].map(i=>(<Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENTIALS */}
      <section id="diferenciais" className="bg-card/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Por que ConectaCRM</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3">Superior em cada detalhe</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {differentials.map((d) => (
              <div key={d.title} className="rounded-2xl bg-card border border-border p-6">
                <d.icon className="h-7 w-7 text-emerald-500 mb-4" />
                <h3 className="font-semibold mb-2">{d.title}</h3>
                <p className="text-sm text-muted-foreground">{d.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "+3.000", label: "Lojas ativas no Brasil", icon: Store },
            { value: "98%", label: "Clientes que renovam", icon: Heart },
            { value: "24/7", label: "Suporte humano em PT-BR", icon: Headphones },
            { value: "5 min", label: "Para começar a vender", icon: Zap },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-6 text-center">
              <s.icon className="h-6 w-6 text-emerald-500 mx-auto mb-3" />
              <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-card/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Depoimentos</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3">Quem usa, recomenda</h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Histórias reais de lojistas que transformaram a operação com o ConectaCRM.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Rafael Mendes",
                role: "Conexão Mobile · São Paulo/SP",
                text: "Em 30 dias triplicamos as vendas online. O controle por IMEI acabou com o sumiço de aparelhos no balcão.",
                initial: "R",
              },
              {
                name: "Juliana Costa",
                role: "JC Celulares · Belo Horizonte/MG",
                text: "A IA Blue cuida do pós-venda sozinha. Recebo avaliação 5 estrelas sem mover um dedo. Mudou meu negócio.",
                initial: "J",
              },
              {
                name: "Marcos Almeida",
                role: "Tech Repair · Curitiba/PR",
                text: "Saí de planilhas para um sistema completo em 1 dia. As ordens de serviço com etiqueta nunca mais se perderam.",
                initial: "M",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl bg-card border border-border p-7 flex flex-col">
                <Quote className="h-7 w-7 text-primary/40 mb-4" />
                <p className="text-foreground/90 leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-border">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-emerald-500 grid place-items-center text-primary-foreground font-bold">
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                  <BadgeCheck className="h-4 w-4 text-emerald-500 ml-auto" />
                </div>
                <div className="flex gap-0.5 mt-4">
                  {[0,1,2,3,4].map(i => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Integrações</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-3">Funciona com as ferramentas que você já usa</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {[
            "WhatsApp", "Instagram", "Mercado Pago", "PagSeguro", "Stone", "PIX",
            "Correios", "Bling", "NF-e", "Google", "Meta Ads", "Zapier",
          ].map((name) => (
            <div key={name} className="h-16 rounded-xl border border-border bg-card grid place-items-center text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition">
              {name}
            </div>
          ))}
        </div>
      </section>

      <section id="planos" className="max-w-7xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Planos</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-3">Confira nossos planos</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Escolha o plano ideal para o tamanho da sua loja. Cancele quando quiser.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-8 flex flex-col ${
                p.highlight
                  ? "bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground shadow-2xl scale-[1.02]"
                  : "bg-card border border-border"
              }`}
            >
              {p.highlight && p.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-background text-foreground border border-border rounded-full px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                  <Crown className="h-3.5 w-3.5 text-amber-500" /> {p.badge}
                </div>
              )}
              <p className={`text-sm ${p.highlight ? "opacity-90" : "text-muted-foreground"}`}>{p.pitch}</p>
              <h3 className="text-4xl font-bold mt-2 mb-6">{p.name}</h3>

              <ul className="space-y-3 flex-1 mb-8">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className={`mt-0.5 h-5 w-5 rounded-full grid place-items-center shrink-0 ${
                      p.highlight ? "bg-white/20" : "bg-emerald-500/15 text-emerald-500"
                    }`}>
                      <Check className="h-3 w-3" />
                    </span>
                    <span className={p.highlight ? "" : "text-foreground/90"}>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="text-center mb-2">
                <div className="flex items-baseline justify-center gap-1">
                  <span className={`text-base ${p.highlight ? "opacity-80" : "text-muted-foreground"}`}>12x</span>
                  <span className="text-5xl font-bold">{p.annual}</span>
                </div>
                <p className={`text-sm mt-2 ${p.highlight ? "opacity-90" : "text-muted-foreground"}`}>
                  Mensal R$ {p.monthly}
                </p>
                <p className={`text-xs mt-1 ${p.highlight ? "opacity-75" : "text-muted-foreground"}`}>
                  Pacote anual. Prossiga para ver a condição mensal.
                </p>
              </div>

              <Link to="/registro" className="mt-6">
                <Button
                  size="lg"
                  variant={p.highlight ? "secondary" : "default"}
                  className={`w-full rounded-full font-semibold ${
                    p.highlight ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300" : ""
                  }`}
                >
                  {p.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* COMPARISON */}
      <section className="bg-card/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-24">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Comparativo</span>
            <h2 className="text-3xl md:text-5xl font-bold mt-3">ConectaCRM vs. concorrentes</h2>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="grid grid-cols-3 text-sm">
              <div className="p-4 font-semibold border-b border-border">Recurso</div>
              <div className="p-4 font-semibold border-b border-border bg-primary/5 text-center">ConectaCRM</div>
              <div className="p-4 font-semibold border-b border-border text-center text-muted-foreground">Outros</div>
              {[
                ["Estoque por IMEI/SN", true, true],
                ["IA de pós-venda integrada", true, false],
                ["App iOS e Android nativos", true, true],
                ["Catálogo online incluso", true, false],
                ["Logins ilimitados (Pro Max)", true, false],
                ["Atualizações semanais", true, false],
                ["Suporte humano em PT-BR", true, true],
                ["Setup em 5 minutos", true, false],
              ].map(([label, us, them], i) => (
                <div key={i} className="contents">
                  <div className="p-4 border-b border-border">{label as string}</div>
                  <div className="p-4 border-b border-border bg-primary/5 text-center">
                    {us ? <Check className="h-5 w-5 text-emerald-500 inline" /> : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div className="p-4 border-b border-border text-center">
                    {them ? <Check className="h-5 w-5 text-muted-foreground inline" /> : <span className="text-muted-foreground">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Dúvidas</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-3">Perguntas frequentes</h2>
        </div>
        <div className="space-y-4">
          {[
            { q: "Posso testar antes de pagar?", a: "Sim. Você tem 3 dias grátis para testar todos os recursos do plano Pro Max, sem precisar de cartão." },
            { q: "Tem fidelidade?", a: "Não. Você pode cancelar quando quiser. O pacote anual oferece desconto, mas é opcional." },
            { q: "Meus dados ficam seguros?", a: "Sim. Usamos criptografia em repouso e em trânsito, com backups diários e isolamento total entre lojas." },
            { q: "Funciona offline?", a: "O sistema é cloud-first, mas o app mobile mantém ações essenciais em cache para continuar vendendo se a internet cair." },
            { q: "Importam meus dados do sistema antigo?", a: "Sim. Importamos seu estoque, clientes e histórico via planilha, sem custo, em qualquer plano." },
          ].map((item) => (
            <details key={item.q} className="group rounded-xl border border-border bg-card p-5">
              <summary className="cursor-pointer font-semibold flex items-center justify-between list-none">
                {item.q}
                <span className="ml-4 text-muted-foreground group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground p-12 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/4 h-72 w-72 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl md:text-5xl font-bold max-w-2xl mx-auto">
              Pronto para vender mais e gerenciar melhor?
            </h2>
            <p className="mt-4 opacity-90 max-w-xl mx-auto">
              Junte-se a milhares de lojas que já transformaram a operação com o ConectaCRM.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/registro">
                <Button size="lg" variant="secondary" className="rounded-full text-base px-8 h-12 bg-white text-primary hover:bg-white/90">
                  Começar grátis agora <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="rounded-full text-base px-8 h-12 bg-transparent border-white/40 text-white hover:bg-white/10">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Smartphone className="h-4 w-4" /> ConectaCRM
          </div>
          <p>© {new Date().getFullYear()} ConectaCRM — Sistema completo para lojas de celular.</p>
        </div>
      </footer>
    </div>
  );
}
