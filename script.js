/* ==========================================================================
   DOCG GROUP — FP&A PLATFORM — CALCULATION ENGINE + RENDERING
   Mirrors exactly the Excel formula logic (Premissas -> Projeção Anual ->
   Projeção Mensal) so the dashboard and the workbook always agree.
   ========================================================================== */

const CHART_COLORS = {
  navy: '#1e2f52',
  navyDark: '#16233f',
  gold: '#c9a15a',
  goldLight: '#e3c78e',
  pos: '#1e8a5f',
  neg: '#c0392b',
  grid: '#e5e8ee',
  ink: '#62697a',
  slate: '#8a92a3',
};
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = CHART_COLORS.ink;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.usePointStyle = true;

let DATA = null;
let STATE = {
  scenario: 'Realista',
  assumptions: null,     // active assumption set in use
  custom: null,           // stored custom (Personalizado) values
};
const charts = {};
const MONTH_LABELS_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const LINE_LABELS = {
  receitaBruta: 'Receita Bruta', deducoes: '(-) Deduções da Receita Bruta', receitaLiquida: '(=) Receita Líquida',
  cmv: '(-) CMV', lucroBruto: '(=) Lucro Bruto', marketing: '(-) Marketing', comercial: '(-) Comercial',
  folha: '(-) Folha (Pessoal)', administrativas: '(-) Administrativas', bancarias: '(-) Financ./Bancárias',
  outras: '(-) Outras Despesas', ebitda: '(=) EBITDA', da: '(-) Depreciação e Amortização', ebit: '(=) EBIT',
  recFin: '(+) Receitas Financeiras', despFin: '(-) Despesas Financeiras', lair: '(=) LAIR',
  irpj: '(-) IRPJ + CSLL', resultado: '(=) Resultado Líquido',
};

/* -------------------------- formatting helpers -------------------------- */
const fmtBRL = (v, opts = {}) => {
  const n = Number(v) || 0;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0, ...opts }).format(n);
};
const fmtBRLCompact = (v) => {
  const n = Number(v) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n/1e6).toLocaleString('pt-BR', {maximumFractionDigits:1,minimumFractionDigits:1}) + 'M';
  if (abs >= 1e3) return (n/1e3).toLocaleString('pt-BR', {maximumFractionDigits:0}) + 'k';
  return n.toLocaleString('pt-BR', {maximumFractionDigits:0});
};
const fmtPct = (v, dec = 1) => `${(Number(v)*100).toLocaleString('pt-BR', {minimumFractionDigits:dec, maximumFractionDigits:dec})}%`;
const fmtNum = (v) => Number(v).toLocaleString('pt-BR', {maximumFractionDigits:0});

/* ------------------------------ calc engine ------------------------------ */
function computeAnnual(base, assumptions, irpjFactor) {
  const out = { 2026: { ...base, capex: -base.da } };
  const years = [2027, 2028, 2029];
  let prev = out[2026];
  for (const year of years) {
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
  const annual = computeAnnual(DATA.base2026.annual, STATE.assumptions, DATA.meta.irpjFactor);
  const monthly = computeMonthly(annual, DATA.seasonalIndex);
  return { annual, monthly };
}

/* ------------------------------ controls UI ------------------------------ */
function buildControls() {
  const grid = document.getElementById('controlsGrid');
  grid.innerHTML = '';
  const keys = Object.keys(DATA.assumptionMeta);
  keys.forEach((key) => {
    const meta = DATA.assumptionMeta[key];
    const wrap = document.createElement('div');
    wrap.className = 'control-item';
    wrap.innerHTML = `
      <label>${meta.label}<span class="cv" id="cv-${key}">${fmtPct(STATE.assumptions[key], 2)}</span></label>
      <input type="range" id="slider-${key}" min="${meta.min}" max="${meta.max}" step="${meta.step}" value="${STATE.assumptions[key]}">
    `;
    grid.appendChild(wrap);
    const slider = wrap.querySelector('input');
    slider.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      STATE.assumptions[key] = v;
      STATE.custom[key] = v;
      document.getElementById(`cv-${key}`).textContent = fmtPct(v, 2);
      if (STATE.scenario !== 'Personalizado') {
        STATE.scenario = 'Personalizado';
        setScenarioButtonActive('Personalizado');
      }
      renderAll();
    });
  });
}

