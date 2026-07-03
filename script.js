/* ==========================================================================
   DOCG GROUP — FP&A PLATFORM — CALCULATION ENGINE + RENDERING (v3)
   ========================================================================== */

const CHART_COLORS = {
  teal: '#1ca4b4', tealDark: '#0f7c89', tealLight: '#8ad3db',
  pos: '#1e8a5f', neg: '#c0392b', grid: '#e1ebec', ink: '#63797e', slate: '#8a9ca0',
};

let DATA = null;
let STATE = {
  scenario: 'Realista',
  assumptions: null,
  custom: null,
  company: 'Consolidado',
  period: 'todos',
  dreExpanded: {},   // rowId -> bool (default true, set lazily)
};
const charts = {};
const MONTH_LABELS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const ICONS = {
  'trending-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  'package': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
  'shopping-bag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg>',
  'briefcase': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  'tool': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z"/></svg>',
  'percent': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
};

/* -------------------------- formatting helpers -------------------------- */
const fmtBRL = (v, opts = {}) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, ...opts }).format(Number(v) || 0);
const fmtBRLCompact = (v) => {
  const n = Number(v) || 0; const abs = Math.abs(n);
  if (abs >= 1e6) return (n/1e6).toLocaleString('pt-BR', {maximumFractionDigits:1,minimumFractionDigits:1}) + 'M';
  if (abs >= 1e3) return (n/1e3).toLocaleString('pt-BR', {maximumFractionDigits:0}) + 'k';
  return n.toLocaleString('pt-BR', {maximumFractionDigits:0});
};
const fmtPct = (v, dec = 1) => `${(Number(v)*100).toLocaleString('pt-BR', {minimumFractionDigits:dec, maximumFractionDigits:dec})}%`;
const fmtNum = (v) => Number(v).toLocaleString('pt-BR', {maximumFractionDigits:0});

/* ------------------------------ calc engine ------------------------------ */
function computeAnnual(base, assumptions, irpjFactor) {
  const out = { 2026: { ...base, capex: -base.da } };
  let prev = out[2026];
  for (const year of [2027, 2028, 2029]) {
    const o = {};
    o.receitaBruta = prev.receitaBruta * (1 + assumptions.receita);
    o.deducoes = -o.receitaBruta * assumptions.impostos;
    o.receitaLiquida = o.receitaBruta + o.deducoes;
    o.cmv = -o.receitaBruta * assumptions.cmv;
    o.lucroBruto = o.receitaLiquida + o.cmv;
    o.marketing = -o.receitaBruta * assumptions.marketing;
    o.comercial = -o.receitaBruta * assumptions.comercial;
    o.folha = prev.folha * (1 + assumptions.folha);
    o.administrativas = prev.administrativas * (1 + assumptions.administrativo);
    o.bancarias = prev.bancarias * (1 + assumptions.receita);
    o.outras = prev.outras * (1 + assumptions.inflacao);
    o.ebitda = o.lucroBruto + o.marketing + o.comercial + o.folha + o.administrativas + o.bancarias + o.outras;
    o.capex = o.receitaBruta * assumptions.capex;
    o.da = prev.da - o.capex / 10;
    o.ebit = o.ebitda + o.da;
    o.recFin = prev.recFin * (1 + assumptions.inflacao);
    o.despFin = prev.despFin * (1 + assumptions.despFin);
    o.lair = o.ebit + o.recFin + o.despFin;
    o.irpj = -o.receitaBruta * assumptions.impostos * irpjFactor;
    o.resultado = o.lair + o.irpj;
    out[year] = o;
    prev = o;
  }
  return out;
}

function computeMonthly(annual, seasonalIndex) {
  const months = [];
  for (const year of [2027, 2028, 2029]) {
    const y = annual[year];
    for (let m = 0; m < 12; m++) {
      const seas = seasonalIndex[m];
      const row = { year, m };
      row.receitaBruta = y.receitaBruta * seas;
      row.deducoes = y.deducoes * seas;
      row.cmv = y.cmv * seas;
      row.marketing = y.marketing * seas;
      row.comercial = y.comercial * seas;
      row.irpj = y.irpj * seas;
      row.folha = y.folha / 12;
      row.administrativas = y.administrativas / 12;
      row.bancarias = y.bancarias / 12;
      row.outras = y.outras / 12;
      row.da = y.da / 12;
      row.recFin = y.recFin / 12;
      row.despFin = y.despFin / 12;
      row.receitaLiquida = row.receitaBruta + row.deducoes;
      row.lucroBruto = row.receitaLiquida + row.cmv;
      row.ebitda = row.lucroBruto + row.marketing + row.comercial + row.folha + row.administrativas + row.bancarias + row.outras;
      row.ebit = row.ebitda + row.da;
      row.lair = row.ebit + row.recFin + row.despFin;
      row.resultado = row.lair + row.irpj;
      months.push(row);
    }
  }
  return months;
}

