# Docg Group — Dashboard de Projeção Financeira 2027-2029

Dashboard interativo (FP&A) construído para apresentação ao **Fundo DXA (Private Equity)**, com a projeção financeira do Docg Group para o período 2027-2029, partindo do Orçamento 2026 aprovado.

100% estático (HTML + CSS + JavaScript). Não requer backend, servidor ou build step — funciona diretamente no navegador e pode ser publicado gratuitamente no **GitHub Pages**.

## Arquivos

```
/index.html   → estrutura da aplicação (sidebar, cards, tabelas, gráficos)
/style.css    → sistema visual (paleta navy/gold, tipografia, layout responsivo)
/script.js    → motor de cálculo financeiro + renderização dos gráficos (Chart.js)
/data.json    → base 2026 (orçamento aprovado) + premissas dos 3 cenários
/README.md    → este arquivo
```

O motor de cálculo em `script.js` replica **exatamente** as mesmas fórmulas do arquivo Excel entregue junto (`Projeção Anual` e `Projeção Mensal`), garantindo que os dois materiais sempre batam entre si.

## Como publicar gratuitamente no GitHub Pages

### Opção 1 — via interface do GitHub (mais simples)

1. Crie uma conta gratuita em [github.com](https://github.com) (se ainda não tiver).
2. Clique em **New repository** (repositório novo). Dê um nome, por exemplo `docg-projecao-2029`. Deixe como **Public**.
3. Dentro do repositório recém-criado, clique em **Add file → Upload files**.
4. Arraste os 5 arquivos desta pasta (`index.html`, `style.css`, `script.js`, `data.json`, `README.md`) para a área de upload.
5. Clique em **Commit changes** para salvar.
6. Vá em **Settings → Pages** (menu lateral esquerdo).
7. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
8. Em **Branch**, selecione `main` e a pasta `/ (root)`. Clique em **Save**.
9. Aguarde 1-2 minutos. O GitHub mostrará o link público, algo como:
   `https://SEU-USUARIO.github.io/docg-projecao-2029/`
10. Pronto — esse link já pode ser compartilhado com o fundo DXA ou com a diretoria.

### Opção 2 — via linha de comando (Git)

```bash
# dentro da pasta com os arquivos do dashboard
git init
git add index.html style.css script.js data.json README.md
git commit -m "Dashboard FP&A - Projecao 2027-2029"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/docg-projecao-2029.git
git push -u origin main
```

Depois, ative o GitHub Pages em **Settings → Pages** como descrito na Opção 1 (passos 6-9).

### Atualizar o dashboard depois de publicado

Basta editar/substituir os arquivos (principalmente `data.json`, se o orçamento base mudar) e enviar novamente:

```bash
git add .
git commit -m "Atualiza premissas"
git push
```

O GitHub Pages atualiza o site publicado automaticamente em 1-2 minutos.

## Como usar o dashboard

- **Painel de Premissas** (topo da página): ajuste qualquer um dos 10 drivers (crescimento de receita, CMV, marketing, folha, administrativo, comercial, capex, inflação, despesas financeiras, impostos). A DRE, os KPIs e os gráficos recalculam instantaneamente, sem recarregar a página.
- **Botões de cenário** (Conservador / Realista / Agressivo): aplicam automaticamente um conjunto de premissas pré-calibrado. Mover qualquer controle manualmente muda o cenário ativo para **Personalizado**.
- **Restaurar cenário Realista**: volta às premissas-base recomendadas (crescimento de receita de 20% a.a.).
- **Navegação lateral**: alterna entre Visão Geral, DRE Projetada, Projeção Mensal, Fluxo de Crescimento, Comparativo de Cenários e Premissas.

## Notas metodológicas

- **Base 2026**: orçamento aprovado, consolidado (Docg + Franquias + Distribuidora + Coralina + Tech + S.A + Proline).
- **Fasamento mensal**: contas proporcionais à receita (Receita Bruta, Deduções, CMV, Marketing, Comercial, IRPJ/CSLL) seguem o índice sazonal observado em 2026; contas fixas/periódicas (Folha, Administrativas, D&A, Receitas/Despesas Financeiras) são distribuídas em 12 parcelas iguais.
- **Regime tributário**: IRPJ/CSLL apurados como percentual da Receita Bruta (Lucro Presumido), independentemente do resultado contábil do exercício — por isso o Resultado Líquido pode permanecer pressionado mesmo com LAIR positivo.
- Todos os valores estão em Reais (R$) e não são auditados — trata-se de material de projeção gerencial para fins de discussão com o fundo DXA.

## Suporte

Este dashboard e o arquivo Excel que o acompanha (`Docg_Projecao_Financeira_2027-2029_DXA.xlsx`) compartilham a mesma lógica de cálculo. Qualquer alteração de premissas de longo prazo deve ser replicada em ambos os materiais para mantê-los consistentes.