function syncSliders() {
  Object.keys(DATA.assumptionMeta).forEach((key) => {
    const slider = document.getElementById(`slider-${key}`);
    const cv = document.getElementById(`cv-${key}`);
    if (slider) {
      slider.value = STATE.assumptions[key];
      slider.disabled = false;
    }
    if (cv) cv.textContent = fmtPct(STATE.assumptions[key], 2);
  });
}

function setScenarioButtonActive(name) {
  document.querySelectorAll('.scenario-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.scn === name);
  });
}

function applyScenario(name) {
  STATE.scenario = name;
  if (name === 'Personalizado') {
    STATE.assumptions = { ...STATE.custom };
  } else {
    STATE.assumptions = { ...DATA.scenarios[name] };
    STATE.custom = { ...DATA.scenarios[name] };
  }
  setScenarioButtonActive(name);
  syncSliders();
  renderAll();
}

/* ------------------------------ nav / views ------------------------------ */
function initNav() {
  const titles = {
    overview: 'Visão Geral', dre: 'DRE Projetada', mensal: 'Projeção Mensal',
    fluxo: 'Fluxo de Crescimento', cenarios: 'Comparativo de Cenários', premissas: 'Premissas',
  };
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

function initControlsCollapse() {
  const header = document.getElementById('controlsHeader');
  const panel = document.getElementById('controlsPanel');
  header.addEventListener('click', (e) => {
    if (e.target.closest('#resetBtn')) return;
    panel.classList.toggle('collapsed');
  });
  document.getElementById('resetBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    applyScenario('Realista');
  });
}

function initMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  document.getElementById('mobileNavToggle').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

function initScenarioSwitch() {
  document.getElementById('scenarioSwitch').addEventListener('click', (e) => {
    const btn = e.target.closest('.scenario-btn');
    if (!btn) return;
    applyScenario(btn.dataset.scn);
  });
}

function initDreToggle() {
  document.getElementById('dreToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    document.querySelectorAll('#dreToggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDreTable(btn.dataset.mode);
  });
}

/* ------------------------------ chart helper ------------------------------ */
function upsertChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, config);
}

const gridOpt = { color: CHART_COLORS.grid, drawTicks: false };
const baseScales = {
  x: { grid: { display: false }, ticks: { color: CHART_COLORS.slate } },
  y: { grid: gridOpt, ticks: { color: CHART_COLORS.slate, callback: (v) => fmtBRLCompact(v) }, border: { display: false } },
};

/* ------------------------------ KPI rendering ------------------------------ */
function kpiCard({ label, value, sub, subChip, tone }) {
  const toneClass = tone === 'neg' ? 'neg' : tone === 'pos' ? 'pos' : '';
  return `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value ${toneClass}">${value}</div>
      <div class="kpi-sub">${sub}${subChip ? `<span class="chip ${subChip.tone}">${subChip.text}</span>` : ''}</div>
    </div>`;
}