function recompute() {
  const base = DATA.base2026.annual[STATE.company];
  const seasonal = DATA.seasonalIndex[STATE.company];
  const annual = computeAnnual(base, STATE.assumptions, DATA.meta.irpjFactor);
  const monthly = computeMonthly(annual, seasonal);
  return { annual, monthly };
}

/* ------------------------------ company select ------------------------------ */
function buildCompanySelect() {
  const sel = document.getElementById('companySelect');
  const entries = Object.entries(DATA.companies).sort((a,b) => a[1].order - b[1].order);
  sel.innerHTML = entries.map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join('');
  sel.value = STATE.company;
  sel.addEventListener('change', () => { STATE.company = sel.value; renderAll(); });
}

/* ------------------------------ drivers drawer ------------------------------ */
function buildControls() {
  const body = document.getElementById('controlsBody');
  const cats = {};
  Object.entries(DATA.assumptionMeta).forEach(([key, meta]) => { (cats[meta.cat] = cats[meta.cat] || []).push(key); });
  const catOrder = Object.keys(DATA.categoryMeta);
  body.innerHTML = catOrder.filter(c => cats[c]).map(catKey => {
    const catMeta = DATA.categoryMeta[catKey];
    const items = cats[catKey].map(key => {
      const meta = DATA.assumptionMeta[key];
      return `
        <div class="control-item">
          <label>${meta.label}<span class="cv" id="cv-${key}">${fmtPct(STATE.assumptions[key], 2)}</span></label>
          <input type="range" id="slider-${key}" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${STATE.assumptions[key]}">
        </div>`;
    }).join('');
    return `
      <div class="controls-cat-group">
        <div class="controls-cat-label">${ICONS[catMeta.icon] || ''}${catMeta.label}</div>
        <div class="controls-grid">${items}</div>
      </div>`;
  }).join('');

  Object.keys(DATA.assumptionMeta).forEach((key) => {
    document.getElementById(`slider-${key}`).addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      STATE.assumptions[key] = v;
      STATE.custom[key] = v;
      document.getElementById(`cv-${key}`).textContent = fmtPct(v, 2);
      if (STATE.scenario !== 'Personalizado') { STATE.scenario = 'Personalizado'; setScenarioButtonActive('Personalizado'); }
      renderAll();
    });
  });
}
function syncSliders() {
  Object.keys(DATA.assumptionMeta).forEach((key) => {
    const slider = document.getElementById(`slider-${key}`);
    const cv = document.getElementById(`cv-${key}`);
    if (slider) { slider.value = STATE.assumptions[key]; slider.disabled = false; }
    if (cv) cv.textContent = fmtPct(STATE.assumptions[key], 2);
  });
}
function setScenarioButtonActive(name) {
  document.querySelectorAll('.scenario-btn').forEach(b => b.classList.toggle('active', b.dataset.scn === name));
}
function applyScenario(name) {
  STATE.scenario = name;
  if (name === 'Personalizado') { STATE.assumptions = { ...STATE.custom }; }
  else { STATE.assumptions = { ...DATA.scenarios[name] }; STATE.custom = { ...DATA.scenarios[name] }; }
  setScenarioButtonActive(name);
  syncSliders();
  renderAll();
}
function initDrawer() {
  const drawer = document.getElementById('controlsPanel');
  const overlay = document.getElementById('drawerOverlay');
  const open = () => { drawer.classList.add('open'); overlay.classList.add('show'); };
  const close = () => { drawer.classList.remove('open'); overlay.classList.remove('show'); };
  document.getElementById('drawerToggleBtn').addEventListener('click', open);
  document.getElementById('drawerCloseBtn').addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.getElementById('resetBtn').addEventListener('click', () => applyScenario('Realista'));
}

