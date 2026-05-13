import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Search,
  MessageCircle,
  ShoppingCart,
  Wrench,
  Package,
  DollarSign,
  Bot,
  Shield,
  Store,
  Smartphone,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [{ title: "Central de Ajuda · ConectaCRM" }],
  }),
  component: HelpPage,
});

type Article = {
  id: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
};

const ARTICLES: Article[] = [
  {
    id: "primeiro-acesso",
    category: "Começando",
    title: "Primeiro acesso e configuração inicial",
    excerpt: "Como configurar sua loja em 5 minutos depois de criar a conta.",
    body: `# Primeiro acesso\n\n1. Cadastre-se em /registro com seu email.\n2. Confirme o email pelo link recebido.\n3. No primeiro login, faça o onboarding (perfil, empresa, primeiro produto).\n4. Em **Configurações da Loja** (/configuracoes/loja), configure:\n   - Chave Pix (CPF/CNPJ/email/telefone)\n   - PIN do gerente\n   - % de comissão padrão\n5. Em **WhatsApp** (/whatsapp), crie uma instância e escaneie o QR.\n6. Importe seus produtos via CSV em **Estoque**.`,
  },
  {
    id: "conectar-whatsapp",
    category: "WhatsApp",
    title: "Como conectar WhatsApp",
    excerpt: "Passo a passo pra parear seu número WhatsApp com o sistema.",
    body: `1. Vai em /whatsapp\n2. Clica em "Nova instância" e dá um nome (ex: "Loja Centro")\n3. Modal abre com QR Code\n4. No celular: WhatsApp > ⋮ > Aparelhos conectados > Conectar aparelho\n5. Aponta câmera pro QR\n6. Pronto! WhatsApp conectado e recebendo via webhook.\n\nO QR expira em 40s — se perder, clica "Gerar novo".`,
  },
  {
    id: "criar-os",
    category: "Serviços",
    title: "Como criar uma Ordem de Serviço (OS)",
    excerpt: "Abrir OS para aparelho na bancada com termo de recebimento.",
    body: `1. /servicos/nova\n2. Selecione o cliente (ou cadastre novo)\n3. Preencha: equipamento, marca, modelo, IMEI, senha/padrão, problema relatado, acessórios\n4. Defina orçamento estimado e previsão de entrega\n5. Salvar → cliente recebe WhatsApp automático "Recebemos seu aparelho"\n6. Imprima o **Termo de Recebimento** (link /os-termo/$id) em 2 vias para assinatura\n7. Compartilhe link de acompanhamento (/os-track/$id) com o cliente`,
  },
  {
    id: "pdv-venda",
    category: "Vendas",
    title: "Como fechar uma venda no PDV",
    excerpt: "Vender produtos com Pix QR, dinheiro, cartão e gerar cupom.",
    body: `1. /pdv\n2. Busca o produto (nome, SKU, EAN ou bipa o código)\n3. Adiciona ao carrinho\n4. Aplica desconto (se acima do limite, pede PIN do gerente)\n5. Escolhe pagamento: dinheiro, cartão ou Pix\n6. Para Pix: QR é gerado automaticamente — cliente paga, vendedor confirma\n7. Finaliza venda → cupom não-fiscal disponível pra imprimir/compartilhar\n8. Sangria/reforço de caixa em /caixa-pdv`,
  },
  {
    id: "bot-ia",
    category: "Automação",
    title: "Como configurar o bot de IA",
    excerpt: "Bot que responde clientes 24/7 com contexto de compras.",
    body: `1. /crm/bot\n2. Configura: prompt do sistema, horário comercial, modelo (DeepSeek free)\n3. Define mensagens de saudação e fallback\n4. Ativa\n\nO bot:\n- Lê catálogo de produtos automaticamente\n- Consulta histórico do cliente (compras, OS abertas, dias inativo)\n- Personaliza resposta\n- Faz handoff humano quando solicitado\n\nEm /crm/conversas, vê transcripts em tempo real.`,
  },
  {
    id: "automacoes",
    category: "Automação",
    title: "Ativando automações de WhatsApp e email",
    excerpt: "27 templates prontos pra ativar com 1 clique.",
    body: `1. /automacoes\n2. Filtre por categoria (Transacional, Operacional, Engajamento, Marketing)\n3. Clique "Ativar" nas que quer (recomendamos as marcadas com ✨)\n4. Edite mensagem se quiser (mantenha variáveis como {{cliente_nome}})\n\nDisparos imediatos: OS muda status, venda finaliza, lead chega\nDisparos diários (09h): aniversário, inativo 90d, OS atrasada, NPS pós-OS, garantia, recebíveis em atraso`,
  },
  {
    id: "multi-loja",
    category: "Lojas",
    title: "Como criar e alternar múltiplas lojas",
    excerpt: "1 conta gerencia várias lojas independentes.",
    body: `1. /lojas → "Nova loja" → dá nome\n2. No topo, clique no nome da loja ativa para trocar\n3. Cada loja tem estoque, vendas, OS, financeiro e equipe independentes\n4. Convide membros em /equipe-loja: gera link único, manda pelo WhatsApp\n\nCada loja conta separado pra limite do plano.`,
  },
  {
    id: "inventario",
    category: "Estoque",
    title: "Como fazer inventário (contagem física)",
    excerpt: "Contar estoque com leitor de código e ajustar diferenças.",
    body: `1. /inventario\n2. Bipa o produto com leitor (ou busca manual)\n3. Cada beep soma +1\n4. Pode ajustar manual com input numérico\n5. Vê diferenças coloridas (sobra/falta)\n6. Clique "Aplicar ajustes" → atualiza products.stock_quantity + grava em stock_movements`,
  },
  {
    id: "conciliacao-ofx",
    category: "Financeiro",
    title: "Conciliação bancária via OFX",
    excerpt: "Importa extrato do banco e casa com contas a receber/pagar.",
    body: `1. Baixa OFX do app/internet banking (Itaú, Bradesco, Nubank, etc)\n2. /conciliacao → "Escolher arquivo OFX"\n3. Sistema lê transações e tenta casar com accounts_receivable/payable em aberto\n4. Mostra confiança (% match) baseado em valor + data\n5. "Aplicar baixa" individual ou em lote pra todas alta confiança`,
  },
  {
    id: "cupom-orcamento",
    category: "Vendas",
    title: "Imprimir cupom e orçamento",
    excerpt: "Cupom não-fiscal 80mm térmico + orçamento A4.",
    body: `Após venda no PDV: clique "Cupom online" no modal de sucesso → abre /recibo/$id (compartilhável por link).\n\nOrçamento: ao salvar status='quote' em sales_orders, gera link /orcamento/$id com validade 7 dias.\n\nTermo OS: /os-termo/$id (2 vias com cláusulas + assinatura).\n\n**Atenção:** todos são cupons NÃO-FISCAIS. Para emissão de NF-e, contratar provedor (Focus NFe, eNotas, PlugNotas).`,
  },
  {
    id: "lgpd",
    category: "Privacidade",
    title: "LGPD: exportar e excluir dados",
    excerpt: "Seus direitos como titular de dados pessoais.",
    body: `Em /minha-conta/lgpd:\n- **Exportar dados**: baixa JSON com tudo (perfil, lojas, vendas, clientes, mensagens, etc)\n- **Excluir conta**: irreversível. Apaga vínculo com lojas, perfil, notificações, audit logs pessoais. Dados de lojas que você é dono permanecem.\n\nDPO: dpo@conectaphone.com`,
  },
];