function renderOverview(annual) {
  const c26 = annual[2026], c29 = annual[2029];
  const cagrReceita = Math.pow(c29.receitaBruta / c26.receitaBruta, 1/3) - 1;
  const cagrEbitda = Math.pow(c29.ebitda / c26.ebitda, 1/3) - 1;
  const kpis = [
    kpiCard({ label: 'Receita Bruta 2029E', value: fmtBRL(c29.receitaBruta, {notation:'compact'}), sub: `CAGR 26-29: `, subChip:{text: fmtPct(cagrReceita), tone:'pos'} }),
    kpiCard({ label: 'EBITDA 2029E', value: fmtBRL(c29.ebitda, {notation:'compact'}), sub: `Margem: `, subChip:{text: fmtPct(c29.ebitda/c29.receitaLiquida), tone:'pos'} }),
    kpiCard({ label: 'Resultado Líquido 2029E', value: fmtBRL(c29.resultado, {notation:'compact'}), tone: c29.resultado<0?'neg':'pos', sub: `Δ vs 2026: `, subChip:{text: fmtBRL(c29.resultado-c26.resultado,{notation:'compact'}), tone:'pos'} }),
    kpiCard({ label: 'Margem Bruta 2029E', value: fmtPct(c29.lucroBruto/c29.receitaLiquida), sub: `2026: ${fmtPct(c26.lucroBruto/c26.receitaLiquida)}` }),
    kpiCard({ label: 'CAGR EBITDA 26-29', value: fmtPct(cagrEbitda), sub: `Múltiplo: `, subChip:{text: (c29.ebitda/c26.ebitda).toFixed(2)+'x', tone:'pos'} }),
    kpiCard({ label: 'Despesas Financeiras / Receita', value: fmtPct(-c29.despFin/c29.receitaBruta), sub: `2026: ${fmtPct(-c26.despFin/c26.receitaBruta)}` }),
  ];
  document.getElementById('kpiOverview').innerHTML = kpis.join('');

  // Waterfall hero: Receita Bruta bridge 2026->2029
  const years = [2026,2027,2028,2029];
  const base2026 = annual[2026].receitaBruta;
  const deltas = years.map((y,i)=> i===0 ? base2026 : annual[y].receitaBruta-annual[years[i-1]].receitaBruta);
  let running = 0;
  const floors = [], bars = [];
  years.forEach((y,i) => {
    if (i===0) { floors.push(0); bars.push(base2026); running = base2026; }
    else { floors.push(Math.min(running, running+deltas[i])); bars.push(Math.abs(deltas[i])); running += deltas[i]; }
  });
  upsertChart('chartWaterfallHero', {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [
        { label: 'base', data: floors, backgroundColor: 'transparent', stack: 's' },
        { label: 'Receita Bruta', data: bars, backgroundColor: (ctx)=> ctx.dataIndex===0 ? CHART_COLORS.gold : CHART_COLORS.goldLight, borderRadius: 4, stack: 's', maxBarThickness: 70 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.datasetIndex===1 ? fmtBRL(years[c.dataIndex]===2026? bars[0] : deltas[c.dataIndex]) : '' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#c7cfe0' } },
        y: { grid: { color: 'rgba(255,255,255,0.08)' }, ticks: { color: '#c7cfe0', callback:(v)=>fmtBRLCompact(v) }, border:{display:false} },
      },
    },
  });

  upsertChart('chartReceitaEbitdaAnual', {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [
        { label: 'Receita Bruta', data: years.map(y=>annual[y].receitaBruta), backgroundColor: CHART_COLORS.navy, borderRadius: 5, order: 2, maxBarThickness: 46 },
        { label: 'EBITDA', data: years.map(y=>annual[y].ebitda), backgroundColor: CHART_COLORS.gold, borderRadius: 5, order: 1, maxBarThickness: 46 },
      ],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });

  upsertChart('chartCrescimentoReceita', {
    type: 'line',
    data: {
      labels: years.map(String),
      datasets: [{
        label: 'Crescimento YoY', data: years.map((y,i)=> i===0? null : annual[y].receitaBruta/annual[years[i-1]].receitaBruta - 1),
        borderColor: CHART_COLORS.gold, backgroundColor: 'rgba(201,161,90,0.15)', fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: CHART_COLORS.gold,
      }],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:(c)=>fmtPct(c.raw)}}},
      scales: { x: baseScales.x, y: { grid: gridOpt, ticks: { callback:(v)=>fmtPct(v,0) }, border:{display:false} } } },
  });

  upsertChart('chartMargens', {
    type: 'line',
    data: {
      labels: years.map(String),
      datasets: [
        { label: 'Margem EBITDA', data: years.map(y=>annual[y].ebitda/annual[y].receitaLiquida), borderColor: CHART_COLORS.gold, tension:0.35, pointRadius:3 },
        { label: 'Margem Líquida', data: years.map(y=>annual[y].resultado/annual[y].receitaLiquida), borderColor: CHART_COLORS.neg, tension:0.35, pointRadius:3 },
      ],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}},
      scales: { x: baseScales.x, y: { grid: gridOpt, ticks: { callback:(v)=>fmtPct(v,0) }, border:{display:false} } } },
  });

  upsertChart('chartResultadoLiquido', {
    type: 'bar',
    data: { labels: years.map(String), datasets: [{ label:'Resultado Líquido', data: years.map(y=>annual[y].resultado),
      backgroundColor: years.map(y=>annual[y].resultado<0?CHART_COLORS.neg:CHART_COLORS.pos), borderRadius:5, maxBarThickness:50 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: baseScales },
  });
}

/* ------------------------------ DRE table ------------------------------ */
const DRE_ROWS = [
  {k:'receitaBruta', label:'RECEITA BRUTA', type:'sub'},
  {k:'deducoes', label:'(-) Deduções da Receita Bruta'},
  {k:'receitaLiquida', label:'(=) RECEITA LÍQUIDA', type:'sub'},
  {k:'cmv', label:'(-) Custo dos Produtos Vendidos (CMV)'},
  {k:'lucroBruto', label:'(=) LUCRO BRUTO', type:'sub'},
  {k:'__margemBruta', label:'Margem Bruta %', type:'margin', num:'lucroBruto', den:'receitaLiquida'},
  {k:'marketing', label:'(-) Marketing'},
  {k:'comercial', label:'(-) Comercial'},
  {k:'folha', label:'(-) Despesas com Pessoal (Folha)'},
  {k:'administrativas', label:'(-) Despesas Administrativas'},
  {k:'bancarias', label:'(-) Despesas Financ./Bancárias'},
  {k:'outras', label:'(-) Outras Despesas'},
  {k:'ebitda', label:'(=) EBITDA', type:'sub'},
  {k:'__margemEbitda', label:'Margem EBITDA %', type:'margin', num:'ebitda', den:'receitaLiquida'},
  {k:'da', label:'(-) Depreciação e Amortização'},
  {k:'ebit', label:'(=) EBIT (LAJIR)', type:'sub'},
  {k:'recFin', label:'(+) Receitas Financeiras'},
  {k:'despFin', label:'(-) Despesas Financeiras (Dívida)'},
  {k:'lair', label:'(=) LAIR', type:'sub'},
  {k:'irpj', label:'(-) IRPJ + CSLL'},
  {k:'resultado', label:'(=) RESULTADO LÍQUIDO', type:'sub'},
  {k:'__margemLiquida', label:'Margem Líquida %', type:'margin', num:'resultado', den:'receitaLiquida'},
];

let LAST = null;

function renderDreTable(mode) {
  const thead = document.querySelector('#dreTable thead');
  const tbody = document.querySelector('#dreTable tbody');
  let cols, getVal;
  if (mode === 'anual') {
    cols = [2026,2027,2028,2029];
    thead.innerHTML = `<tr><th>Conta</th>${cols.map(c=>`<th>${c}${c===2026?' (Base)':'E'}</th>`).join('')}</tr>`;
    getVal = (row, c) => LAST.annual[c][row.k];
  } else {
    cols = Array.from({length:12}, (_,i)=>i);
    thead.innerHTML = `<tr><th>Conta</th>${cols.map(i=>`<th>${MONTH_LABELS_PT[i]}/27</th>`).join('')}</tr>`;
    getVal = (row, i) => LAST.monthly[i][row.k];
  }
  tbody.innerHTML = DRE_ROWS.map(row => {
    const cls = row.type === 'sub' ? 'subtotal' : row.type === 'margin' ? 'margin' : '';
    const cells = cols.map(c => {
      if (row.type === 'margin') {
        const numV = mode==='anual' ? LAST.annual[c][row.num] : LAST.monthly[c][row.num];
        const denV = mode==='anual' ? LAST.annual[c][row.den] : LAST.monthly[c][row.den];
        return `<td>${fmtPct(denV ? numV/denV : 0)}</td>`;
      }
      const v = getVal(row, c);
      const tone = v < 0 ? 'neg' : '';
      return `<td class="${tone}">${fmtNum(v)}</td>`;
    }).join('');
    return `<tr class="${cls}"><td>${row.label}</td>${cells}</tr>`;
  }).join('');
}

/* ------------------------------ DRE view charts ------------------------------ */
function renderDreCharts(annual) {
  const years = [2026,2027,2028,2029];
  upsertChart('chartReceitaCustos', {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: [
        { label: 'Receita Líquida', data: years.map(y=>annual[y].receitaLiquida), backgroundColor: CHART_COLORS.navy, borderRadius:5, maxBarThickness:42 },
        { label: 'CMV', data: years.map(y=>-annual[y].cmv), backgroundColor: '#a9b4c6', borderRadius:5, maxBarThickness:42 },
        { label: 'Desp. Operacionais', data: years.map(y=>-(annual[y].marketing+annual[y].comercial+annual[y].folha+annual[y].administrativas+annual[y].bancarias+annual[y].outras)), backgroundColor: CHART_COLORS.gold, borderRadius:5, maxBarThickness:42 },
      ],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });

  const y29 = annual[2029];
  const despItems = [
    ['CMV', -y29.cmv], ['Marketing', -y29.marketing], ['Comercial', -y29.comercial],
    ['Folha', -y29.folha], ['Administrativas', -y29.administrativas], ['Outras', -(y29.bancarias+y29.outras)],
  ];
  upsertChart('chartComposicaoDespesas', {
    type: 'doughnut',
    data: {
      labels: despItems.map(d=>d[0]),
      datasets: [{ data: despItems.map(d=>d[1]), backgroundColor: [CHART_COLORS.navy,'#3d5177','#6b7fa3','#a9b4c6',CHART_COLORS.gold,'#e3c78e'], borderWidth: 2, borderColor:'#fff' }],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right', labels:{boxWidth:10, font:{size:11}}}} , cutout:'62%'},
  });
}

/* ------------------------------ Mensal charts ------------------------------ */
function renderMensal(monthly) {
  const labels = monthly.map(r => `${MONTH_LABELS_PT[r.m]}/${String(r.year).slice(2)}`);
  upsertChart('chartReceitaMensal', {
    type: 'bar',
    data: { labels, datasets: [{ label:'Receita Bruta', data: monthly.map(r=>r.receitaBruta), backgroundColor: CHART_COLORS.navy, borderRadius:3, maxBarThickness: 16 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: baseScales },
  });
  upsertChart('chartEbitdaMensal', {
    type: 'bar',
    data: { labels, datasets: [{ label:'EBITDA', data: monthly.map(r=>r.ebitda), backgroundColor: CHART_COLORS.gold, borderRadius:3, maxBarThickness: 16 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: baseScales },
  });
  upsertChart('chartResultadoMensal', {
    type: 'bar',
    data: { labels, datasets: [{ label:'Resultado Líquido', data: monthly.map(r=>r.resultado),
      backgroundColor: monthly.map(r=>r.resultado<0?CHART_COLORS.neg:CHART_COLORS.pos), borderRadius:3, maxBarThickness: 16 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: baseScales },
  });
}

/* ------------------------------ Fluxo de Crescimento ------------------------------ */
function renderFluxo(annual, monthly) {
  const cagrReceita = Math.pow(annual[2029].receitaBruta/annual[2026].receitaBruta, 1/3)-1;
  const cagrEbitda = Math.pow(annual[2029].ebitda/annual[2026].ebitda, 1/3)-1;
  const receitaAcum = [2027,2028,2029].reduce((s,y)=>s+annual[y].receitaBruta,0);
  const ebitdaAcum = [2027,2028,2029].reduce((s,y)=>s+annual[y].ebitda,0);
  let firstPositive = monthly.find(r=>r.resultado>0);
  let breakEvenLabel = firstPositive ? `${MONTH_LABELS_PT[firstPositive.m]}/${String(firstPositive.year).slice(2)}` : 'Não atingido no horizonte';

  const kpis = [
    kpiCard({ label:'Receita Bruta Acumulada 27-29', value: fmtBRL(receitaAcum,{notation:'compact'}), sub:'Soma 2027-2029' }),
    kpiCard({ label:'EBITDA Acumulado 27-29', value: fmtBRL(ebitdaAcum,{notation:'compact'}), sub:'Soma 2027-2029' }),
    kpiCard({ label:'CAGR Receita 26-29', value: fmtPct(cagrReceita), sub:'Múltiplo: '+(annual[2029].receitaBruta/annual[2026].receitaBruta).toFixed(2)+'x' }),
    kpiCard({ label:'CAGR EBITDA 26-29', value: fmtPct(cagrEbitda), sub:'Múltiplo: '+(annual[2029].ebitda/annual[2026].ebitda).toFixed(2)+'x' }),
    kpiCard({ label:'Break-even (Resultado Líquido)', value: breakEvenLabel, sub:'Primeiro mês com resultado positivo' }),
    kpiCard({ label:'Expansão Margem EBITDA', value: fmtPct(annual[2029].ebitda/annual[2029].receitaLiquida - annual[2026].ebitda/annual[2026].receitaLiquida), sub:'pontos percentuais, 26→29' }),
  ];
  document.getElementById('kpiFluxo').innerHTML = kpis.join('');

  function waterfallChart(id, metric, color, colorLight) {
    const years = [2026,2027,2028,2029];
    const deltas = years.map((y,i)=> i===0? annual[y][metric] : annual[y][metric]-annual[years[i-1]][metric]);
    let running=0; const floors=[], bars=[], bg=[];
    years.forEach((y,i)=>{
      if(i===0){ floors.push(0); bars.push(deltas[0]); running=deltas[0]; bg.push(color); }
      else { floors.push(Math.min(running, running+deltas[i])); bars.push(Math.abs(deltas[i])); running+=deltas[i]; bg.push(deltas[i]>=0?colorLight:CHART_COLORS.neg); }
    });
    upsertChart(id, {
      type:'bar',
      data:{ labels: years.map(String), datasets:[
        {label:'base', data:floors, backgroundColor:'transparent', stack:'s'},
        {label:metric, data:bars, backgroundColor:bg, borderRadius:4, stack:'s', maxBarThickness:60},
      ]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales: baseScales },
    });
  }
  waterfallChart('chartWaterfallReceita', 'receitaBruta', CHART_COLORS.navy, CHART_COLORS.gold);
  waterfallChart('chartWaterfallEbitda', 'ebitda', CHART_COLORS.navy, CHART_COLORS.gold);
}

/* ------------------------------ Cenários view ------------------------------ */
function renderCenarios() {
  const names = ['Conservador','Realista','Agressivo'];
  const results = {};
  names.forEach(n => { results[n] = computeAnnual(DATA.base2026.annual, DATA.scenarios[n], DATA.meta.irpjFactor); });

  document.getElementById('scnCards').innerHTML = names.map(n => {
    const a29 = results[n][2029];
    const active = STATE.scenario === n ? 'is-active' : '';
    return `
      <div class="scn-card ${active}">
        <div class="scn-name">${n}</div>
        <div class="scn-tag">${n===STATE.scenario ? 'Cenário Ativo' : 'Simulação'}</div>
        <div class="scn-metric"><span>Receita Bruta 2029E</span><span class="v">${fmtBRL(a29.receitaBruta,{notation:'compact'})}</span></div>
        <div class="scn-metric"><span>EBITDA 2029E</span><span class="v">${fmtBRL(a29.ebitda,{notation:'compact'})}</span></div>
        <div class="scn-metric"><span>Margem EBITDA</span><span class="v">${fmtPct(a29.ebitda/a29.receitaLiquida)}</span></div>
        <div class="scn-metric"><span>Resultado Líquido 2029E</span><span class="v">${fmtBRL(a29.resultado,{notation:'compact'})}</span></div>
      </div>`;
  }).join('');

  upsertChart('chartScenarios', {
    type: 'bar',
    data: {
      labels: names,
      datasets: [
        { label: 'Receita Bruta 2029E', data: names.map(n=>results[n][2029].receitaBruta), backgroundColor: CHART_COLORS.navy, borderRadius:5, maxBarThickness:60 },
        { label: 'EBITDA 2029E', data: names.map(n=>results[n][2029].ebitda), backgroundColor: CHART_COLORS.gold, borderRadius:5, maxBarThickness:60 },
      ],
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'top', align:'end'}}, scales: baseScales },
  });
}

/* ------------------------------ Premissas view ------------------------------ */
function renderPremissas() {
  const notes = {
    receita: 'Diretriz do fundo: crescimento médio de 20% a.a. no cenário Realista, aplicado à Receita Bruta com fasamento sazonal idêntico a 2026.',
    cmv: 'Custo variável, proporcional à Receita Bruta. Baseline 2026 = 53,9%.',
    marketing: 'Despesa variável de mídia/funil, proporcional à Receita Bruta.',
    comercial: 'Comissões e estrutura comercial, proporcional à Receita Bruta.',
    folha: 'Cresce abaixo da receita — alavancagem operacional (reajuste + contratações seletivas).',
    administrativo: 'Despesa fixa, cresce essencialmente pela inflação com leve ganho de eficiência (SG&A leverage).',
    capex: 'Investimento em capacidade produtiva; alimenta a base de Depreciação e Amortização (vida útil de 10 anos).',
    inflacao: 'Referência macro usada para corrigir Outras Despesas e Receitas Financeiras.',
    despFin: 'Despesa financeira ligada ao endividamento. Trajetória reflete o ritmo de desalavancagem assumido.',
    impostos: 'PIS/COFINS/ICMS/IPI/ISS sobre a Receita Bruta. IRPJ/CSLL (Lucro Presumido) deriva proporcionalmente deste driver.',
  };
  const tbody = document.querySelector('#premTable tbody');
  tbody.innerHTML = Object.keys(DATA.assumptionMeta).map(k => `
    <tr>
      <td><b>${DATA.assumptionMeta[k].label}</b></td>
      <td class="num">${fmtPct(STATE.assumptions[k], 2)}</td>
      <td class="note">${notes[k]}</td>
    </tr>`).join('');
}

/* ------------------------------ master render ------------------------------ */
function renderAll() {
  const { annual, monthly } = recompute();
  LAST = { annual, monthly };
  renderOverview(annual);
  renderDreCharts(annual);
  renderDreTable(document.querySelector('#dreToggle button.active').dataset.mode);
  renderMensal(monthly);
  renderFluxo(annual, monthly);
  renderCenarios();
  renderPremissas();
}

/* ------------------------------ boot ------------------------------ */
async function boot() {
  const res = await fetch('data.json');
  DATA = await res.json();
  STATE.assumptions = { ...DATA.scenarios['Realista'] };
  STATE.custom = { ...DATA.scenarios['Realista'] };
  buildControls();
  initNav();
  initControlsCollapse();
  initMobileNav();
  initScenarioSwitch();
  initDreToggle();
  renderAll();
}
boot();
