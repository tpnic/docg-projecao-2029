# Docg Group — Dashboard de Projeção Financeira 2027-2029

Dashboard interativo (FP&A) com a projeção financeira do Docg Group para o período 2027-2029, partindo do Orçamento 2026 aprovado (Coralina Alimentos, Franqueadora, Distribuidora, Docg Tech e Docg S.A.).

100% estático (HTML + CSS + JavaScript). Não requer backend, servidor ou build step — funciona diretamente no navegador e pode ser publicado gratuitamente no **GitHub Pages**.

## Arquivos

```
/index.html   → estrutura da aplicação (login, sidebar, cards, tabelas, gráficos)
/style.css    → sistema visual (paleta teal/branco da marca Docg, layout responsivo)
/config.js    → usuários/senhas e o que a conta "diretor" pode ver (edite aqui)
/auth.js      → tela de login e controle de acesso por papel
/script.js    → motor de cálculo financeiro + renderização dos gráficos (Chart.js)
/data.json    → base 2026 por empresa + premissas dos 3 cenários
/assets/      → logos Docg (usados no login e na barra lateral)
/README.md    → este arquivo
```

O motor de cálculo em `script.js` replica a mesma lógica usada no arquivo Excel entregue junto — a receita cresce e todos os drivers da DRE (CMV, marketing, folha, despesas administrativas, financeiras, impostos, capex) são aplicados sobre a base 2026 de cada empresa.

## O que tem no dashboard

- **Filtro de empresa** (topo): Consolidado (as 5 empresas somadas) ou cada empresa isoladamente — Coralina, Franqueadora, Distribuidora, Tech, S.A.
- **Painel de Premissas**: os 10 drivers agrupados por categoria da DRE (Receita, Custos, Comercial, Operacional, Investimento, Financeiro/Macro), com sliders que recalculam tudo em tempo real.
- **Cenários**: Conservador / Realista / Agressivo / Personalizado.
- **Visão Geral**: KPIs com tooltip explicativo (passe o mouse no ícone "i"), ponte de valor da receita, gráficos que reagem aos drivers.
- **DRE Projetada**: tabela com linhas totalizadoras — clique no **(+)** para abrir a composição (quais despesas/receitas entram em cada total). Filtro de período: ano específico (visão mensal) ou "Todos" (visão anual 2026-2029).
- **Premissas**: mesma organização por categoria, com o racional de cada driver.
- Marca **"Documento Confidencial"** no rodapé e na barra lateral (sem menção a nenhum fundo específico, para reuso com diferentes investidores/stakeholders).

## Login e controle de acesso

O dashboard abre com uma tela de login. Duas contas vêm configuradas por padrão (edite em `config.js`):

| Usuário   | Senha           | Papel                                                   |
|-----------|-----------------|------------------------------------------------------------|
| `admin`   | `docg2026admin` | Acesso completo + tela "Controle de Acesso"              |
| `diretor` | `docg2026`      | Somente Visão Geral e DRE Projetada, sem editar premissas |

**⚠️ Importante — leia antes de publicar:** este é um site 100% estático, sem servidor. Isso significa que **não existe segurança real** aqui — qualquer pessoa com conhecimento técnico consegue abrir o código-fonte da página (`config.js`) e ver as senhas. É um controle **organizacional**, pensado para quem vai receber o link não precisar navegar por telas/controles que não interessam, e não para proteger dados confidenciais de terceiros mal-intencionados.

**Antes de publicar, troque as senhas padrão** em `config.js`:

```js
users: {
  admin:   { password: "SUA_SENHA_AQUI", role: "admin",   name: "Administrador" },
  diretor: { password: "OUTRA_SENHA",     role: "diretor", name: "Diretor" },
},
```

### Como escolher o que o diretor vê

