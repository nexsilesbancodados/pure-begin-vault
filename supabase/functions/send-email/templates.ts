export const getInviteEmailHtml = (token: string, inviterEmail: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { text-align: center; margin-bottom: 30px; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .footer { font-size: 12px; color: #777; margin-top: 30px; text-align: center; }
    .code { font-family: monospace; font-size: 18px; background: #f4f4f4; padding: 10px; border-radius: 5px; display: inline-block; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #007bff;">ConectaCRM</h1>
    </div>
    <p>Olá!</p>
    <p>Você foi convidado por <strong>${inviterEmail}</strong> para se juntar à equipe no <strong>ConectaCRM</strong>.</p>
    <p>Para aceitar o convite, utilize o código de autenticação abaixo ou clique no botão:</p>
    
    <div style="text-align: center;">
      <div class="code">${token}</div>
      <br>
      <a href="https://www.conectaphone.com/signup?token=${token}" class="btn">Aceitar Convite</a>
    </div>

    <p style="margin-top: 20px;">Este link e código são de <strong>uso único</strong> e expiram em 7 dias.</p>
    
    <div class="footer">
      <p>&copy; 2026 ConectaCRM - www.conectaphone.com</p>
      <p>Se você não esperava este e-mail, pode ignorá-lo com segurança.</p>
    </div>
  </div>
</body>
</html>
`;

export const getWelcomeEmailHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { text-align: center; margin-bottom: 30px; }
    .footer { font-size: 12px; color: #777; margin-top: 30px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: #28a745;">Bem-vindo ao ConectaCRM!</h1>
    </div>
    <p>Olá ${name},</p>
    <p>Sua conta foi criada com sucesso e você já faz parte da nossa plataforma.</p>
    <p>O ConectaCRM vai te ajudar a gerenciar seus leads, automações e vendas de forma integrada.</p>
    <p>Comece agora acessando seu painel:</p>
    <div style="text-align: center;">
      <a href="https://www.conectaphone.com/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Dashboard</a>
    </div>
    <div class="footer">
      <p>&copy; 2026 ConectaCRM - www.conectaphone.com</p>
    </div>
  </div>
</body>
</html>
`;
