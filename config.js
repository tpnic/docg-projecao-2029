/* ==========================================================================
   CONFIG.JS — EDITE ESTE ARQUIVO PARA TROCAR SENHAS E CONTROLAR O QUE O
   DIRETOR PODE VER. Depois de editar, salve e publique novamente no
   GitHub Pages (commit + push) para as mudanças valerem para todo mundo.

   IMPORTANTE: como este site é 100% estático (sem servidor), estas senhas
   ficam visíveis a qualquer pessoa que abrir o código-fonte da página.
   Isso NÃO é uma proteção contra invasão — é apenas um controle de
   organização, para que o diretor veja uma versão mais enxuta do
   dashboard, sem mexer nas premissas por engano.
   ========================================================================== */

window.APP_CONFIG = {
  // ---- Usuários e senhas (troque à vontade) ----
  users: {
    admin: {
      password: "docg2026admin",
      role: "admin",
      name: "Administrador",
    },
    diretor: {
      password: "dxa2026",
      role: "diretor",
      name: "Diretor",
    },
  },

  // ---- O que o papel "diretor" pode ver ----
  // Opções possíveis: "overview", "dre", "mensal", "fluxo", "cenarios", "premissas"
  // Remova da lista qualquer item que você não quer que o diretor veja.
  directorVisibleViews: ["overview", "dre", "fluxo", "cenarios"],

  // ---- O que o diretor pode fazer dentro das telas liberadas ----
  directorPermissions: {
    canChangeScenario: true,   // pode clicar em Conservador/Realista/Agressivo
    canEditAssumptions: false, // pode arrastar os sliders de premissas (Personalizado)
  },
};