1. Faça login como `admin`.
2. Vá em **Controle de Acesso** (menu lateral).
3. Marque/desmarque as telas que o diretor deve ver, e as permissões (pode trocar de cenário? pode editar premissas? pode trocar o filtro de empresa?).
4. A mudança já é testável na hora, no seu navegador (clique em Sair e entre como `diretor` para conferir).
5. Para a mudança valer **para qualquer pessoa, em qualquer computador**, clique em **Copiar configuração**, cole o trecho copiado dentro de `config.js` (substituindo `directorVisibleViews` e `directorPermissions`), salve e publique novamente (commit + push) no GitHub Pages.

## Como publicar gratuitamente no GitHub Pages

### Opção 1 — via interface do GitHub (mais simples)

1. Crie uma conta gratuita em [github.com](https://github.com) (se ainda não tiver).
2. Clique em **New repository** (repositório novo). Dê um nome, por exemplo `docg-projecao-2029`. Deixe como **Public**.
3. Dentro do repositório recém-criado, clique em **Add file → Upload files**.
4. Arraste os arquivos desta pasta (`index.html`, `style.css`, `config.js`, `auth.js`, `script.js`, `data.json`, `README.md` **e a pasta `assets/`** com os logos) para a área de upload.
5. Clique em **Commit changes** para salvar.
6. Vá em **Settings → Pages** (menu lateral esquerdo).
7. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
8. Em **Branch**, selecione `main` e a pasta `/ (root)`. Clique em **Save**.
9. Aguarde 1-2 minutos. O GitHub mostrará o link público, algo como:
   `https://SEU-USUARIO.github.io/docg-projecao-2029/`
10. Pronto — esse link já pode ser compartilhado.

### Opção 2 — via linha de comando (Git)

```bash
# dentro da pasta com os arquivos do dashboard
git init
git add index.html style.css config.js auth.js script.js data.json README.md assets
git commit -m "Dashboard FP&A - Projecao 2027-2029"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/docg-projecao-2029.git
git push -u origin main
```

Depois, ative o GitHub Pages em **Settings → Pages** como descrito na Opção 1 (passos 6-9).

### Atualizar o dashboard depois de publicado

Basta editar/substituir os arquivos e enviar novamente:

```bash
git add .
git commit -m "Atualiza premissas"
git push
```

O GitHub Pages atualiza o site publicado automaticamente em 1-2 minutos. **Dica:** se depois de publicar algo não mudar na hora, dê um hard refresh no navegador (`Ctrl+Shift+R`) — o navegador e a CDN do GitHub Pages guardam cache por alguns minutos.

## Notas metodológicas

- **Base 2026**: orçamento aprovado por empresa — Coralina Alimentos, Franqueadora, Distribuidora, Docg Tech e Docg S.A. (holding). O "Consolidado" é a soma das 5.
- **Fasamento mensal**: contas proporcionais à receita (Receita Bruta, Deduções, CMV, Marketing, Comercial, IRPJ/CSLL) seguem o índice sazonal observado em 2026 de cada empresa; contas fixas/periódicas (Folha, Administrativas, D&A, Receitas/Despesas Financeiras) são distribuídas em 12 parcelas iguais.
- **Regime tributário**: IRPJ/CSLL apurados como percentual da Receita Bruta (Lucro Presumido), independentemente do resultado contábil do exercício.
- **Despesas Financeiras**: concentradas na Docg S.A. (holding), que tem receita própria baixa/nula — por isso, ao ver o "Consolidado" ou a "S.A." isoladamente, essa conta pesa proporcionalmente muito mais do que nas demais empresas. Isso é uma característica real da estrutura de capital do grupo, não um erro de cálculo.
- Todos os valores estão em Reais (R$) e não são auditados — trata-se de material de projeção gerencial.

## Suporte

Este dashboard e o arquivo Excel que o acompanha compartilham a mesma lógica de cálculo. Qualquer alteração de premissas de longo prazo deve ser replicada em ambos os materiais para mantê-los consistentes. (Obs.: o Excel enviado anteriormente ainda usa a base de 2026 antiga, com todas as empresas incluindo a Proline — avise se quiser que ele seja atualizado para a mesma base de 5 empresas usada agora no dashboard.)