/* ------------------------------ nav / views ------------------------------ */
function initNav() {
  const titles = { overview: 'Visão Geral', dre: 'DRE Projetada', premissas: 'Premissas', access: 'Usuários' };
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');
      document.getElementById('pageTitle').textContent = titles[view];
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('overlay').classList.remove('show');
    });
  });
}
function initMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  document.getElementById('mobileNavToggle').addEventListener('click', () => { sidebar.classList.add('open'); overlay.classList.add('show'); });
  overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); });
}
function initScenarioSwitch() {
  document.getElementById('scenarioSwitch').addEventListener('click', (e) => {
    const btn = e.target.closest('.scenario-btn');
    if (!btn) return;
    applyScenario(btn.dataset.scn);
  });
}
function initPeriodSelects() {
  ['periodSelect', 'periodSelectOverview'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      document.querySelectorAll(`#${id} button`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // keep both selectors in sync
      document.querySelectorAll('.period-select').forEach(sel => {
        sel.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.period === btn.dataset.period));
      });
      STATE.period = btn.dataset.period;
      renderDre();
      renderOverview(LAST.annual);
    });
  });
}

/* ------------------------------ chart helper ------------------------------ */
function upsertChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof Chart === 'undefined') return;
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(el.getContext('2d'), config);
}
const gridOpt = { color: CHART_COLORS.grid, drawTicks: false };
const baseScales = {
  x: { grid: { display: false }, ticks: { color: CHART_COLORS.slate } },
  y: { grid: gridOpt, ticks: { color: CHART_COLORS.slate, callback: (v) => fmtBRLCompact(v) }, border: { display: false } },
};

