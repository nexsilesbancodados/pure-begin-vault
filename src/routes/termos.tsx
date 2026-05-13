import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — ConectaCRM" },
      {
        name: "description",
        content:
          "Conheça os termos contratuais que regem o uso do ConectaCRM, incluindo direitos, deveres, planos, cancelamento e responsabilidades.",
      },
      { property: "og:title", content: "Termos de Uso — ConectaCRM" },
      { property: "og:description", content: "Termos contratuais da plataforma ConectaCRM." },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-slate-900">
            ConectaCRM
          </Link>
          <Link to="/login" className="text-sm font-semibold text-indigo-600">
            Entrar
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-16 prose prose-slate">
        <h1>Termos de Uso</h1>
        <p className="text-slate-500">Última atualização: 12 de maio de 2026</p>

        <h2>1. Aceitação</h2>
        <p>
          Ao acessar ou usar o ConectaCRM, você concorda em ficar vinculado a estes Termos. Se você
          não concorda, não utilize o serviço.
        </p>

        <h2>2. Descrição do serviço</h2>
        <p>
          O ConectaCRM é uma plataforma SaaS para gestão de leads, atendimento, vendas, estoque e
          automações. O serviço é oferecido em planos pagos com diferentes limites e recursos.
        </p>

        <h2>3. Conta e cadastro</h2>
        <p>
          Você é responsável pela segurança das suas credenciais. Informações falsas, uso
          fraudulento ou compartilhamento indevido podem resultar em suspensão.
        </p>

        <h2>4. Pagamentos e assinatura</h2>
        <p>
          O acesso à plataforma depende de assinatura ativa. Cobranças são processadas via Mercado
          Pago. Você pode cancelar a qualquer momento; o acesso permanece até o fim do período pago.
        </p>

        <h2>5. Reembolso</h2>
        <p>
          Conforme o Código de Defesa do Consumidor, você pode solicitar reembolso integral em até 7
          dias após a contratação.
        </p>

        <h2>6. Uso aceitável</h2>
        <p>
          É proibido enviar spam, conteúdo ilegal, violar leis (incluindo a LGPD) ou tentar acessar
          dados de outros usuários. Violações podem resultar em encerramento imediato.
        </p>

        <h2>7. Limitação de responsabilidade</h2>
        <p>
          O serviço é fornecido "como está". O ConectaCRM não se responsabiliza por lucros
          cessantes, perda de dados decorrente de mau uso ou indisponibilidades de terceiros (Meta,
          Mercado Pago, etc.).
        </p>

        <h2>8. Alterações</h2>
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão notificadas com 30 dias de
          antecedência.
        </p>

        <h2>9. Não-emissão de NF-e</h2>
        <p>
          O ConectaCRM emite cupons não-fiscais e orçamentos para uso interno e relacionamento com
          clientes. Para emissão de NF-e/NFC-e formal você deve usar um sistema fiscal próprio
          integrado com SEFAZ.
        </p>

        <h2>10. Contato</h2>
        <p>Dúvidas: contato@conectaphone.com</p>

        <p className="mt-12">
          <Link to="/privacidade" className="text-indigo-600 underline">
            Ver Política de Privacidade →
          </Link>
        </p>
      </main>
    </div>
  );
}
