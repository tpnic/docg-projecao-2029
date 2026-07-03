/* ==========================================================================
   CONFIG.JS — EDITE ESTE ARQUIVO PARA GERENCIAR USUARIOS MANUALMENTE.
   O jeito mais facil, porem, e usar a tela "Usuarios" dentro do dashboard
   (logado como admin) e depois clicar em "Copiar configuracao" — ela gera
   o conteudo pronto para colar aqui.

   IMPORTANTE: como este site e 100% estatico (sem servidor), estas senhas
   ficam visiveis a qualquer pessoa que abrir o codigo-fonte da pagina.
   Isso NAO e uma protecao contra invasao — e apenas um controle de
   organizacao, para cada pessoa ver uma versao do dashboard adequada ao
   seu perfil, sem mexer em telas/premissas por engano.
   ========================================================================== */

window.APP_CONFIG = {
  users: [
    // O usuario "admin" sempre tem acesso total + a tela "Usuarios".
    { username: "admin", password: "docg2026admin", role: "admin", name: "Administrador" },

    // Usuarios personalizados: adicione quantos quiser, cada um com seu proprio
    // conjunto de telas visiveis e permissoes. "views" aceita: "overview", "dre", "premissas".
    {
      username: "diretor",
      password: "docg2026",
      role: "custom",
      name: "Diretor",
      views: ["overview", "dre"],
      permissions: {
        canChangeScenario: true,
        canEditAssumptions: false,
        canChangeCompany: true,
      },
    },
  ],
};