const CATEGORIES = [
  { id: "Começando", icon: HelpCircle, color: "primary" },
  { id: "WhatsApp", icon: MessageCircle, color: "success" },
  { id: "Vendas", icon: ShoppingCart, color: "primary" },
  { id: "Serviços", icon: Wrench, color: "warning" },
  { id: "Estoque", icon: Package, color: "primary" },
  { id: "Financeiro", icon: DollarSign, color: "success" },
  { id: "Automação", icon: Bot, color: "primary" },
  { id: "Lojas", icon: Store, color: "primary" },
  { id: "Privacidade", icon: Shield, color: "warning" },
];

function HelpPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Article | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ARTICLES;
    return ARTICLES.filter((a) =>
      [a.title, a.excerpt, a.body, a.category].some((v) => v.toLowerCase().includes(q)),
    );
  }, [search]);

  const byCategory = useMemo(() => {
    const m: Record<string, Article[]> = {};
    for (const a of filtered) {
      if (!m[a.category]) m[a.category] = [];
      m[a.category].push(a);
    }
    return m;
  }, [filtered]);

  if (selected) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar title={selected.title} subtitle={selected.category} />
          <main className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-primary font-bold mb-4 hover:underline"
            >
              ← Voltar
            </button>
            <Card className="p-6">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {selected.body}
              </pre>
            </Card>
            <Card className="p-4 mt-4 bg-muted/40 text-xs">
              <p className="font-bold mb-1">Ainda com dúvida?</p>
              <p className="text-muted-foreground">
                Envie email pra <strong>suporte@conectaphone.com</strong> ou WhatsApp para nossa
                equipe.
              </p>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title="Central de Ajuda"
          subtitle="Tutoriais e respostas pras dúvidas mais comuns"
        />
        <main className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-4">
          <Card className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar artigo, palavra-chave, função..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          </Card>

          {CATEGORIES.filter((c) => byCategory[c.id]?.length).map((c) => {
            const arts = byCategory[c.id];
            return (
              <div key={c.id}>
                <h3 className="font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                  <c.icon className="h-4 w-4 text-primary" /> {c.id}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {arts.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="text-left p-3 rounded-xl border border-border hover:border-primary/40 bg-card transition"
                    >
                      <p className="font-bold text-sm">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.excerpt}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <Card className="p-10 text-center">
              <HelpCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-bold">Nenhum artigo encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tente outras palavras-chave ou envie email pra{" "}
                <strong>suporte@conectaphone.com</strong>.
              </p>
            </Card>
          )}

          <Card className="p-5 bg-muted/40">
            <p className="font-bold text-sm mb-2">Não encontrou o que precisa?</p>
            <p className="text-xs text-muted-foreground mb-3">
              Nosso time responde em até 24h (planos Pro e Business têm prioridade).
            </p>
            <a
              href="mailto:suporte@conectaphone.com"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs"
            >
              <MessageCircle className="h-3 w-3" /> Enviar mensagem
            </a>
          </Card>
        </main>
      </div>
    </div>
  );
}
