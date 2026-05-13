import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — ConectaCRM" },
      {
        name: "description",
        content:
          "Saiba como o ConectaCRM coleta, armazena e protege seus dados conforme a LGPD, e quais são seus direitos como titular.",
      },
      { property: "og:title", content: "Política de Privacidade — ConectaCRM" },
      {
        property: "og:description",
        content: "Como o ConectaCRM trata seus dados pessoais conforme a LGPD.",
      },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
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
        <h1>Política de Privacidade</h1>
        <p className="text-slate-500">Última atualização: 10 de maio de 2026</p>

        <h2>1. Dados coletados</h2>
        <ul>
          <li>Cadastro: nome, e-mail, telefone, empresa.</li>
          <li>Uso: leads, mensagens, vendas, atendimentos que você registra.</li>
          <li>Pagamento: processado pelo Mercado Pago — não armazenamos dados de cartão.</li>
          <li>Técnicos: IP, navegador, logs de acesso.</li>
        </ul>

        <h2>2. Finalidade</h2>
        <p>
          Operar a plataforma, executar automações que você configura, emitir faturas, melhorar o
          serviço e cumprir obrigações legais.
        </p>

        <h2>3. Base legal (LGPD)</h2>
        <p>
          Execução de contrato (art. 7º, V), cumprimento de obrigação legal (II), legítimo interesse
          (IX) e seu consentimento quando aplicável (I).
        </p>

        <h2>4. Compartilhamento</h2>
        <p>
          Compartilhamos dados apenas com processadores essenciais: Supabase (hospedagem), Mercado
          Pago (pagamentos), Meta/WhatsApp (quando você integra). Nunca vendemos dados.
        </p>

        <h2>5. Seus direitos</h2>
        <p>
          Você pode solicitar a qualquer momento: acesso, correção, exportação, anonimização ou
          exclusão dos seus dados. Basta enviar e-mail para privacidade@conectacrm.com.
        </p>

        <h2>6. Retenção</h2>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa e por até 5 anos após o cancelamento,
          para cumprir obrigações fiscais.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Usamos criptografia em trânsito (TLS), senhas com hash, RLS no banco e backups diários.
        </p>

        <h2>8. Encarregado (DPO)</h2>
        <p>privacidade@conectacrm.com</p>

        <p className="mt-12">
          <Link to="/termos" className="text-indigo-600 underline">
            Ver Termos de Uso →
          </Link>
        </p>
      </main>
    </div>
  );
}