/* ------------------------------ KPI rendering ------------------------------ */
const KPI_TOOLTIPS = {
  receita: 'Receita Bruta projetada, antes de impostos sobre vendas. CAGR = crescimento anual composto entre 2026 e 2029.',
  ebitda: 'Lucro antes de juros, impostos, depreciação e amortização — mede a geração de caixa operacional, sem o efeito da estrutura de capital.',
  resultado: 'Resultado Líquido contábil final, após todas as despesas, resultado financeiro e impostos (IRPJ/CSLL).',
  margemBruta: 'Lucro Bruto dividido pela Receita Líquida — mostra quanto sobra após o custo direto do produto/serviço vendido (CMV).',
  cagrEbitda: 'Taxa de crescimento anual composta do EBITDA. O múltiplo mostra quantas vezes o EBITDA do período inicial o do período final representa.',
  despFinReceita: 'Despesas Financeiras (juros e encargos de dívida) como percentual da Receita Bruta — mede o peso do endividamento sobre a operação.',
};
function kpiCard({ label, value, sub, subChip, tone, tooltip }) {
  const toneClass = tone === 'neg' ? 'neg' : tone === 'pos' ? 'pos' : '';
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}${tooltip ? '<span class="kpi-info">i</span>' : ''}</div>
      <div class="kpi-value ${toneClass}">${value}</div>
      <div class="kpi-sub">${sub}${subChip ? `<span class="chip ${subChip.tone}">${subChip.text}</span>` : ''}</div>
      ${tooltip ? `<div class="tooltip-box">${tooltip}</div>` : ''}
    </div>`;
}

function renderOverview(annual) {
  if (STATE.period === 'todos') {
    renderOverviewAnnualMode(annual);
  } else {
    renderOverviewMonthlyMode(parseInt(STATE.period, 10), annual);
  }
}

function renderOverviewAnnualMode(annual) {
  const c26 = annual[2026], c29 = annual[2029];
  const cagrReceita = Math.pow(c29.receitaBruta / (c26.receitaBruta || 1), 1/3) - 1;
  const cagrEbitda = Math.pow(c29.ebitda / (c26.ebitda || 1), 1/3) - 1;
  const kpis = [
    kpiCard({ label: 'Receita Bruta 2029E', value: fmtBRL(c29.receitaBruta, {notation:'compact'}), sub: `CAGR 26-29: `, subChip:{text: fmtPct(cagrReceita), tone:'pos'}, tooltip: KPI_TOOLTIPS.receita }),
    kpiCard({ label: 'EBITDA 2029E', value: fmtBRL(c29.ebitda, {notation:'compact'}), sub: `Margem: `, subChip:{text: fmtPct(c29.receitaLiquida ? c29.ebitda/c29.receitaLiquida : 0), tone:'pos'}, tooltip: KPI_TOOLTIPS.ebitda }),
    kpiCard({ label: 'Resultado Líquido 2029E', value: fmtBRL(c29.resultado, {notation:'compact'}), tone: c29.resultado<0?'neg':'pos', sub: `Δ vs 2026: `, subChip:{text: fmtBRL(c29.resultado-c26.resultado,{notation:'compact'}), tone:'pos'}, tooltip: KPI_TOOLTIPS.resultado }),
    kpiCard({ label: 'Margem Bruta 2029E', value: fmtPct(c29.receitaLiquida ? c29.lucroBruto/c29.receitaLiquida : 0), sub: `2026: ${fmtPct(c26.receitaLiquida ? c26.lucroBruto/c26.receitaLiquida : 0)}`, tooltip: KPI_TOOLTIPS.margemBruta }),
    kpiCard({ label: 'CAGR EBITDA 26-29', value: fmtPct(cagrEbitda), sub: `Múltiplo: `, subChip:{text: (c29.ebitda/(c26.ebitda||1)).toFixed(2)+'x', tone:'pos'}, tooltip: KPI_TOOLTIPS.cagrEbitda }),
    kpiCard({ label: 'Despesas Financeiras / Receita', value: fmtPct(c29.receitaBruta ? -c29.despFin/c29.receitaBruta : 0), sub: `2026: ${fmtPct(c26.receitaBruta ? -c26.despFin/c26.receitaBruta : 0)}`, tooltip: KPI_TOOLTIPS.despFinReceita }),
  ];
  document.getElementById('kpiOverview').innerHTML = kpis.join('');

  const years = [2026,2027,2028,2029];
  const base2026 = annual[2026].receitaBruta;
  const deltas = years.map((y,i)=> i===0 ? base2026 : annual[y].receitaBruta-annual[years[i-1]].receitaBruta);
  let running = 0; const floors = [], bars = [];
  years.forEach((y,i) => {
    if (i===0) { floors.push(0); bars.push(base2026); running = base2026; }
    else { floors.push(Math.min(running, running+deltas[i])); bars.push(Math.abs(deltas[i])); running += deltas[i]; }
  });
  upsertChart('chartWaterfallHero', {
    type: 'bar',
    data: { labels: years.map(String), datasets: [
      { label: 'base', data: floors, backgroundColor: 'transparent', stack: 's' },
      { label: 'Receita Bruta', data: bars, backgroundColor: (ctx)=> ctx.dataIndex===0 ? '#ffffff' : CHART_COLORS.tealLight, borderRadius: 4, stack: 's', maxBarThickness: 70 },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.datasetIndex===1 ? fmtBRL(years[c.dataIndex]===2026? bars[0] : deltas[c.dataIndex]) : '' } } },
      scales: { x: { grid: { display: false }, ticks: { color: '#d5f1f4' } }, y: { grid: { color: 'rgba(255,255,255,0.18)' }, ticks: { color: '#d5f1f4', callback:(v)=>fmtBRLCompact(v) }, border:{display:false} } } },
  });

  upsertChart('chartReceitaEbitdaAnual', {
    type: 'bar',
    data: { labels: years.map(String), datasets: [
      { label: 'Receita Bruta', data: years.map(y=>annual[y].receitaBruta), backgroundColor: CHART_COLORS.tealDark, borderRadius: 5, order: 2, maxBarThickness: 46 },
      { label: 'EBITDA', data: years.map(y=>annual[y].ebitda), backgroundColor: CHART_COLORS.teal, borderRadius: 5, order: 1, maxBarThickness: 46 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });

  upsertChart('chartCrescimentoReceita', {
    type: 'line',
    data: { labels: years.map(String), datasets: [{
      label: 'Crescimento YoY', data: years.map((y,i)=> i===0? null : annual[y].receitaBruta/(annual[years[i-1]].receitaBruta||1) - 1),
      borderColor: CHART_COLORS.teal, backgroundColor: 'rgba(28,164,180,0.15)', fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: CHART_COLORS.teal,
    }]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:(c)=>fmtPct(c.raw)}}},
      scales: { x: baseScales.x, y: { grid: gridOpt, ticks: { callback:(v)=>fmtPct(v,0) }, border:{display:false} } } },
  });

  upsertChart('chartMargens', {
    type: 'line',
    data: { labels: years.map(String), datasets: [
      { label: 'Margem EBITDA', data: years.map(y=>annual[y].receitaLiquida ? annual[y].ebitda/annual[y].receitaLiquida : 0), borderColor: CHART_COLORS.teal, tension:0.35, pointRadius:3 },
      { label: 'Margem Líquida', data: years.map(y=>annual[y].receitaLiquida ? annual[y].resultado/annual[y].receitaLiquida : 0), borderColor: CHART_COLORS.neg, tension:0.35, pointRadius:3 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}},
      scales: { x: baseScales.x, y: { grid: gridOpt, ticks: { callback:(v)=>fmtPct(v,0) }, border:{display:false} } } },
  });

  upsertChart('chartEbitdaDespFin', {
    type: 'bar',
    data: { labels: years.map(String), datasets: [
      { label: 'EBITDA', data: years.map(y=>annual[y].ebitda), backgroundColor: CHART_COLORS.teal, borderRadius: 5, maxBarThickness: 40 },
      { label: 'Despesas Financeiras', data: years.map(y=>-annual[y].despFin), backgroundColor: CHART_COLORS.neg, borderRadius: 5, maxBarThickness: 40 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });
}

function renderOverviewMonthlyMode(year, annual) {
  const rows = year === 2026 ? monthlyRowsFromBase() : LAST.monthly.filter(r => r.year === year);
  const cur = annual[year];
  const prevAnnual = annual[year - 1] || annual[2026];
  const kpis = [
    kpiCard({ label: `Receita Bruta ${year}`, value: fmtBRL(cur.receitaBruta, {notation:'compact'}), sub: `vs ano anterior: `, subChip:{text: fmtPct(cur.receitaBruta/(prevAnnual.receitaBruta||1)-1), tone:'pos'}, tooltip: KPI_TOOLTIPS.receita }),
    kpiCard({ label: `EBITDA ${year}`, value: fmtBRL(cur.ebitda, {notation:'compact'}), sub: `Margem: `, subChip:{text: fmtPct(cur.receitaLiquida ? cur.ebitda/cur.receitaLiquida : 0), tone:'pos'}, tooltip: KPI_TOOLTIPS.ebitda }),
    kpiCard({ label: `Resultado Líquido ${year}`, value: fmtBRL(cur.resultado, {notation:'compact'}), tone: cur.resultado<0?'neg':'pos', sub: `Margem Líquida: ${fmtPct(cur.receitaLiquida ? cur.resultado/cur.receitaLiquida : 0)}`, tooltip: KPI_TOOLTIPS.resultado }),
    kpiCard({ label: 'Margem Bruta', value: fmtPct(cur.receitaLiquida ? cur.lucroBruto/cur.receitaLiquida : 0), sub: `Lucro Bruto: ${fmtBRL(cur.lucroBruto,{notation:'compact'})}`, tooltip: KPI_TOOLTIPS.margemBruta }),
    kpiCard({ label: 'Melhor mês (Receita)', value: MONTH_LABELS_PT[rows.reduce((bi,r,i,arr)=> r.receitaBruta>arr[bi].receitaBruta?i:bi,0)], sub: 'Pico sazonal do ano' }),
    kpiCard({ label: 'Despesas Financeiras / Receita', value: fmtPct(cur.receitaBruta ? -cur.despFin/cur.receitaBruta : 0), tooltip: KPI_TOOLTIPS.despFinReceita }),
  ];
  document.getElementById('kpiOverview').innerHTML = kpis.join('');

  const labels = rows.map((r,i) => MONTH_LABELS_PT[i]);
  upsertChart('chartWaterfallHero', {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Receita Bruta', data: rows.map(r=>r.receitaBruta), backgroundColor: CHART_COLORS.tealLight, borderRadius:4, maxBarThickness:34 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales: { x: { grid:{display:false}, ticks:{color:'#d5f1f4'} }, y: { grid:{color:'rgba(255,255,255,0.18)'}, ticks:{color:'#d5f1f4', callback:(v)=>fmtBRLCompact(v)}, border:{display:false} } } },
  });
  upsertChart('chartReceitaEbitdaAnual', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Receita Bruta', data: rows.map(r=>r.receitaBruta), backgroundColor: CHART_COLORS.tealDark, borderRadius:4, maxBarThickness:22 },
      { label: 'EBITDA', data: rows.map(r=>r.ebitda), backgroundColor: CHART_COLORS.teal, borderRadius:4, maxBarThickness:22 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });
  upsertChart('chartCrescimentoReceita', {
    type: 'line',
    data: { labels, datasets: [{ label:'Receita Mensal', data: rows.map(r=>r.receitaBruta), borderColor: CHART_COLORS.teal, backgroundColor:'rgba(28,164,180,0.15)', fill:true, tension:0.35, pointRadius:3 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: baseScales },
  });
  upsertChart('chartMargens', {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Margem EBITDA', data: rows.map(r=>r.receitaLiquida ? r.ebitda/r.receitaLiquida : 0), borderColor: CHART_COLORS.teal, tension:0.35, pointRadius:3 },
      { label: 'Margem Líquida', data: rows.map(r=>r.receitaLiquida ? r.resultado/r.receitaLiquida : 0), borderColor: CHART_COLORS.neg, tension:0.35, pointRadius:3 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}},
      scales: { x: baseScales.x, y: { grid: gridOpt, ticks: { callback:(v)=>fmtPct(v,0) }, border:{display:false} } } },
  });
  upsertChart('chartEbitdaDespFin', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'EBITDA', data: rows.map(r=>r.ebitda), backgroundColor: CHART_COLORS.teal, borderRadius:4, maxBarThickness:22 },
      { label: 'Despesas Financeiras', data: rows.map(r=>-r.despFin), backgroundColor: CHART_COLORS.neg, borderRadius:4, maxBarThickness:22 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });
}

function monthlyRowsFromBase() {
  const base = DATA.base2026.monthly[STATE.company];
  const keys = Object.keys(base);
  return Array.from({length:12}, (_,i) => {
    const row = {};
    keys.forEach(k => { row[k] = base[k][i]; });
    return row;
  });
}

/* ------------------------------ DRE table (nested collapsible) ------------------------------ */
const DRE_GROUPS = [
  { id:'receita', k:'receitaBruta', label:'RECEITA BRUTA', type:'sub', ratioKey:'receitaBruta', details: [] },
  { id:'liquida', k:'receitaLiquida', label:'(=) RECEITA LÍQUIDA', type:'sub', details: [
      {id:'deducoes', k:'deducoes', label:'(-) Deduções da Receita Bruta (impostos sobre vendas)', ratioKey:'deducoes'},
  ]},
  { id:'bruto', k:'lucroBruto', label:'(=) LUCRO BRUTO', type:'sub', details: [
      {id:'cmv', k:'cmv', label:'(-) Custo dos Produtos/Serviços (CMV)', ratioKey:'cmv'},
  ], margin: {label:'Margem Bruta %', num:'lucroBruto', den:'receitaLiquida'} },
  { id:'ebitda', k:'ebitda', label:'(=) EBITDA', type:'sub', details: [
      {id:'marketing', k:'marketing', label:'(-) Marketing'},
      {id:'comercial', k:'comercial', label:'(-) Comercial'},
      {id:'folha', k:'folha', label:'(-) Despesas com Pessoal (Folha)'},
      {id:'administrativas', k:'administrativas', label:'(-) Despesas Administrativas', ratioKey:'administrativas'},
      {id:'bancarias', k:'bancarias', label:'(-) Despesas Financ./Bancárias'},
      {id:'outras', k:'outras', label:'(-) Outras Despesas'},
  ], margin: {label:'Margem EBITDA %', num:'ebitda', den:'receitaLiquida'} },
  { id:'ebit', k:'ebit', label:'(=) EBIT (LAJIR)', type:'sub', details: [
      {id:'da', k:'da', label:'(-) Depreciação e Amortização'},
  ]},
  { id:'lair', k:'lair', label:'(=) LAIR', type:'sub', details: [
      {id:'recFin', k:'recFin', label:'(+) Receitas Financeiras'},
      {id:'despFin', k:'despFin', label:'(-) Despesas Financeiras (Dívida)'},
  ], margin: {label:'Margem LAIR %', num:'lair', den:'receitaLiquida'} },
  { id:'liquido', k:'resultado', label:'(=) RESULTADO LÍQUIDO', type:'sub', details: [
      {id:'irpj', k:'irpj', label:'(-) IRPJ + CSLL'},
  ], margin: {label:'Margem Líquida %', num:'resultado', den:'receitaLiquida'} },
];

let LAST = null;

function isExpanded(id) {
  return STATE.dreExpanded[id] !== false; // default true (everything open)
}

function ratioChildrenFor(ratioKey) {
  if (!ratioKey) return null;
  const list = (DATA.detailBreakdown[STATE.company] || {})[ratioKey];
  return (list && list.length) ? list : null;
}

function renderDre() {
  const thead = document.querySelector('#dreTable thead');
  const tbody = document.querySelector('#dreTable tbody');
  const title = document.getElementById('dreTableTitle');
  let cols, getVal;

  if (STATE.period === 'todos') {
    cols = [2026,2027,2028,2029];
    thead.innerHTML = `<tr><th>Conta</th>${cols.map(c=>`<th>${c}${c===2026?' (Base)':''}</th>`).join('')}</tr>`;
    getVal = (key, c) => LAST.annual[c][key];
    title.textContent = `DRE Anual · 2026-2029 · ${DATA.companies[STATE.company].label}`;
  } else {
    const year = parseInt(STATE.period, 10);
    cols = Array.from({length:12}, (_,i)=>i);
    if (year === 2026) {
      const base = DATA.base2026.monthly[STATE.company];
      getVal = (key, i) => base[key] ? base[key][i] : 0;
    } else {
      const monthsForYear = LAST.monthly.filter(r => r.year === year);
      getVal = (key, i) => monthsForYear[i][key];
    }
    thead.innerHTML = `<tr><th>Conta</th>${cols.map(i=>`<th>${MONTH_LABELS_PT[i]}/${String(year).slice(2)}</th>`).join('')}</tr>`;
    title.textContent = `DRE Mensal · ${year} · ${DATA.companies[STATE.company].label}`;
  }

  function renderRow(node, cssClass, depthClass) {
    const ratioChildren = ratioChildrenFor(node.ratioKey);
    const hasKidsModel = node.details && node.details.length > 0;
    const hasRatio = !!ratioChildren;
    const hasChildren = hasKidsModel || hasRatio;
    const expanded = isExpanded(node.id);
    const btn = hasChildren ? `<button class="expand-btn" data-rowid="${node.id}">${expanded ? '−' : '+'}</button>` : `<span class="expand-spacer"></span>`;
    const cells = cols.map(c => { const v = getVal(node.k, c); return `<td class="${v<0?'neg':''}">${fmtNum(v)}</td>`; }).join('');
    let html = `<tr class="${cssClass}"><td>${btn}${node.label}</td>${cells}</tr>`;

    if (expanded && hasKidsModel) {
      node.details.forEach(d => { html += renderRow(d, depthClass === 'subdetail' ? 'subdetail' : 'detail', 'detail'); });
    }
    if (expanded && hasRatio) {
      ratioChildren.forEach(item => {
        const subCells = cols.map(c => { const parentV = getVal(node.k, c); const v = parentV * item.ratio; return `<td class="${v<0?'neg':''}">${fmtNum(v)}</td>`; }).join('');
        html += `<tr class="subdetail"><td>${item.label}</td>${subCells}</tr>`;
      });
    }
    return html;
  }

  let rowsHtml = '';
  DRE_GROUPS.forEach(group => {
    rowsHtml += renderRow(group, 'subtotal', 'detail');
    if (group.margin) {
      const cells = cols.map(c => {
        const num = getVal(group.margin.num, c); const den = getVal(group.margin.den, c);
        return `<td>${fmtPct(den ? num/den : 0)}</td>`;
      }).join('');
      rowsHtml += `<tr class="margin"><td>${group.margin.label}</td>${cells}</tr>`;
    }
  });
  tbody.innerHTML = rowsHtml;

  tbody.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.rowid;
      STATE.dreExpanded[id] = !isExpanded(id);
      renderDre();
    });
  });
}

/* ------------------------------ DRE view charts ------------------------------ */
function renderDreCharts(annual) {
  const years = [2026,2027,2028,2029];
  upsertChart('chartReceitaCustos', {
    type: 'bar',
    data: { labels: years.map(String), datasets: [
      { label: 'Receita Líquida', data: years.map(y=>annual[y].receitaLiquida), backgroundColor: CHART_COLORS.tealDark, borderRadius:5, maxBarThickness:42 },
      { label: 'CMV', data: years.map(y=>-annual[y].cmv), backgroundColor: '#a9c4c8', borderRadius:5, maxBarThickness:42 },
      { label: 'Desp. Operacionais', data: years.map(y=>-(annual[y].marketing+annual[y].comercial+annual[y].folha+annual[y].administrativas+annual[y].bancarias+annual[y].outras)), backgroundColor: CHART_COLORS.teal, borderRadius:5, maxBarThickness:42 },
    ]},
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });

  const y29 = annual[2029];
  document.getElementById('composicaoDescYear').textContent = `2029, % do total · ${DATA.companies[STATE.company].label}`;
  const despItems = [
    ['CMV', -y29.cmv], ['Marketing', -y29.marketing], ['Comercial', -y29.comercial],
    ['Folha', -y29.folha], ['Administrativas', -y29.administrativas], ['Outras', -(y29.bancarias+y29.outras)],
  ].filter(d => d[1] > 0);
  upsertChart('chartComposicaoDespesas', {
    type: 'doughnut',
    data: { labels: despItems.map(d=>d[0]), datasets: [{ data: despItems.map(d=>d[1]), backgroundColor: [CHART_COLORS.tealDark,'#2f6f7a','#4dbdca','#8ad3db',CHART_COLORS.teal,'#c3e7ea'], borderWidth: 2, borderColor:'#fff' }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:11}}}} , cutout:'62%'},
  });
}

/* ------------------------------ Premissas view (category grouped) ------------------------------ */
const ASSUMPTION_NOTES = {
  receita: 'Diretriz do fundo: crescimento médio de 20% a.a. no cenário Realista, aplicado à Receita Bruta com fasamento sazonal idêntico a 2026.',
  cmv: 'Custo variável, proporcional à Receita Bruta.',
  marketing: 'Despesa variável de mídia/funil, proporcional à Receita Bruta.',
  comercial: 'Comissões e estrutura comercial, proporcional à Receita Bruta.',
  folha: 'Cresce abaixo da receita — alavancagem operacional (reajuste + contratações seletivas).',
  administrativo: 'Despesa fixa, cresce essencialmente pela inflação com leve ganho de eficiência (SG&A leverage).',
  capex: 'Investimento em capacidade produtiva; alimenta a base de Depreciação e Amortização (vida útil de 10 anos).',
  inflacao: 'Referência macro usada para corrigir Outras Despesas e Receitas Financeiras.',
  despFin: 'Despesa financeira ligada ao endividamento do grupo (concentrada na holding S.A.). Trajetória reflete o ritmo de desalavancagem assumido.',
  impostos: 'PIS/COFINS/ICMS/IPI/ISS sobre a Receita Bruta. IRPJ/CSLL (Lucro Presumido) deriva proporcionalmente deste driver.',
};
function renderPremissas() {
  const cats = {};
  Object.entries(DATA.assumptionMeta).forEach(([key, meta]) => { (cats[meta.cat] = cats[meta.cat] || []).push(key); });
  const catOrder = Object.keys(DATA.categoryMeta);
  const wrap = document.getElementById('premCategoriesWrap');
  wrap.innerHTML = catOrder.filter(c => cats[c]).map(catKey => {
    const catMeta = DATA.categoryMeta[catKey];
    const rows = cats[catKey].map(key => `
      <tr>
        <td class="label">${DATA.assumptionMeta[key].label}</td>
        <td class="num">${fmtPct(STATE.assumptions[key], 2)}</td>
        <td class="note">${ASSUMPTION_NOTES[key] || ''}</td>
      </tr>`).join('');
    return `
      <div class="prem-cat-card">
        <div class="prem-cat-head">${ICONS[catMeta.icon] || ''}<h4>${catMeta.label}</h4></div>
        <table class="prem"><tbody>${rows}</tbody></table>
      </div>`;
  }).join('');
}

/* ------------------------------ master render ------------------------------ */
function renderAll() {
  const { annual, monthly } = recompute();
  LAST = { annual, monthly };
  renderOverview(annual);
  renderDreCharts(annual);
  renderDre();
  renderPremissas();
}

/* ------------------------------ boot ------------------------------ */
async function boot() {
  const res = await fetch('data.json');
  DATA = await res.json();
  STATE.assumptions = { ...DATA.scenarios['Realista'] };
  STATE.custom = { ...DATA.scenarios['Realista'] };

  await window.chartJsReady;
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 11.5;
    Chart.defaults.color = CHART_COLORS.ink;
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
  }

  try {
    buildCompanySelect();
    buildControls();
    initNav();
    initDrawer();
    initMobileNav();
    initScenarioSwitch();
    initPeriodSelects();
    renderAll();
  } catch (err) {
    console.error('Falha ao renderizar o dashboard:', err);
  }
}
window.startDashboard = boot;
