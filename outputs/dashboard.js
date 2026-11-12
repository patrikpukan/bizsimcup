/* ERPsim Sales Dashboard – self-updating.
 *
 * LIVE mode (recommended): open any page of the SAP server in Chrome while logged in, e.g.
 *   competition: https://erpsim-b1.hec.ca:8001/   (client 418; a "404 / Service cannot be reached" page is fine)
 *   training:    https://r75p.ucc.cloud/sap/public/ping   (client 792)
 * then open the DevTools console (F12) and paste this whole file.
 * Data is fetched directly from /odata/<client> every 20/30/60 s using your SAP session.
 * Other server/client: localStorage.setItem('erpsim_client', '<client>') in the console, then paste again.
 *
 * LOCAL mode: open dashboard.html; it re-reads data.js every 20/30/60 s
 * (keep `python3 refresh_data.py --loop 20` running to update data.js).
 */
(function () {
  'use strict';
  const CLIENTS = { 'erpsim-b1.hec.ca': '418', 'r75p.ucc.cloud': '792' };   // SAP host → client
  let CLIENT_OVERRIDE = null; try { CLIENT_OVERRIDE = localStorage.getItem('erpsim_client'); } catch (e) {}
  const CLIENT = CLIENT_OVERRIDE || CLIENTS[location.hostname] || '';
  const ODATA = '/odata/' + CLIENT;
  const LIVE = /^https?:$/.test(location.protocol) && !!CLIENT;
  const SETS = ['Company_Valuation', 'Sales', 'Market', 'Current_Pricing_Conditions', 'Current_Inventory_KPI',
    'Current_Inventory', 'Current_Suppliers_Prices', 'Production_Orders', 'Purchase_Orders', 'Production', 'Marketing_Expenses', 'Inventory', 'BOM_Changes', 'Current_Game_Rules'];
  // SAP reports ACCOUNTS_PAYABLE as a negative number, so payables are always used as Math.abs(...)
  // Game constants (Manufacturing Introduction; Extended: 24 000/day, set CAPACITY accordingly)
  const CFG = {
    CAPACITY: 24000, SETUP_H: 8, RAW_LIMIT: 250000, PACK_LIMIT: 750000, FG_LIMIT: 250000, FIXED_PER_UNIT: 0.9, FIXED_MIN: 0.6, LEAD_DAYS: 5, ROUND_DAYS: 20,
    MARKET_PER_DC: { '10': 90000, '12': 360000, '14': 120000 },        // approx. € per team per week (overwritten by Current_Game_Rules)
    TEAMS: 10,                                                         // BIZ SIM CUP 2026 live game: 10 teams (A–J, from the round results). 0 = estimate from market revenue
    MIX_PERIODS: 3,                                                    // product mix for the demand model = latest N market periods (5 days each), not the whole game
    STORES: {                                                          // stores per region (competition round)
      '10': { North: 2, South: 7, West: 3 },
      '12': { North: 19, South: 23, West: 17 },
      '14': { North: 45, South: 38, West: 40 },
    },
    STORAGE: { FG: 250000, RAW: 250000, PACK: 750000 },                // free storage before extra cost
  };
  // Recipes (kg per unit; default 35 % wheat, 35 % oats, 30 % flavour) + packaging
  const ALL_FG = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16'];  // fixed row order in MD61 / VK32
  const FLAVOUR = { '01': 'R01', '02': 'R02', '03': 'R03', '04': 'R04' };
  // Recipe shares in % of the pack weight, as set in ZCS02 (header field "Recipe", 3 groups separated by ";"):
  //   single flavour F01–F04 / F11–F14: wheat R05 / oats R06 / flavour
  //   Original F05 / F15:               wheat R05 / oats R06
  //   Mixed F06 / F16:                  wheat R05 / oats R06 / R01 / R02 / R03 / R04
  const RECIPE_SAP_DEFAULT = '35/35/30; 50/50; 30/30/10/10/10/10';   // game start, before any ZCS02 change
  const RECIPE_DEFAULT = '20/60/20; 20/80; 20/50/1/1/1/27';         // our planned ZCS02 recipe (wheat min. 20 %)
  let RECIPE_PCT = [0.20, 0.60, 0.20], RECIPE_ORIG = [0.20, 0.80], RECIPE_MIX = [0.20, 0.50, 0.01, 0.01, 0.01, 0.27];
  const recipeText = () => [RECIPE_PCT, RECIPE_ORIG, RECIPE_MIX].map(g => g.map(x => +(x * 100).toFixed(1)).join('/')).join('; ');
  function parseRecipe(txt) {
    const fb = RECIPE_DEFAULT.split(';').map(g => g.split('/').map(x => Number(x) / 100));
    const gs = String(txt || '').split(';').map(g => g.trim().split(/[\/ ,]+/).map(Number));
    const ok = (g, len) => g && g.length === len && g.every(x => isFinite(x) && x >= 0) && Math.abs(g.reduce((t, x) => t + x, 0) - 100) < 0.5;
    return [3, 2, 6].map((len, i) => ok(gs[i], len) ? gs[i].map(x => x / 100) : fb[i]);
  }
  function recipe(c) {
    const big = c[1] === '1', kg = big ? 1 : 0.5, r = {};
    const fam = c.slice(-1);
    if (fam === '5') { r.R05 = RECIPE_ORIG[0] * kg; r.R06 = RECIPE_ORIG[1] * kg; }
    else if (fam === '6') { r.R05 = RECIPE_MIX[0] * kg; r.R06 = RECIPE_MIX[1] * kg; ['R01', 'R02', 'R03', 'R04'].forEach((x, i) => { if (RECIPE_MIX[2 + i]) r[x] = RECIPE_MIX[2 + i] * kg; }); }
    else { const [w, o, f] = RECIPE_PCT; r.R05 = w * kg; r.R06 = o * kg; r[FLAVOUR['0' + fam]] = f * kg; }
    if (big) { r.P01 = 1; r.P02 = 1; } else { r.P03 = 1; r.P04 = 1; }
    return r;
  }
  const CHART_JS = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';

  if (window.__erpsimTimer) clearTimeout(window.__erpsimTimer);

  // ---------- page shell ----------
  const CSS = `
:root{--bg:#f6f7f9;--card:#fff;--ink:#1b1f24;--muted:#5f6b7a;--line:#e3e7ec;--good:#1f8a4c;--warn:#b7791f;--bad:#c53030;--accent:#2563eb;--good-bg:#e6f4ec;--warn-bg:#fdf3e1;--bad-bg:#fde8e8}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#111418;--card:#1a1f25;--ink:#e8ecf1;--muted:#9aa6b4;--line:#2a313a;--good:#4ade80;--warn:#fbbf24;--bad:#f87171;--accent:#60a5fa;--good-bg:#14301f;--warn-bg:#33270f;--bad-bg:#3a1717}}
:root[data-theme="dark"]{--bg:#111418;--card:#1a1f25;--ink:#e8ecf1;--muted:#9aa6b4;--line:#2a313a;--good:#4ade80;--warn:#fbbf24;--bad:#f87171;--accent:#60a5fa;--good-bg:#14301f;--warn-bg:#33270f;--bad-bg:#3a1717}
*{box-sizing:border-box}
table{font-size:inherit;color:inherit}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:20px 16px 40px}
header{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;justify-content:space-between;margin-bottom:16px}
h1{font-size:22px;margin:0}h2{font-size:15px;margin:0 0 10px}
.sub{color:var(--muted);font-size:13px}
.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.controls button,.controls select,.controls input{background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:5px 10px;cursor:pointer;font:inherit}
.status{display:inline-flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--muted)}
.dot.ok{background:var(--good)}.dot.err{background:var(--bad)}.dot.busy{background:var(--warn)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.kpi .l{color:var(--muted);font-size:12px}
.kpi .v{font-size:20px;font-weight:650;margin-top:2px;font-variant-numeric:tabular-nums}
.kpi .d{font-size:12px;color:var(--muted);margin-top:2px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;min-width:0}
.full{grid-column:1/-1}
.chart{position:relative;height:280px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
th:first-child,td:first-child{text-align:left}
th{color:var(--muted);font-weight:600;font-size:12px}
.tbl{overflow-x:auto}
.tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600}
.tag.good{background:var(--good-bg);color:var(--good)}.tag.warn{background:var(--warn-bg);color:var(--warn)}.tag.bad{background:var(--bad-bg);color:var(--bad)}
.neg{color:var(--bad)}.pos{color:var(--good)}
.heat td{text-align:center}
.note{color:var(--muted);font-size:12px;margin-top:8px}
.empty{padding:40px;text-align:center;color:var(--muted)}
.banner{background:var(--bad-bg);color:var(--bad);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:13px}
code{background:var(--bg);padding:1px 5px;border-radius:4px}
h3{font-size:13px;margin:4px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.reco{margin-bottom:14px;border-color:var(--accent)}
.grid>div{min-width:0}
.reco .grid>div:first-child{grid-column:1/-1}
.alerts{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:6px}
.alerts li{padding:7px 10px;border-radius:8px;font-size:13px;border-left:4px solid var(--muted);background:var(--bg)}
.alerts li.bad{border-color:var(--bad);background:var(--bad-bg)}.alerts li.warn{border-color:var(--warn);background:var(--warn-bg)}.alerts li.good{border-color:var(--good);background:var(--good-bg)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.chip{background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:12px}
.gantt{position:relative;min-width:260px;width:35%;height:26px}
.gbar{position:absolute;top:7px;height:12px;border-radius:3px;background:var(--warn)}
.gbar.run{background:var(--good)}.gbar.done{background:var(--muted);opacity:.45}
.calc input{width:92px;padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:inherit;font:inherit;text-align:right}
.calc .inputs{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:10px;font-size:13px}
.calc .inputs label{display:flex;align-items:center;gap:6px}
.best td{font-weight:600}
.gnow{position:absolute;top:0;bottom:0;width:2px;background:var(--bad)}
@media (max-width:800px){.grid{grid-template-columns:1fr}.chart{height:240px}}`;

  function ensureShell() {
    if (document.getElementById('erpsim-app') && document.getElementById('erpsim-dc') && document.getElementById('erpsim-var') && document.getElementById('erpsim-calc') && document.getElementById('erpsim-recipe') && document.getElementById('erpsim-rounds') && document.getElementById('erpsim-start')) return;
    // remove the host page's own styles (the SAP 404 page sets body{overflow:hidden;height:100%;text-align:center}, which blocks scrolling)
    document.querySelectorAll('style, link[rel=stylesheet]').forEach(s => s.remove());
    for (const el of [document.documentElement, document.body]) { el.removeAttribute('style'); el.removeAttribute('class'); }
    // the SAP page has no doctype (quirks mode): body must stay overflow:visible, otherwise it becomes its own non-scrolling box
    document.body.style.cssText = 'overflow:visible;height:auto;width:auto;text-align:left';
    document.documentElement.style.cssText = 'overflow:auto;height:auto';
    document.title = 'ERPsim Sales Dashboard';
    if (!document.querySelector('meta[name=viewport]')) {
      const m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width, initial-scale=1'; document.head.appendChild(m);
    }
    const st = document.createElement('style'); st.dataset.erpsim = '1'; st.textContent = CSS; document.head.appendChild(st);
    document.body.innerHTML = `<div class="wrap"><header><div><h1>ERPsim Sales Dashboard</h1><div class="sub" id="erpsim-meta">Loading…</div></div>
      <div class="controls"><span class="status"><span class="dot" id="erpsim-dot"></span><span id="erpsim-status">–</span></span>
      <label>Game <select id="erpsim-var"><option value="intro">Introduction</option><option value="extended">Extended</option></select></label>
      <label>Capacity <input id="erpsim-cap" type="number" min="1000" step="1000" style="width:84px">/day</label>
      <label>Setup <input id="erpsim-setup" type="number" min="0" max="12" step="0.1" style="width:60px"> h</label>
      <label title="Recipe in % of pack weight as set in ZCS02, 3 groups separated by ';': single flavour R05/R06/flavour; Original F05/F15 R05/R06; Mixed F06/F16 R05/R06/R01/R02/R03/R04. Game start (before ZCS02) = 35/35/30; 50/50; 30/30/10/10/10/10">Recipe <input id="erpsim-recipe" type="text" style="width:230px"></label>
      <label title="Number of rounds in this game (end-game mode uses it)">Rounds <input id="erpsim-rounds" type="number" min="1" max="12" step="1" style="width:48px"></label>
      <label title="Day-1 starter plan (no market data yet): products produced 2 days each, comma-separated">Start <input id="erpsim-start" type="text" style="width:150px"></label>
      <label>Channel <select id="erpsim-dc"></select></label>
      <label>Auto-refresh <select id="erpsim-int"><option value="20">20 s</option><option value="30">30 s</option><option value="60">60 s</option><option value="0">off</option></select></label>
      <button id="erpsim-now">Refresh now</button><button id="erpsim-theme">Light/dark</button></div></header>
      <div id="erpsim-banner"></div><div id="erpsim-app"><div class="card empty">Loading data…</div></div><div id="erpsim-calc"></div></div>`;
  }

  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ---------- game settings (visible in the header; saved per browser) ----------
  const VARIANT_CAP = { intro: 16000, extended: 24000 };
  let SETTINGS = { variant: 'extended', capacity: 24000, setupH: 8, recipes: RECIPE_DEFAULT, rounds: '', start: 'F14,F13,F12,F03,F02' };
  try { SETTINGS = Object.assign(SETTINGS, JSON.parse(store.get('erpsim_cfg') || '{}')); } catch (e) {}
  function applySettings() {
    CFG.CAPACITY = Math.max(1000, Number(SETTINGS.capacity) || VARIANT_CAP[SETTINGS.variant] || 16000);
    CFG.SETUP_H = Math.max(0, Math.min(12, Number(SETTINGS.setupH)));
    if (!isFinite(CFG.SETUP_H)) CFG.SETUP_H = 8;
    [RECIPE_PCT, RECIPE_ORIG, RECIPE_MIX] = parseRecipe(SETTINGS.recipes);
    CFG.ROUNDS = Number(SETTINGS.rounds) > 0 ? Number(SETTINGS.rounds) : (SETTINGS.variant === 'extended' ? 5 : 3);   // BIZ SIM CUP 2026 live game: 5 rounds
  }
  applySettings();

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }

  // ---------- data ----------
  async function fetchLive() {
    const d = { _fetched: new Date().toLocaleString('en-GB') };
    await Promise.all(SETS.map(async s => {
      let url = `${ODATA}/${s}?$format=json`; const out = [];
      while (url) {   // follow OData paging (__next) so no rows are silently dropped
        const r = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(`${s}: HTTP ${r.status}`);
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) throw new Error('SAP session expired – log in again in this browser');
        const j = await r.json();
        out.push(...j.d.results.map(x => { delete x.__metadata; return x; }));
        url = j.d.__next || null;
        if (url && !/\$format=json/.test(url)) url += (url.includes('?') ? '&' : '?') + '$format=json';
      }
      d[s] = out;
    }));
    d._company = (d.Company_Valuation[0] || {}).COMPANY_CODE || '';
    return d;
  }

  async function fetchLocal() {
    // re-read data.js with a cache-buster (works from file:// too)
    document.querySelectorAll('script[src^="data.js"]').forEach(s => s.remove());
    let stale = false;
    await loadScript('data.js?t=' + Date.now()).catch(() => { if (!window.ERPSIM_DATA) throw new Error('data.js not found – run refresh_data.py'); stale = true; });
    if (!window.ERPSIM_DATA) throw new Error('data.js has no data');
    window.ERPSIM_DATA._stale = stale;
    return window.ERPSIM_DATA;
  }

  // ---------- render ----------
  let charts = [];
  // ---------- upgrade calculator (persistent: lives outside #erpsim-app so the 20 s refresh never resets what you type) ----------
  let calcCtx = {};
  // SAP setup-time curve (Job Aid Extended: 8 h/€0, 7/50k, 6/125k, 5/250k, 4/500k, 3/1.25M; verified against Current_Game_Rules: €475k → 4.06897 h)
  const setupAt = inv => 2 + 1500000 / (250000 + Math.max(0, Number(inv) || 0));
  const CALC_FIELDS = [
    ['margin', 'Margin €/unit', 0.01, 'auto'], ['sell', 'Extra output sold %', 1, 100], ['days', 'Days left in game', 1, 'auto'],
    ['sw', 'Product changes / round', 0.5, 'auto'], ['rate', 'Discount rate %', 0.1, 'auto'],
    ['sCost', 'Setup: cost €', 1000, 125000], ['sTo', 'Setup: new hours', 0.5, 'auto'],
    ['cCost', 'Capacity: cost €', 10000, 1000000], ['cAdd', 'Capacity: +units/day', 500, 1000], ['cDep', 'Capacity: depreciation €/round', 1000, 8000],
  ];
  let calcState = {}; try { calcState = JSON.parse(store.get('erpsim_calc') || '{}'); } catch (e) {}
  function calcVal(k) {
    const f = CALC_FIELDS.find(x => x[0] === k), raw = calcState[k];
    if (raw !== undefined && raw !== '' && isFinite(Number(raw))) return Number(raw);
    return f[3] === 'auto' ? calcCtx[k] : f[3];
  }
  function updateCalc() {
    const box = document.getElementById('erpsim-calc'); if (!box) return;
    // default "new hours" = SAP curve at (already invested + this cost), so diminishing returns are included
    calcCtx.sTo = +Math.min(calcCtx.setupH ?? 8, setupAt((calcCtx.setupInv || 0) + (Number(calcVal('sCost')) || 0))).toFixed(2);
    if (!box.dataset.built) {
      box.dataset.built = '1';
      box.innerHTML = `<div class="card calc" style="margin-top:14px"><h2>Upgrade calculator: setup time reduction vs. capacity</h2>
        <div class="inputs">${CALC_FIELDS.map(([k, l, st]) => `<label>${l} <input data-k="${k}" type="number" step="${st}"></label>`).join('')}
        <button id="erpsim-calc-reset">Reset to live values</button></div><div id="erpsim-calc-out"></div>
        <div class="note">Empty fields use live values (grey). The ranking is by company valuation, so the verdict uses the <b>final valuation effect</b>: valuation = cumulative profit ÷ game days × 240 (12 rounds) ÷ discount rate, and extra profit only counts for the days left. A setup-time investment is booked once as a cost (not ×12), so it lowers valuation by cost ÷ rate. “Net cash” shows whether the money itself comes back before the end. Capacity is an asset, so only its depreciation lowers profit. Both gains are real only if the market buys the extra units (set “Extra output sold %” lower if you already have unsold stock), and only for the days that are left. If the money comes from the credit line, you also pay interest and debt loading drops by the cost.</div></div>`;
      box.addEventListener('input', e => { const k = e.target.dataset.k; if (!k) return; calcState[k] = e.target.value; store.set('erpsim_calc', JSON.stringify(calcState)); updateCalc(); });
      box.querySelector('#erpsim-calc-reset').onclick = () => { calcState = {}; store.set('erpsim_calc', '{}'); box.querySelectorAll('input').forEach(i => i.value = ''); updateCalc(); };
    }
    for (const [k, , , def] of CALC_FIELDS) { const i = box.querySelector(`input[data-k="${k}"]`); const v = def === 'auto' ? calcCtx[k] : def; i.placeholder = v == null ? '' : String(+Number(v).toFixed(2)); }
    const N = v => isFinite(v) ? v : 0;
    const e0 = v => (v < 0 ? '−' : '') + '€' + Math.round(Math.abs(v)).toLocaleString('en-US');
    const eM = v => Math.abs(v) >= 1e6 ? (v < 0 ? '−' : '') + '€' + (Math.abs(v) / 1e6).toFixed(2) + 'M' : e0(v);
    const margin = N(calcVal('margin')), sell = N(calcVal('sell')) / 100, days = Math.max(0, N(calcVal('days'))), sw = N(calcVal('sw'));
    const rate = Math.max(0.01, N(calcVal('rate')) / 100), cap = calcCtx.cap || 16000, R = calcCtx.roundDays || 20, from = calcCtx.setupH ?? 8;
    const sTo = Math.max(0, N(calcVal('sTo')));
    const opts = [];
    { const cost = N(calcVal('sCost')), units = sw * Math.max(0, from - sTo) * cap / 24 * sell, pr = units * margin;
      opts.push({ name: `Setup ${+from.toFixed(2)} h → ${+sTo.toFixed(2)} h`, cost, units, pr, once: cost, note: `${sw.toFixed(1)} changes × ${Math.max(0, from - sTo).toFixed(2)} h × ${Math.round(cap / 24).toLocaleString('en-US')} units/h` }); }
    { const cost = N(calcVal('cCost')), add = N(calcVal('cAdd')), units = add * R * sell, pr = units * margin - N(calcVal('cDep'));
      opts.push({ name: `Capacity +${add.toLocaleString('en-US')}/day`, cost, units, pr, once: 0, note: `${add.toLocaleString('en-US')} × ${R} days, minus depreciation` }); }
    // final valuation = cumulative profit ÷ total game days × 240 (12 rounds) ÷ rate; extra profit only accrues on the days left
    const annual = 12 * R / Math.max(R, (calcCtx.elapsed || 0) + days);
    for (const o of opts) { o.perDay = o.pr / R; o.payback = o.perDay > 0 ? o.cost / o.perDay : Infinity; o.back = o.perDay * days; o.net = o.back - o.cost;
      o.dV = (o.back * annual - o.once) / rate; o.vRatio = o.cost ? o.dV / o.cost : 0; }
    const best = opts.filter(o => o.dV > 0).sort((a, b) => b.vRatio - a.vRatio)[0];
    const verdict = o => o === best ? ['Best ratio – do it', 'good'] : o.dV > 0 ? ['Raises valuation', 'warn'] : ['Lowers valuation', 'bad'];
    document.getElementById('erpsim-calc-out').innerHTML = `<div class="tbl"><table><thead><tr><th>Option</th><th>Cost</th><th>Final valuation effect</th><th>Valuation per €1</th><th>Verdict</th><th>Extra units / round</th><th>Extra profit / round</th><th>Payback</th><th>Cash back until end</th><th>Net cash until end</th></tr></thead><tbody>` +
      opts.map(o => { const [t, c] = verdict(o); return `<tr class="${o === best ? 'best' : ''}"><td>${o.name}<div class="sub">${o.note}</div></td><td>${e0(o.cost)}</td>
        <td class="${o.dV < 0 ? 'neg' : 'pos'}">${eM(o.dV)}</td><td><b>${o.vRatio.toFixed(2)}×</b></td><td><span class="tag ${c}">${t}</span></td>
        <td>${Math.round(o.units).toLocaleString('en-US')}</td><td>${e0(o.pr)}</td><td>${isFinite(o.payback) ? o.payback.toFixed(1) + ' days' : 'never'}</td><td>${e0(o.back)}</td><td class="${o.net < 0 ? 'neg' : 'pos'}">${e0(o.net)}</td></tr>`; }).join('') +
      `</tbody></table></div>${calcCtx.setupInv ? `<div class="note">Already invested in setup time reduction: <b>${e0(calcCtx.setupInv)}</b> → ${setupAt(calcCtx.setupInv).toFixed(2)} h by the SAP curve (setup = 2 + 1,500,000 ÷ (250,000 + invested), never under 2 h). “Setup: new hours” defaults to the curve at invested + cost; “Setup” in the header follows SAP.</div>` : ''}`;
  }
  let dcChoice = null;  // in-memory channel choice (works even when localStorage is blocked)
  // Current_Game_Rules (OData) → market sizes, storage limits, overheads; capacity / setup only when SAP changes them
  // (so a value typed in the header stays until SAP reports a different one, e.g. after an investment)
  let RULES_INFO = '';
  function applyRules(R) {
    if (!R.length) { RULES_INFO = ''; return; }
    const num = v => { const x = Number(String(v).replace(/[^\d.]/g, '')); return isFinite(x) ? x : null; };
    const get = (el, det) => { const r = R.find(x => x.ELEMENT === el && (det == null || x.DETAIL === det)); return r ? r.VALUE : null; };
    for (const dc of ['10', '12', '14']) { const v = num(get('Approximate_Market_Size', 'DC' + dc)); if (v) CFG.MARKET_PER_DC[dc] = v; }
    const lim = { RAW_LIMIT: 'Perishable', PACK_LIMIT: 'Packing', FG_LIMIT: 'Finished products' };
    for (const k in lim) { const v = num(get('Storage_Capacity', lim[k])); if (v) CFG[k] = v; }
    const oh = R.filter(x => x.ELEMENT === 'Overhead_Cost' && x.DETAIL !== 'Payment Frequency').reduce((t, x) => t + (num(x.VALUE) || 0), 0);
    const every = num(get('Overhead_Cost', 'Payment Frequency')) || 5;
    const cap = num(get('Production', 'Daily Production Capacity')), setup = num(get('Production', 'Setup Time'));
    let seen = {}; try { seen = JSON.parse(store.get('erpsim_rules_seen') || '{}'); } catch (e) {}
    let changed = false;
    if (cap && seen.cap !== cap) { SETTINGS.capacity = cap; seen.cap = cap; changed = true; }
    // setup time: SAP reports the exact current value, so it always wins over a value typed in the header
    const setupR = setup != null ? Math.round(setup * 100) / 100 : null;
    if (setupR != null && Number(SETTINGS.setupH) !== setupR) { SETTINGS.setupH = setupR; seen.setup = setupR; changed = true; }
    const scen = (R[0] || {}).SCENARIO; if (scen && seen.scen !== scen) { SETTINGS.variant = /extended/i.test(scen) ? 'extended' : 'intro'; seen.scen = scen; changed = true; }
    if (changed) { store.set('erpsim_rules_seen', JSON.stringify(seen)); store.set('erpsim_cfg', JSON.stringify(SETTINGS)); applySettings(); syncInputs(); }
    if (oh) CFG.FIXED_MIN = oh / every / CFG.CAPACITY;
    RULES_INFO = `SAP rules: ${scen || '?'} · capacity ${cap || '?'} · setup ${setup ?? '?'} h · overheads €${Math.round(oh / every)}/day · storage ${CFG.RAW_LIMIT / 1000}k kg raw / ${CFG.PACK_LIMIT / 1000}k packing / ${CFG.FG_LIMIT / 1000}k finished`;
  }
  function syncInputs() {
    const set = (id, v) => { const el = document.getElementById(id); if (el && document.activeElement !== el) el.value = v; };
    set('erpsim-var', SETTINGS.variant); set('erpsim-cap', CFG.CAPACITY); set('erpsim-setup', CFG.SETUP_H);
  }

  function render(D) {
    const app = document.getElementById('erpsim-app');
    const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };
    const css = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    const eur = (v, d = 0) => '€' + n(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
    const eurK = v => Math.abs(v) >= 1e6 ? '€' + (v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M' : '€' + Math.round(v / 1e3).toLocaleString('en-US') + 'k';
    const int = v => Math.round(n(v)).toLocaleString('en-US');
    const pct = v => (v * 100).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' %';
    const code = mat => String(mat || '').replace(/^.*-/, '');
    const AREA_ALIAS = { NO: 'North', SO: 'South', WE: 'West', N: 'North', S: 'South', W: 'West' };
    for (const k of ['Sales', 'Market', 'Marketing_Expenses']) if (Array.isArray(D[k])) for (const r of D[k]) if (r.AREA && AREA_ALIAS[String(r.AREA).toUpperCase()]) r.AREA = AREA_ALIAS[String(r.AREA).toUpperCase()];
    const rows = k => Array.isArray(D[k]) ? D[k] : [];
    applyRules(rows('Current_Game_Rules'));

    const desc2code = {}, code2name = {};
    const short = s => String(s).replace(' Muesli', '').replace(' Fruit', '');
    for (const r of [...rows('Current_Inventory'), ...rows('Current_Pricing_Conditions'), ...rows('Current_Inventory_KPI'), ...rows('Sales'), ...rows('Purchase_Orders'), ...rows('Production_Orders')]) {
      if (r.MATERIAL_NUMBER && r.MATERIAL_DESCRIPTION) { const c = code(r.MATERIAL_NUMBER); desc2code[r.MATERIAL_DESCRIPTION] = c; code2name[c] = short(r.MATERIAL_DESCRIPTION); }
    }
    const mcode = r => r.MATERIAL_NUMBER ? code(r.MATERIAL_NUMBER) : (desc2code[r.MATERIAL_DESCRIPTION] || short(r.MATERIAL_DESCRIPTION));
    const name = c => code2name[c] ? `${c} · ${code2name[c]}` : c;  // ID first – IDs are what SAP transactions use

    // ---- distribution channel filter (Extended: DC10 / DC12 / DC14 each have own prices & market) ----
    const dcOf = r => String(n(r.DISTRIBUTION_CHANNEL) || 12);
    const allSales = rows('Sales'), allMarket = rows('Market'), allPrices = rows('Current_Pricing_Conditions');
    const dcs = [...new Set([...allPrices, ...allSales, ...allMarket].map(dcOf))].sort();
    let DC = dcChoice || store.get('erpsim_dc'); if (!dcs.includes(DC)) DC = dcs.includes('12') ? '12' : (dcs[0] || '12');
    const dcSel = document.getElementById('erpsim-dc');
    const dcName = d => ({ '10': 'DC10 Hypermarkets', '12': 'DC12 Grocery chains', '14': 'DC14 Independent grocers' }[d] || 'DC' + d);
    if (dcSel.dataset.opts !== dcs.join()) { dcSel.innerHTML = dcs.map(d => `<option value="${d}">${dcName(d)}</option>`).join(''); dcSel.dataset.opts = dcs.join(); }
    dcSel.value = DC; dcSel.parentElement.style.display = dcs.length > 1 ? '' : 'none';
    // pack sizes per channel (Extended): DC10 hypermarkets buy only 1 kg, DC14 independent grocers only 500 g
    const sizeOk = (dc, c) => dc === '10' ? /^F1/.test(c) : dc === '14' ? /^F0/.test(c) : true;
    const sales = allSales.filter(r => dcOf(r) === DC);
    let market = allMarket.filter(r => dcOf(r) === DC), marketFallback = false;
    if (!market.length && allMarket.length) { market = allMarket.filter(r => sizeOk(DC, mcode(r))); marketFallback = true; }
    const val = rows('Company_Valuation').slice().sort((a, b) => n(a.SIM_ELAPSED_STEPS) - n(b.SIM_ELAPSED_STEPS));
    const prices = allPrices.filter(r => dcOf(r) === DC), inv = rows('Current_Inventory_KPI');
    // unit cost from current supplier prices × recipe (falls back to historic COST/QUANTITY)
    const rawPrice = {}; for (const r of rows('Current_Suppliers_Prices')) { const m = code(r.MATERIAL_NUMBER), pr = n(r.PRICE); if (pr > 0 && !(rawPrice[m] <= pr)) rawPrice[m] = pr; }  // cheapest vendor
    const stdCost = c => { if (!/^F/.test(c)) return null; const rc = recipe(c); let s = 0; for (const m in rc) { if (rawPrice[m] == null) return null; s += rc[m] * rawPrice[m]; } return s; };
    // stock by material (finished goods + raw + packaging)
    const stock = {}; for (const r of rows('Current_Inventory')) stock[code(r.MATERIAL_NUMBER)] = (stock[code(r.MATERIAL_NUMBER)] || 0) + n(r.STOCK);
    for (const r of inv) { const c = code(r.MATERIAL_NUMBER); if (stock[c] == null) stock[c] = n(r.CURRENT_INVENTORY); }
    const sumOf = re => Object.keys(stock).filter(c => re.test(c)).reduce((a, c) => a + stock[c], 0);
    const storage = [['Finished goods', sumOf(/^F/), CFG.STORAGE.FG, 'boxes'], ['Raw materials', sumOf(/^R/), CFG.STORAGE.RAW, 'kg'], ['Packaging', sumOf(/^P/), CFG.STORAGE.PACK, 'units']];
    // stores per region: DC12 from the Job Aid; other channels fall back to DC12's regional proportions (only the ratio matters for 'pref')
    const storesOf = a => (CFG.STORES[DC] || CFG.STORES['12'] || {})[a];
    const last = val[val.length - 1] || {};
    const curRound = last.SIM_ROUND || (sales[sales.length - 1] || {}).SIM_ROUND || '01';
    // which activities exist in this phase (Introduction: R1 sales only, R2 + production, R3 + planning & purchasing)
    const roundNo = n(curRound);
    const PHASE = SETTINGS.variant === 'extended' ? { production: true, purchasing: true, label: 'Extended' }
      : { production: roundNo >= 2 || rows('Production_Orders').length > 0, purchasing: roundNo >= 3 || rows('Purchase_Orders').length > 0, label: `Introduction, round ${roundNo}` };

    const perRound = market.some(r => r.SIM_ROUND !== '01' && n(r.SIM_PERIOD) <= 4) || !market.some(r => r.SIM_ROUND !== '01');
    const mKey = r => `${r.SIM_ROUND}-${n(r.SIM_PERIOD)}`;
    const sKey = r => { const w = Math.ceil(n(r.SIM_STEP) / 5); return perRound ? `${r.SIM_ROUND}-${w}` : `${r.SIM_ROUND}-${(n(r.SIM_ROUND) - 1) * 4 + w}`; };
    const keyLabel = k => { const [r, p] = k.split('-').map(Number); return `R${r} W${perRound ? p : p - (r - 1) * 4}`; };  // week within round
    const sortKeys = ks => [...new Set(ks)].sort((a, b) => { const [ra, pa] = a.split('-').map(Number), [rb, pb] = b.split('-').map(Number); return ra - rb || pa - pb; });

    // KPIs are company-wide (all channels)
    const totRev = allSales.reduce((a, r) => a + n(r.NET_VALUE), 0);
    const totCost = allSales.reduce((a, r) => a + n(r.COST), 0);
    const totQty = allSales.reduce((a, r) => a + n(r.QUANTITY), 0);
    const mktQty = allMarket.reduce((a, r) => a + n(r.QUANTITY), 0);

    const prod = {};
    const P = c => prod[c] = prod[c] || { q: 0, v: 0, c: 0, mq: 0, mv: 0, lastMq: 0, lastMv: 0, price: null, inv: null };
    for (const r of sales) { const p = P(mcode(r)); p.q += n(r.QUANTITY); p.v += n(r.NET_VALUE); p.c += n(r.COST); }
    const mKeys = sortKeys(market.map(mKey));
    const recentKeys = mKeys.slice(-2);
    for (const r of market) {
      const p = P(mcode(r)); const v = n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE);
      p.mq += n(r.QUANTITY); p.mv += v;
      if (recentKeys.includes(mKey(r))) { p.lastMq += n(r.QUANTITY); p.lastMv += v; }
    }
    for (const r of prices) P(code(r.MATERIAL_NUMBER)).price = n(r.PRICE);
    for (const r of inv) P(code(r.MATERIAL_NUMBER)).inv = n(r.CURRENT_INVENTORY);
    const codes = Object.keys(prod).filter(c => prod[c].q || prod[c].mq).sort();

    const elapsed = n(last.SIM_ELAPSED_STEPS);
    // one unit-cost rule for every table: recent SAP standard cost from Sales (all channels, reflects ZCS02 recipe changes)
    // → else cheapest supplier price × header recipe → else historic COST/QUANTITY. Variable cost only; fixed costs are not in margins.
    const costRecent = {}, costAll = {};
    for (const r of allSales) { const c = mcode(r), q = n(r.QUANTITY); if (q <= 0) continue; const a = costAll[c] = costAll[c] || { q: 0, c: 0 }; a.q += q; a.c += n(r.COST); if (n(r.SIM_ELAPSED_STEPS) > elapsed - 5) { const b = costRecent[c] = costRecent[c] || { q: 0, c: 0 }; b.q += q; b.c += n(r.COST); } }
    const unitCost = c => costRecent[c] ? costRecent[c].c / costRecent[c].q : (stdCost(c) ?? (costAll[c] ? costAll[c].c / costAll[c].q : null));
    // products the selected channel actually buys (DC10: 1 kg only, DC14: 500 g only)
    const codesDC = codes.filter(c => sizeOk(DC, c));
    document.getElementById('erpsim-meta').textContent = `Company ${D._company || last.COMPANY_CODE || (rows('Current_Game_Rules')[0] || {}).COMPANY_CODE || '?'}${CLIENT ? ' (client ' + CLIENT + ')' : ''} · round ${n(curRound)} · day ${n(last.SIM_STEP)} (${elapsed} days total) · ${LIVE ? 'LIVE from SAP' : 'data.js'} · data: ${D._fetched || '?'}`;
    const debt = n(last.BANK_LOAN) + Math.abs(n(last.ACCOUNTS_PAYABLE));
    const kpis = [
      ['Company valuation', eurK(n(last.COMPANY_VALUATION)), `discount rate ${n(last.MARKET_RISK_RATE_PCT) + n(last.COMPANY_RISK_RATE_PCT)} %`],
      ['Cumulative profit', eurK(n(last.PROFIT)), elapsed ? `${eurK(n(last.PROFIT) / elapsed * 20)} / round (20 days)` : ''],
      ['Credit rating', last.CREDIT_RATING || '–', `debt loading ${eurK(n(last.DEBT_LOADING))}`],
      ['Cash', eurK(n(last.BANK_CASH_ACCOUNT)), `receivables ${eurK(n(last.ACCOUNTS_RECEIVABLE))}`],
      ['Loan + payables', eurK(debt), `loan ${eurK(n(last.BANK_LOAN))}`],
      ['Revenue', eurK(totRev), `${int(totQty)} units`],
      ['Gross margin', totRev ? pct((totRev - totCost) / totRev) : '–', eurK(totRev - totCost)],
      ['Market share (units)', mktQty ? pct(totQty / mktQty) : '–', `market ${int(mktQty)} units`],
      ['Finished-goods storage', pct(storage[0][1] / storage[0][2]), `${int(storage[0][1])} / ${int(storage[0][2])} boxes`],
    ];
    // ---- fixed & other costs, live: revenue − COGS − marketing − setup investment − profit (salaries, depreciation, DC fees, storage, interest…) ----
    const mktSpend = rows('Marketing_Expenses').reduce((a, r) => a + n(r.AMOUNT), 0);
    const fixedTot = elapsed && val.length ? totRev - totCost - mktSpend - Math.abs(n(last.SETUP_TIME_INVESTMENT)) - n(last.PROFIT) : 0;
    const fixedDay = elapsed ? Math.max(0, fixedTot / elapsed) : 0;
    CFG.FIXED_PER_UNIT = Math.max(CFG.FIXED_MIN, fixedDay / CFG.CAPACITY);
    // ---- context for the upgrade calculator (live defaults) ----
    {
      const rs = allSales.filter(r => n(r.SIM_ELAPSED_STEPS) > elapsed - 5); const q = rs.reduce((a, r) => a + n(r.QUANTITY), 0);
      const totalRounds = CFG.ROUNDS;
      calcCtx = Object.assign(calcCtx, {
        margin: q ? +((rs.reduce((a, r) => a + n(r.NET_VALUE) - n(r.COST), 0)) / q).toFixed(2) : (totQty ? +((totRev - totCost) / totQty).toFixed(2) : 1.5),
        days: Math.max(0, totalRounds * CFG.ROUND_DAYS - elapsed), rate: n(last.MARKET_RISK_RATE_PCT) + n(last.COMPANY_RISK_RATE_PCT) || 10,
        elapsed, cap: CFG.CAPACITY, setupH: CFG.SETUP_H, roundDays: CFG.ROUND_DAYS, setupInv: Math.abs(n(last.SETUP_TIME_INVESTMENT)),
      });
      if (calcCtx.sw == null) calcCtx.sw = 3;
    }

    // ================= LOAN & CREDIT RATING MONITOR =================
    function financeSection() {
      if (!val.length) return `<div class="card full"><h2>Loan &amp; credit rating monitor</h2><div class="sub">Waiting for the first game day: loan, cash, receivables, payables, debt loading and credit rating appear once SAP reports Company_Valuation.</div></div>`;
      const at = k => val[Math.max(0, val.length - 1 - k)];
      const dl = r => n(r.DEBT_LOADING) || (n(r.BANK_CASH_ACCOUNT) + n(r.ACCOUNTS_RECEIVABLE) - n(r.BANK_LOAN) - Math.abs(n(r.ACCOUNTS_PAYABLE)));
      const ref5 = at(5), dd = Math.max(1, n(last.SIM_ELAPSED_STEPS) - n(ref5.SIM_ELAPSED_STEPS));
      const loanTrend = (n(last.BANK_LOAN) - n(ref5.BANK_LOAN)) / dd, dlTrend = (dl(last) - dl(ref5)) / dd, cashTrend = (n(last.BANK_CASH_ACCOUNT) - n(ref5.BANK_CASH_ACCOUNT)) / dd;
      const rate = (n(last.MARKET_RISK_RATE_PCT) + n(last.COMPANY_RISK_RATE_PCT)) / 100;
      const V = n(last.COMPANY_VALUATION), tierCost = rate ? V * (1 - rate / (rate + 0.005)) : 0;
      // rating history: which debt-loading range we have seen for each rating
      const tiers = {}; for (const r of val) { const k = r.CREDIT_RATING || '–'; const t = tiers[k] = tiers[k] || { lo: Infinity, hi: -Infinity, risk: n(r.COMPANY_RISK_RATE_PCT), days: 0 }; t.lo = Math.min(t.lo, dl(r)); t.hi = Math.max(t.hi, dl(r)); t.days++; }
      const changes = []; for (let i = 1; i < val.length; i++) if (val[i].CREDIT_RATING !== val[i - 1].CREDIT_RATING) changes.push(`day ${n(val[i].SIM_ELAPSED_STEPS)}: ${val[i - 1].CREDIT_RATING} → <b>${val[i].CREDIT_RATING}</b>`);
      // supplier payment calendar: each received PO is paid 20 days after goods receipt
      const PAY_DAYS = 20, dueBy = {}; let due5 = 0, due10 = 0;
      for (const r of rows('Purchase_Orders')) { if (!n(r.GOODS_RECEIPT_STEP)) continue; const d = gday(r.GOODS_RECEIPT_ROUND, r.GOODS_RECEIPT_STEP) + PAY_DAYS; if (d <= elapsed) continue;
        const v = n(r.QUANTITY) * n(r.UNIT_PRICE); dueBy[d] = (dueBy[d] || 0) + v; if (d <= elapsed + 5) due5 += v; if (d <= elapsed + 10) due10 += v; }
      const fixedBuf = fixedDay * 5, safeRepay = Math.max(0, n(last.BANK_CASH_ACCOUNT) - due5 - fixedBuf);
      const dueRows = Object.keys(dueBy).map(Number).sort((a, b) => a - b).slice(0, 10).map(d => `<tr><td>${fd(d)}${d <= elapsed + 5 ? ' <span class="tag warn">≤ 5 d</span>' : ''}</td><td>${eur(dueBy[d])}</td></tr>`).join('');
      const al = [];
      if (due5 > n(last.BANK_CASH_ACCOUNT)) al.push(['bad', `Supplier invoices due in the next 5 days (${eurK(due5)}) are more than current cash (${eurK(n(last.BANK_CASH_ACCOUNT))}). Expect the credit line to be used.`]);
      if (n(last.BANK_CASH_ACCOUNT) < 0) al.push(['bad', `Cash is negative (${eurK(n(last.BANK_CASH_ACCOUNT))}): the credit line is being used and you pay interest on it.`]);
      if (loanTrend > 0) al.push(['warn', `Loan grew by ${eurK(loanTrend * dd)} over the last ${dd} days.`]);
      if (dlTrend < 0) al.push(['warn', `Debt loading is falling ${eurK(-dlTrend)}/day. At this pace it drops another €1M in ${(1e6 / -dlTrend).toFixed(1)} days, which is about one rating tier (≈ ${eurK(tierCost)} valuation per +0.5 pp risk).`]);
      else al.push(['good', `Debt loading is improving ${eurK(dlTrend)}/day.`]);
      if (n(last.BANK_LOAN) > 0 && n(last.BANK_CASH_ACCOUNT) > 0) al.push([safeRepay > 0 ? 'good' : '', `<b>Safe to repay now: ${eurK(safeRepay)}</b> (cash − supplier invoices due in 5 days ${eurK(due5)} − 5 days of fixed costs ${eurK(fixedBuf)}). Repaying does not change debt loading (cash and loan fall together), it only saves interest. Customer payments coming in are not counted, so this is on the safe side.`]);
      const tierRows = Object.entries(tiers).sort((a, b) => a[1].risk - b[1].risk).map(([k, t]) => `<tr><td>${k}${k === last.CREDIT_RATING ? ' <span class="tag good">now</span>' : ''}</td><td>${t.risk} %</td><td>${eurK(t.lo)} … ${eurK(t.hi)}</td><td>${t.days}</td></tr>`).join('');
      return `<div class="card full"><h2>Loan &amp; credit rating monitor</h2><div class="chips">
        <span class="chip">Loan <b>${eurK(n(last.BANK_LOAN))}</b> (${loanTrend >= 0 ? '+' : ''}${eurK(loanTrend)}/day)</span>
        <span class="chip">Cash <b>${eurK(n(last.BANK_CASH_ACCOUNT))}</b> (${cashTrend >= 0 ? '+' : ''}${eurK(cashTrend)}/day)</span>
        <span class="chip">Receivables <b>${eurK(n(last.ACCOUNTS_RECEIVABLE))}</b></span><span class="chip">Payables <b>${eurK(Math.abs(n(last.ACCOUNTS_PAYABLE)))}</b></span>
        <span class="chip">Debt loading <b class="${dl(last) < 0 ? 'neg' : 'pos'}">${eurK(dl(last))}</b></span>
        <span class="chip">Rating <b>${last.CREDIT_RATING || '–'}</b> · discount rate ${pct(rate)}</span>
        <span class="chip" title="revenue − cost of goods sold − marketing − setup investment − profit, since day 1">Fixed &amp; other costs <b>${eurK(fixedDay)}/day</b> ≈ ${eur(fixedDay / CFG.CAPACITY, 2)} per box at full capacity</span></div>
        <ul class="alerts">${al.map(([c, t]) => `<li class="${c}">${t}</li>`).join('')}</ul>
        <div class="grid"><div class="chart"><canvas id="cDebt"></canvas></div><div><h3>Ratings seen so far</h3><div class="tbl"><table><thead><tr><th>Rating</th><th>Company risk</th><th>Debt loading range</th><th>Days</th></tr></thead><tbody>${tierRows}</tbody></table></div>
        <h3 style="margin-top:12px">Supplier payments due (20 days after delivery)</h3><div class="tbl"><table><thead><tr><th>Due</th><th>Amount</th></tr></thead><tbody>${dueRows || '<tr><td colspan="2" class="sub">nothing due</td></tr>'}</tbody></table></div>
        <div class="note">Next 5 days ${eurK(due5)} · next 10 days ${eurK(due10)}. Open purchase orders are not included until they are delivered.</div>
        <div class="note">${changes.length ? 'Rating changes: ' + changes.slice(-5).join(' · ') : 'No rating change yet.'} Debt loading = cash + receivables − loan − payables. Each ~€1M less is about one tier worse.</div></div></div></div>`;
    }

    // ================= LIVE RECOMMENDATIONS (heuristics) =================
    function recommendations() {
      const CAP = CFG.CAPACITY;

      // production queue (released but not finished)
      const pending = {}; let queueQty = 0;
      for (const r of rows('Production_Orders')) { const left = n(r.TARGET_QUANTITY) - n(r.CONFIRMED_QUANTITY); if (left > 0) { const c = code(r.MATERIAL_NUMBER); pending[c] = (pending[c] || 0) + left; queueQty += left; } }
      // queue end: prefer SAP's planned END dates of open orders (includes setups/gaps), fall back to units ÷ capacity
      const openEnds = rows('Production_Orders').filter(r => n(r.TARGET_QUANTITY) > n(r.CONFIRMED_QUANTITY) && n(r.END_STEP)).map(r => (n(r.END_ROUND) - 1) * CFG.ROUND_DAYS + n(r.END_STEP));
      const queueEnd = openEnds.length ? Math.max(elapsed + queueQty / CAP, ...openEnds) : elapsed + queueQty / CAP;
      const queueDays = queueEnd - elapsed;
      const reserved = {}; for (const c in pending) { const rc = recipe(c); for (const m in rc) reserved[m] = (reserved[m] || 0) + rc[m] * pending[c]; }
      const openPO = {}; // open = not delivered yet. SAP fills the planned receipt date already when the order is created (STATUS "Expected"), so an order is open while that date is still ahead
      const poOpen = r => /expected/i.test(r.STATUS || '') || !n(r.GOODS_RECEIPT_STEP) || (n(r.GOODS_RECEIPT_ROUND || r.SIM_ROUND) - 1) * CFG.ROUND_DAYS + n(r.GOODS_RECEIPT_STEP) > elapsed;
      for (const r of rows('Purchase_Orders')) if (poOpen(r)) { const m = code(r.MATERIAL_NUMBER); openPO[m] = (openPO[m] || 0) + n(r.QUANTITY); }

      // demand model (all channels – production serves every DC): per DC, market size per team (€/week) / avg price × product mix
      const dem = {};
      const mixKeys = sortKeys(allMarket.map(mKey)).slice(-CFG.MIX_PERIODS);
      const mixMarket = allMarket.filter(r => mixKeys.includes(mKey(r)));   // recent mix: follows shifts in what the market buys
      for (const dc of dcs) {
        let q = 0, v = 0; const byC = {};
        const src = mixMarket.some(r => dcOf(r) === dc) ? mixMarket : allMarket;
        for (const r of src) if (dcOf(r) === dc) { const c = mcode(r); q += n(r.QUANTITY); v += n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE); byC[c] = (byC[c] || 0) + n(r.QUANTITY); }
        if (!q) continue;
        const daily = (CFG.MARKET_PER_DC[dc] || 0) / 5 / (v / q);
        for (const c in byC) dem[c] = (dem[c] || 0) + daily * byC[c] / q;
      }
      // channels active in this game variant but without market data yet → estimate from other channels' mix, limited to allowed pack sizes
      const activeDCs = SETTINGS.variant === 'extended' ? ['10', '12', '14'] : ['12'];
      for (const dc of activeDCs) {
        if (allMarket.some(r => dcOf(r) === dc)) continue;
        let q = 0, v = 0; const byC = {};
        for (const r of (mixMarket.length ? mixMarket : allMarket)) { const c = mcode(r); if (!sizeOk(dc, c)) continue; q += n(r.QUANTITY); v += n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE); byC[c] = (byC[c] || 0) + n(r.QUANTITY); }
        if (!q) continue;
        const daily = (CFG.MARKET_PER_DC[dc] || 0) / 5 / (v / q);
        for (const c in byC) dem[c] = (dem[c] || 0) + daily * byC[c] / q;
      }
      const hasDem = Object.keys(dem).length > 0;
      const weekRev = {}; for (const r of market) { const k = mKey(r); weekRev[k] = (weekRev[k] || 0) + (n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE)); }
      const teams = CFG.TEAMS || Math.max(1, Math.round(Math.max(0, ...Object.values(weekRev)) / (CFG.MARKET_PER_DC[DC] || 360000)));
      const prodCodes = [...new Set([...codes, ...Object.keys(dem), ...Object.keys(pending), ...Object.keys(stock).filter(c => /^F/.test(c) && stock[c] > 0)])].filter(c => /^F/.test(c)).sort();
      const recent = {}; for (const r of allSales) if (n(r.SIM_ELAPSED_STEPS) > elapsed - 5) { const c = mcode(r); recent[c] = (recent[c] || 0) + n(r.QUANTITY) / 5; }

      // channel-independent production economics (all DCs) vs. channel-specific price advice (selected DC)
      const allKeys = sortKeys(allMarket.map(mKey)), rkAll = allKeys.slice(-2);
      const agA = {};
      for (const r of allMarket) { const c = mcode(r), v = n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE); const a = agA[c] = agA[c] || { q: 0, v: 0, lq: 0, lv: 0 }; a.q += n(r.QUANTITY); a.v += v; if (rkAll.includes(mKey(r))) { a.lq += n(r.QUANTITY); a.lv += v; } }
      const blend = (lq, lv, q, v) => { const rl = lq ? lv / lq : null, ra = q ? v / q : null; return rl && ra ? (rl + ra) / 2 : (rl || ra); };
      // time-phased arrivals of open production orders (SAP planned END dates)
      const arrivals = {};
      for (const r of rows('Production_Orders')) { const left = n(r.TARGET_QUANTITY) - n(r.CONFIRMED_QUANTITY); if (left <= 0) continue; const c = code(r.MATERIAL_NUMBER); const end = n(r.END_STEP) ? (n(r.END_ROUND) - 1) * CFG.ROUND_DAYS + n(r.END_STEP) : queueEnd; (arrivals[c] = arrivals[c] || []).push({ end, qty: left }); }
      const daysLeft = Math.max(0, Math.round(calcVal('days') ?? CFG.ROUND_DAYS));
      const endGame = daysLeft < CFG.ROUND_DAYS;
      // end-game: plan and buy only for the days that are left (unsold goods and unused raw materials earn nothing, and payables hurt the rating)
      const H = endGame ? Math.max(1, daysLeft - 1) : CFG.ROUND_DAYS, SAFETY_D = endGame ? 0 : 3;

      const P = prodCodes.map(c => {
        const p = prod[c] || {}; const s = stock[c] || 0, pend = pending[c] || 0;
        const ref = blend(p.lastMq, p.lastMv, p.mq, p.mv);                    // selected channel → price advice
        const a = agA[c] || {}; const refAll = blend(a.lq, a.lv, a.q, a.v);  // all channels → production economics
        const uc = unitCost(c);  // recent SAP standard cost from Sales (reflects ZCS02 recipe changes) → else recipe × cheapest supplier price
        const base = hasDem ? (dem[c] || 0) : CAP / Math.max(prodCodes.length, 1);
        const cur = p.price;
        const exp = Math.max(hasDem ? Math.max(base, Math.min(recent[c] || 0, 2 * base)) : (recent[c] || base), 1);  // recent sales capped at 2× fair share (cheap fire-sales inflate it)
        const arr = (arrivals[c] || []).slice().sort((x, y) => x.end - y.end);
        const soon = arr.filter(x => x.end <= elapsed + 2).reduce((t, x) => t + x.qty, 0);
        const coverNow = (s + soon) / exp;     // sellable in the next days (stock + batches finishing within 2 days)
        const cover = (s + pend) / exp;        // incl. the whole queue (planning view)
        const outDay = elapsed + s / exp, nextArr = arr.length ? arr[0].end : null;
        const refP = ref || refAll || (uc ? uc * 2.2 : cur);
        const mult = (s + soon) === 0 ? 1.05 : coverNow < 3 ? 1.08 : coverNow < 6 ? 1.0 : coverNow < 12 ? 0.96 : 0.92;
        let rec = refP ? refP * mult : null;
        if (rec != null && uc != null) rec = Math.max(rec, uc * 1.15, uc + CFG.FIXED_PER_UNIT * 0.5);
        if (rec != null) rec = Math.round(rec * 20) / 20;
        const margin = rec != null && uc != null ? rec - uc : 0;
        const marginProd = uc != null && (refAll || rec) ? (refAll || rec) - uc : 0;
        const rc = recipe(c); let maxUnits = Infinity, short = '';
        for (const m in rc) { const avail = (stock[m] || 0) - (reserved[m] || 0); const u = avail / rc[m]; if (u < maxUnits) { maxUnits = u; short = m; } }
        const urgent = nextArr != null ? nextArr > outDay : outDay < queueEnd + 1.5;   // shelf empties before the next batch can be ready
        const score = Math.max(marginProd, 0.05) * Math.min(exp, CAP) * (urgent ? 2 : 1) / (1 + cover / 5);
        const campaign = Math.min(3, Math.max(1, Math.round(exp * 6 / CAP)));
        const gross = exp * H;                                        // sales forecast, next H days
        const net = Math.max(0, exp * (H + SAFETY_D) - s - pend);     // still to be produced (incl. safety stock)
        return { c, s, pend, soon, ref, refAll, uc, exp, cover, coverNow, outDay, nextArr, cur, rec, margin, marginProd, maxUnits, short, urgent, score, campaign, gross, net };
      });

      // ---- alerts ----
      const alerts = [];
      const fgStock = ALL_FG.reduce((t, c) => t + (stock[c] || 0), 0);
      if (fgStock > 0.8 * CFG.FG_LIMIT) alerts.push(['warn', `Finished-goods stock ${int(fgStock)} is close to the storage capacity of ${int(CFG.FG_LIMIT)} units; above it SAP charges extra storage costs. Sell (lower prices) or produce less.`]);
      if (!queueQty) {
        if (PHASE.production) { const top = P.slice().sort((a, b) => b.score - a.score)[0]; alerts.push(['bad', `Production line is idle. Release a production order now (CO41)${top ? `, starting with <b>${name(top.c)}</b>` : ''}.`]); }
        else alerts.push(['', `Production is not available in this phase (${PHASE.label}), so sell from stock.`]);
      }
      else if (queueDays < 1) alerts.push(['warn', `Production queue ends in about ${(queueDays * 24).toFixed(0)} h. Add the next order.`]);
      else alerts.push(['good', `Production queue: ${int(queueQty)} units ≈ ${queueDays.toFixed(1)} days (until about day ${Math.ceil(queueEnd)}).`]);
      const outs = P.filter(x => x.s === 0 && x.pend === 0 && (x.ref || x.exp > 1));
      if (outs.length) alerts.push(['bad', `Out of stock, nothing in production: ${outs.map(x => name(x.c)).join(', ')}.`]);
      const gaps = P.filter(x => x.s > 0 && x.nextArr != null && x.nextArr > x.outDay + 0.5);
      if (gaps.length) alerts.push(['warn', `Will run out before the next batch is ready: ${gaps.map(x => `${name(x.c)} (empty ~${fd(x.outDay)}, batch ${fd(x.nextArr)})`).join(', ')}.`]);
      const below = P.filter(x => x.cur != null && x.uc != null && x.cur < x.uc);
      if (below.length) alerts.push(['bad', `Price below unit cost: ${below.map(x => `${name(x.c)} (${eur(x.cur, 2)} < ${eur(x.uc, 2)})`).join(', ')}.`]);
      const cheap = P.filter(x => x.cur != null && x.ref && (x.cur - x.ref) / x.ref < -0.08 && x.s > 0);
      if (cheap.length) alerts.push(['warn', `More than 8 % under market while in stock: ${cheap.map(x => name(x.c)).join(', ')}.`]);

      // ---- guard-rail alerts (all channels, independent of the channel filter) ----
      // latest market period per product × channel (falls back to the whole data period), and our own sales there in the last 5 days
      const lastK = rkAll[rkAll.length - 1], mktPD = {}, mkt5 = {}, ourPD5 = {}, pricePD = {};
      for (const r of allMarket) { const c = mcode(r), k = c + '|' + dcOf(r), q = n(r.QUANTITY), v = n(r.NET_VALUE) || q * n(r.AVERAGE_PRICE); const a = mktPD[k] = mktPD[k] || { q: 0, v: 0, lq: 0, lv: 0 }; a.q += q; a.v += v; if (mKey(r) === lastK) { a.lq += q; a.lv += v; mkt5[c] = (mkt5[c] || 0) + q; } }
      for (const r of allSales) if (n(r.SIM_ELAPSED_STEPS) > elapsed - 5) { const k = mcode(r) + '|' + dcOf(r); ourPD5[k] = (ourPD5[k] || 0) + n(r.QUANTITY); }
      for (const r of allPrices) pricePD[code(r.MATERIAL_NUMBER) + '|' + dcOf(r)] = n(r.PRICE);
      const mktRef = (c, dc) => { const a = mktPD[c + '|' + dc]; return !a ? null : a.lq ? a.lv / a.lq : a.q ? a.v / a.q : null; };
      const gapsOf = x => dcs.filter(dc => sizeOk(dc, x.c)).map(dc => { const pr = pricePD[x.c + '|' + dc], ref = mktRef(x.c, dc); if (!(pr > 0) || !ref) return null;
        let to = Math.round(ref * 0.97 * 20) / 20; if (x.uc != null) to = Math.max(to, Math.ceil(x.uc * 1.15 * 20) / 20);
        return { dc, pr, ref, gap: (pr - ref) / ref, sold: ourPD5[x.c + '|' + dc] || 0, to }; }).filter(g => g && g.gap > 0.08);
      const gapTxt = (g, withSold) => `DC${g.dc} ${eur(g.pr, 2)} vs. market ${eur(g.ref, 2)} (<b>+${(g.gap * 100).toFixed(0)} %</b>${withSold ? `, sold ${int(g.sold)} in 5 d` : ''}) → try ${eur(g.to, 2)}`;
      // 1 · in stock but priced above the market
      const over = P.filter(x => x.s >= 1000).map(x => ({ x, g: gapsOf(x) })).filter(o => o.g.length);
      if (over.length) { const hard = over.some(o => o.g.some(g => g.gap > 0.15 || g.sold === 0));
        alerts.push([hard ? 'bad' : 'warn', `<b>In stock but priced above the market (VK32, latest market period):</b> ${over.map(o => `${name(o.x.c)}, ${int(o.x.s)} in stock: ${o.g.map(g => gapTxt(g, true)).join('; ')}`).join(' · ')}. Stock that does not sell earns nothing.`]); }
      // 2 · being produced, price not ready for the shelf yet
      const pre = P.filter(x => x.s < 1000 && x.pend > 0).map(x => ({ x, g: gapsOf(x) })).filter(o => o.g.length);
      if (pre.length) alerts.push(['warn', `<b>Set the price before the batch reaches the shelf (VK32):</b> ${pre.map(o => `${name(o.x.c)}, ${int(o.x.pend)} in production${o.x.nextArr != null ? `, ready ~${fd(o.x.nextArr)}` : ''}: ${o.g.map(g => gapTxt(g, false)).join('; ')}`).join(' · ')}.`]);
      // 3 · raw materials: how long the line can keep running (queue + what the free wheat/oats still allow) vs. the supplier lead time
      if (PHASE.purchasing) {
        const dayOfPO = r => n(r.GOODS_RECEIPT_STEP) ? (n(r.GOODS_RECEIPT_ROUND || r.SIM_ROUND) - 1) * CFG.ROUND_DAYS + n(r.GOODS_RECEIPT_STEP) : null;
        const coming = {}; for (const r of rows('Purchase_Orders')) { const d = dayOfPO(r); if (poOpen(r)) { const m = code(r.MATERIAL_NUMBER); (coming[m] = coming[m] || []).push({ q: n(r.QUANTITY), d }); } }
        const base = ['R05', 'R06'].map(m => { const use = ALL_FG.map(c => recipe(c)[m] || 0).filter(u => u > 0); const avg = use.length ? use.reduce((t, u) => t + u, 0) / use.length : 0;
          const free = Math.max(0, (stock[m] || 0) - (reserved[m] || 0)); return { m, free, days: avg ? free / (avg * CAP) : 99 }; }).sort((a, b) => a.days - b.days)[0];
        const runEnd = Math.max(elapsed, queueEnd) + base.days, gameEnd = CFG.ROUNDS * CFG.ROUND_DAYS;
        const flavOut = ['R01', 'R02', 'R03', 'R04'].filter(m => (stock[m] || 0) - (reserved[m] || 0) < 0.05 * CAP && !(coming[m] || []).length);
        if (runEnd < gameEnd - 0.5 && runEnd - elapsed < CFG.LEAD_DAYS + 1) {
          const inb = Object.keys(coming).sort().map(m => `${m} ${int(coming[m].reduce((t, o) => t + o.q, 0))}${coming[m].every(o => o.d != null) ? ` (day ${[...new Set(coming[m].map(o => o.d))].join('/')})` : ''}`);
          const dayInRound = ((elapsed - 1) % CFG.ROUND_DAYS) + 1;
          alerts.push([inb.length ? 'warn' : 'bad', `<b>Raw materials last only until about ${fd(Math.floor(runEnd * 10) / 10)}</b> (queue until ${fd(Math.ceil(queueEnd * 10) / 10)} + ~${base.days.toFixed(1)} d from free ${base.m}: ${int(base.free)} kg). Suppliers need 1–${CFG.LEAD_DAYS} days, so ${inb.length ? `check that the open orders arrive in time (${inb.join(', ')}) and order the rest` : '<b>order now: MD61 → MD01 → ME59N</b>'}.${dayInRound >= CFG.ROUND_DAYS - 4 && !endGame ? ' The round is ending: order before it ends, or the line stops at the start of the next round.' : ''}${flavOut.length ? ` No free stock and no open order for ${flavOut.join(', ')}.` : ''}`]);
        }
      }
      // 4 · stock + queue of one product vs. what the market can absorb
      const glut = P.map(x => { const m5 = mkt5[x.c] || 0, fair = m5 / 5 / Math.max(1, teams), rate = Math.max(recent[x.c] || 0, fair, 1); return { x, m5, rate, days: (x.s + x.pend) / rate }; })
        .filter(o => o.x.s + o.x.pend >= 20000 && o.m5 > 0 && o.days > 8).sort((a, b) => b.days - a.days);
      if (glut.length) alerts.push(['warn', `<b>More than the market can absorb, so do not release more of it (CO41):</b> ${glut.map(o => `${name(o.x.c)} ${int(o.x.s)} in stock${o.x.pend ? ` + ${int(o.x.pend)} in production` : ''} = <b>${o.days > 99 ? '99+' : o.days.toFixed(0)} days</b> at ${int(o.rate)}/day (all teams together sold ${int(o.m5)} in the last 5 days)`).join(' · ')}. Produce smaller batches of other products and sell this stock with price or marketing.`]);
      for (const [lbl, qty, lim, u] of storage) {
        if (qty > lim) alerts.push(['bad', `${lbl}: ${int(qty)} ${u} is over the ${int(lim)} storage limit, so extra storage is being charged. Sell or slow down production/purchasing.`]);
        else if (qty > 0.9 * lim) alerts.push(['warn', `${lbl}: ${int(qty)} ${u} = ${pct(qty / lim)} of the ${int(lim)} storage limit.`]);
      }
      if (n(last.BANK_CASH_ACCOUNT) < 0) alerts.push(['bad', 'Cash is negative, so the credit line is being used (interest).']);
      if (endGame) alerts.push(['warn', `<b>End-game mode:</b> ${daysLeft} days left (header “Rounds” = ${CFG.ROUNDS}). Planning and purchasing cover only ${H} days with no safety stock: unsold boxes and unused raw materials earn nothing, and unpaid supplier invoices count against the rating.`]);
      // recipe check: latest BOM_Changes row per product × component (= current SAP BOM) vs. the recipe in the header
      const bomNow = {};
      for (const r of rows('BOM_Changes')) { const k = code(r.MATERIAL_NUMBER) + '|' + code(r.COMPONENT); if (!bomNow[k] || n(r.ROW_ID) > n(bomNow[k].ROW_ID)) bomNow[k] = r; }
      const sapBom = {}; for (const k in bomNow) { const [f, m] = k.split('|'); if (/^R/.test(m)) (sapBom[f] = sapBom[f] || {})[m] = n(bomNow[k].QUANTITY); }
      const bomBad = [];
      for (const f of Object.keys(sapBom).sort()) {
        const mine = recipe(f), comps = [...new Set([...Object.keys(sapBom[f]), ...Object.keys(mine).filter(m => /^R/.test(m))])].sort();
        const diff = comps.filter(m => Math.abs((sapBom[f][m] || 0) - (mine[m] || 0)) > 0.0005);
        if (diff.length) bomBad.push(`<b>${f}</b>: ${diff.map(m => `${m} SAP ${+(sapBom[f][m] || 0).toFixed(3)} vs. header ${+(mine[m] || 0).toFixed(3)} kg`).join(', ')}`);
      }
      if (bomBad.length) alerts.push(['bad', `<b>Recipe in the header does not match the SAP BOM</b> (BOM_Changes), so raw-material needs, costs and ME59N quantities are wrong. Fix the <b>Recipe</b> field (now ${recipeText()}): ${bomBad.slice(0, 6).join(' · ')}${bomBad.length > 6 ? ` · +${bomBad.length - 6} more` : ''}`]);
      else if (Object.keys(sapBom).length) alerts.push(['good', `Recipe in the header matches the SAP BOM for all ${Object.keys(sapBom).length} products (BOM_Changes).`]);
      const maxYield = Math.max(0, ...Object.values(rows('Production').reduce((o, r) => (o[n(r.SIM_ELAPSED_STEPS)] = (o[n(r.SIM_ELAPSED_STEPS)] || 0) + n(r.YIELD), o), {})));
      if (maxYield > CFG.CAPACITY * 1.02) alerts.push(['warn', `Observed daily output ${int(maxYield)} is above the capacity setting ${int(CFG.CAPACITY)}. Update “Capacity” in the header (game variant or a capacity investment).`]);
      if (marketFallback) alerts.push(['warn', `No market data for ${dcName(DC)} yet, so prices use other channels' data for the pack sizes this channel buys.`]);

      // ---- production ranking ----
      const rank = P.filter(x => x.marginProd > 0).sort((a, b) => b.score - a.score);
      const prodRows = rank.slice(0, 6).map((x, i) => `<tr><td>${i + 1}. ${name(x.c)}</td><td>${int(x.s)}</td><td>${int(x.pend)}</td><td>${int(x.exp)}</td>
        <td class="${x.coverNow < 2 ? 'neg' : ''}">${x.coverNow > 99 ? '99+' : x.coverNow.toFixed(1)}</td><td>${x.s ? fd(x.outDay) : 'empty'}</td><td>${fd(x.nextArr)}</td><td>${eur(x.marginProd, 2)}</td><td class="${mkt5[x.c] && x.s + x.pend > mkt5[x.c] ? 'neg' : ''}">${mkt5[x.c] ? int(mkt5[x.c]) : '–'}</td>
        <td>${x.campaign} × ${int(CAP)}</td><td>${x.maxUnits >= CAP ? '<span class="tag good">OK</span>' : `<span class="tag bad">short ${x.short}</span>`}</td><td>${x.urgent ? '<span class="tag bad">urgent</span>' : ''}</td></tr>`).join('');

      // ---- prices (selected channel) ----
      const priceRows = P.filter(x => x.rec != null && sizeOk(DC, x.c)).map(x => { const d = x.cur != null ? x.rec - x.cur : null; const act = d == null ? 'set' : Math.abs(d) < 0.05 ? 'keep' : d > 0 ? 'raise' : 'lower';
        return `<tr><td>${name(x.c)}</td><td>${int(x.s)}${x.soon ? ` <span class="sub">+${int(x.soon)}</span>` : ''}</td><td>${x.cur != null ? eur(x.cur, 2) : '–'}</td><td><b>${eur(x.rec, 2)}</b></td><td>${x.ref ? eur(x.ref, 2) : '–'}</td><td>${x.coverNow > 99 ? '99+' : x.coverNow.toFixed(1)} d</td>
        <td><span class="tag ${act === 'raise' ? 'bad' : act === 'lower' ? 'warn' : 'good'}">${act}${d != null && act !== 'keep' ? ' ' + (d > 0 ? '+' : '') + d.toFixed(2) : ''}</span></td></tr>`; }).join('');

      const vkGrid = ALL_FG.filter(c => sizeOk(DC, c)).map(c => { const x = P.find(y => y.c === c); const v = x && x.rec != null ? x.rec : x && x.cur != null ? x.cur : null; return { c, t: v != null ? v.toFixed(2) : '' }; });
      // ---- planning: gross forecast (MD61) and net production need for the next H days ----
      const plan = P.filter(x => x.marginProd > 0.3 && x.net > 0);
      const daysAvail = H - Math.max(plan.length - 1, 0) * CFG.SETUP_H / 24;
      const needDays = plan.reduce((t, x) => t + x.net / CAP, 0);
      const scale = needDays > daysAvail ? daysAvail / needDays : 1;
      let alloc = plan.map(x => ({ c: x.c, raw: x.net / CAP * scale, net: x.net, m: x.marginProd }));
      alloc.forEach(a => a.d = Math.floor(a.raw));
      let rest = Math.min(Math.floor(daysAvail), Math.ceil(alloc.reduce((t, a) => t + a.raw, 0))) - alloc.reduce((t, a) => t + a.d, 0);
      alloc.slice().sort((a, b) => (b.raw - b.d) - (a.raw - a.d)).forEach(a => { if (rest > 0 && a.raw > a.d) { a.d++; rest--; } });
      alloc = alloc.filter(a => a.d > 0);
      // day 1 of a game (no market data yet): starter plan from the settings, 2 days per product
      const starter = !hasDem && !queueQty && elapsed <= 2;
      if (starter) alloc = String(SETTINGS.start || '').split(',').filter(c => ALL_FG.includes(c)).map((c, i) => ({ c, d: 2, raw: 2, net: 2 * CAP, m: 10 - i }));

      // ---- raw-material storage limit: trim the plan (lowest margin first) until the purchases fit ----
      const kgOf = o => Object.keys(o).filter(m => /^R/.test(m)).reduce((t, m) => t + Math.max(0, o[m] || 0), 0);
      const rawRoom = CFG.RAW_LIMIT - kgOf(stock) - kgOf(openPO);
      const pcsOf = o => Object.keys(o).filter(m => /^P/.test(m)).reduce((t, m) => t + Math.max(0, o[m] || 0), 0);
      const packRoom = CFG.PACK_LIMIT - pcsOf(stock) - pcsOf(openPO);
      const needFor = al => { const nd = {}; for (const a of al) { const rc = recipe(a.c); for (const m in rc) nd[m] = (nd[m] || 0) + rc[m] * a.d * CAP; } return nd; };
      const buyOf = (nd, re) => Object.keys(nd).filter(m => re.test(m)).reduce((t, m) => t + Math.max(0, Math.ceil((nd[m] - ((stock[m] || 0) - (reserved[m] || 0)) - (openPO[m] || 0)) / 100) * 100), 0);
      let trimmed = 0;
      const tooBig = al => { const nd = needFor(al); return buyOf(nd, /^R/) > Math.max(0, rawRoom) || buyOf(nd, /^P/) > Math.max(0, packRoom); };
      while (alloc.length && tooBig(alloc)) {
        const low = alloc.slice().sort((a, b) => a.m - b.m)[0]; low.d--; trimmed++;
        if (low.d <= 0) alloc = alloc.filter(a => a !== low);
      }
      const planDays = alloc.reduce((t, a) => t + a.d, 0);
      // MD61 gross = planned output + stock + queue, so that MD01 (net = gross − stock − receipts) creates exactly this plan; 0 for products not in the plan
      const fcOf = {}; for (const a of alloc) { const x = P.find(y => y.c === a.c) || { s: stock[a.c] || 0, pend: pending[a.c] || 0 }; fcOf[a.c] = a.d * CAP + Math.round(x.s) + Math.round(x.pend); }
      const forecast = ALL_FG.map(c => ({ c, q: fcOf[c] || 0 }));

      // ---- purchasing for the net plan ----
      const need = needFor(alloc);
      const mats = Object.keys(need).sort(); let buyCost = 0;
      const buyRows = mats.map(m => { const haveNow = (stock[m] || 0) - (reserved[m] || 0); const daily = need[m] / H; const cov = daily ? Math.max(0, haveNow) / daily : 99;
        const qty = Math.max(0, Math.ceil((need[m] - haveNow - (openPO[m] || 0)) / 100) * 100); const cost = qty * (rawPrice[m] || 0); buyCost += cost;
        const st = !PHASE.purchasing ? ['', 'purchasing not open yet'] : qty > 0 && cov < CFG.LEAD_DAYS + 1 ? ['bad', 'order now'] : qty > 0 ? ['warn', 'order soon'] : ['good', 'enough'];
        return `<tr><td>${name(m)}</td><td>${int(need[m])}</td><td>${int(stock[m] || 0)}</td><td>${int(reserved[m] || 0)}</td><td>${int(openPO[m] || 0)}</td><td>${cov > 99 ? '99+' : cov.toFixed(1)} d</td><td><b>${int(qty)}</b></td><td>${rawPrice[m] != null ? eur(rawPrice[m], 2) : '–'}</td><td>${eur(cost)}</td><td><span class="tag ${st[0]}">${st[1]}</span></td></tr>`; }).join('');

      // ---- marketing signals ----
      const me = rows('Marketing_Expenses');
      const lastMeStep = Math.max(0, ...me.map(r => n(r.SIM_ELAPSED_STEPS)));
      const spendNow = {}; let spendTot = 0;
      for (const r of me) { spendTot += n(r.AMOUNT); if (n(r.SIM_ELAPSED_STEPS) === lastMeStep) { const k = code(r.MATERIAL_NUMBER) + '|' + r.AREA; spendNow[k] = (spendNow[k] || 0) + n(r.AMOUNT); } }
      const areasM = [...new Set([...market, ...sales].map(r => r.AREA).filter(Boolean))].sort();
      const shQ = {}, mkQ = {}; for (const r of sales) { const k = mcode(r) + '|' + r.AREA; shQ[k] = (shQ[k] || 0) + n(r.QUANTITY); } for (const r of market) { const k = mcode(r) + '|' + r.AREA; mkQ[k] = (mkQ[k] || 0) + n(r.QUANTITY); }
      const mk = [];
      for (const x of P) {
        const spending = areasM.filter(a => spendNow[x.c + '|' + a] > 0);
        if ((x.s + x.pend === 0 || x.cover < 2) && spending.length) mk.push([3, 'bad', `<b>Stop</b> marketing for ${name(x.c)} in ${spending.join(', ')}: stock is low or empty, so the ads would not turn into sales.`]);
        else if (x.cover > 6 && x.s > 0) {
          // rank regions by market demand per store (regional preference) × room to grow
          const opp = areasM.map(a => { const m = mkQ[x.c + '|' + a] || 0; const st = storesOf(a); return { a, m, ps: st ? m / st : m, st, sh: m ? (shQ[x.c + '|' + a] || 0) / m : 0 }; })
            .sort((a, b) => (b.ps * (1 - b.sh)) - (a.ps * (1 - a.sh)))[0];
          if (opp && opp.m) mk.push([2, 'good', `<b>Try boosting</b> ${name(x.c)} in <b>${opp.a}</b> (experiment): ${x.cover.toFixed(0)} days of stock, ${opp.st ? `${int(opp.ps)} units per store (${opp.st} stores)` : `market ${int(opp.m)} units`}, our share there ${pct(opp.sh)}.`]);
        } else if (x.cover >= 2) {
          const zero = areasM.filter(a => (mkQ[x.c + '|' + a] || 0) > 20000 && !(shQ[x.c + '|' + a] > 0));
          if (zero.length && x.s > 0) mk.push([1, 'warn', `<b>Win back</b> ${name(x.c)} in ${zero.join(', ')}: big market, 0 % share. Try a small budget or a slightly lower price.`]);
        }
      }
      mk.sort((a, b) => b[0] - a[0]);
      const mktgS = totRev ? spendTot / totRev : 0;

      const tbl = (head, body) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${head.length}" class="sub">no data</td></tr>`}</tbody></table></div>`;
      return `<div class="card full reco"><h2>Live recommendations <span class="sub">· day ${elapsed} · prices &amp; marketing for ${dcName(DC)} · production &amp; purchasing for all channels · ~${teams} teams on the market · heuristics, verify before acting</span></h2>
        <ul class="alerts">${alerts.map(a => `<li class="${a[0]}">${a[1]}</li>`).join('')}</ul>
        <div class="grid">
          <div><h3>What to produce next (CO41 order)</h3>${tbl(['Product', 'Stock', 'In queue', 'Exp. sales/day', 'Cover now (d)', 'Stock-out', 'Next batch', 'Margin/unit (all DCs)', 'Market / 5 d', 'Suggested run', 'Raw mat.', ''], prodRows)}
            <div class="note">Products are ranked by margin (market price across all channels − unit cost) × expected demand, with a boost when the shelf empties before the next batch is ready. The ranking does not depend on the channel filter. Each product change costs ${CFG.SETUP_H} h of lost output (${int(CAP * CFG.SETUP_H / 24)} units), so prefer runs of 2–3 days of the same product. “Market / 5 d” = units of that product all teams together sold in the latest market period (red when our stock + queue is already larger).</div></div>
          <div><h3>Prices (VK32) <button data-copy="${vkGrid.map(v => v.t).join('\n')}" title="${vkGrid.length} lines for VK32 (${vkGrid[0].c}…${vkGrid[vkGrid.length - 1].c}), one per SAP row. Products without a recommendation keep their current price; an empty line = no price known">Copy column (${vkGrid.length} rows)</button></h3>${tbl(['Product', 'Stock', 'Now', 'Recommended', 'Market', 'Cover', 'Action'], priceRows)}
            <div class="note">Prices for the selected channel. Stock = finished goods now (+ batches finishing within 2 days). The recommendation starts from that channel's market price and moves up when sellable stock is short (stock + batches finishing within 2 days under 3 days of sales) or down when there is too much (over 6 days). It never goes below unit cost × 1.15. Grocery chains buy 4 products per order, so keep the price level even across products.</div></div>
          <div><h3>Marketing signals (ZADS)</h3>${mk.length ? `<ul class="alerts">${mk.slice(0, 8).map(m => `<li class="${m[1]}">${m[2]}</li>`).join('')}</ul>` : '<div class="sub">No strong signal. Keep marketing low until there is spare stock.</div>'}
            <div class="note">Marketing so far: ${eur(spendTot)} (MKTG/S ${pct(mktgS)}). Spend on products with spare stock, in regions where the market is big and our share is low. Never advertise products you cannot deliver. These are opportunities to test, not proven returns: change one budget a little and check sales and margin 2–3 days later. Grocery chains (DC12) react moderately to advertising.</div></div>
          <div class="full"><h3>Planning &amp; purchasing for the next ${H} days (MD61 → MD01 → ME59N → CO41)</h3>
            <div class="sub" style="margin:2px 0 6px"><b>1 · MD61 sales forecast (gross)</b> for all 12 rows (F01–F06, F11–F16; 0 = do not produce). Each value = planned output + stock + queue, because MD01 subtracts stock and open orders, so MRP plans exactly step 2.${starter ? ' <span class="tag warn">Day-1 starter plan</span> (no market data yet; edit “Start” in the header).' : ''}</div>
            <div class="chips"><button data-copy="${forecast.map(f => f.q).join('\n')}" title="12 lines F01…F16, one per MD61 row">Copy column (12 rows)</button>${forecast.map(f => `<span class="chip${f.q ? '' : ' sub'}">${f.c}: <b>${int(f.q)}</b></span>`).join('')}</div>
            <div class="sub" style="margin:2px 0 6px"><b>2 · Net production need</b> = forecast + ${SAFETY_D} days of safety stock − stock − queue, limited to ${daysAvail.toFixed(1)} production days after setups and to the storage limits: raw materials ${int(CFG.RAW_LIMIT)} kg (free ≈ ${int(Math.max(0, rawRoom))}), packing ${int(CFG.PACK_LIMIT)} pcs (free ≈ ${int(Math.max(0, packRoom))}) · ${planDays} d planned${trimmed ? ` · <span class="neg">${trimmed} d cut by a storage limit: run MD61 → MD01 again in a few days, when stock has been used</span>` : ''}:</div>
            <div class="chips">${alloc.map(a => `<span class="chip">${name(a.c)}: <b>${a.d} d</b> = ${int(a.d * CAP)}${a.raw < a.net / CAP - 0.01 ? ' <span class="neg">(capacity-limited)</span>' : ''}</span>`).join('') || '<span class="sub">nothing to produce: stock and queue cover the horizon</span>'}</div>
            <div class="sub" style="margin:8px 0 6px"><b>3 · Raw materials for that plan (ME59N)</b>: total ≈ <b>${eur(buyCost)}</b>, paid 20 days after delivery.</div>
            ${tbl(['Material', `Need (next ${H} d)`, 'Stock', 'Reserved for queue', 'Open PO', 'Cover now', 'Order qty', 'Unit price', 'Cost', ''], buyRows)}
            <div class="note">${PHASE.purchasing ? '' : `<b>Purchasing is not open yet (${PHASE.label}).</b> The table shows what you will need. `}Suppliers deliver in 1–${CFG.LEAD_DAYS} days, so order when the cover drops under ${CFG.LEAD_DAYS + 1} days. If the requisitions created by MRP differ a lot from “Order qty”, check the MD61 forecast. <b>4 · CO41</b>: release planned orders in the order from “What to produce next”, keeping runs of the same product together. Unit cost = SAP standard cost from the last 5 days of sales (reflects recipe changes), otherwise cheapest supplier price × the recipe in the header (${recipeText()}). Raw-material quantities use the same recipe.</div></div>
        </div></div>`;
    }

    // ================= COMPETITORS (market − us) =================
    const stepNow = n(last.SIM_STEP);
    const keyDays = k => { const [r, p] = k.split('-').map(Number); const w = perRound ? p : p - (r - 1) * 4; return (r === n(curRound) && w === Math.ceil(stepNow / 5)) ? Math.max(1, stepNow - (w - 1) * 5) : 5; };  // SAP numbers periods globally (round 2 = W5..8)
    function competitorSection() {
      if (!mKeys.length) return '';
      const cur = mKeys[mKeys.length - 1], prev = mKeys[mKeys.length - 2];
      const agg = {}; const A = (c, k) => agg[c + '|' + k] = agg[c + '|' + k] || { mq: 0, mv: 0, oq: 0, ov: 0 };
      for (const r of market) { const a = A(mcode(r), mKey(r)); a.mq += n(r.QUANTITY); a.mv += n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE); }
      for (const r of sales) { const a = A(mcode(r), sKey(r)); a.oq += n(r.QUANTITY); a.ov += n(r.NET_VALUE); }
      const comp = (c, k) => { const a = agg[c + '|' + k]; if (!a || !k) return null; const q = Math.max(0, a.mq - a.oq), v = Math.max(0, a.mv - a.ov); return { q, qd: q / keyDays(k), p: q ? v / q : null, share: a.mq ? a.oq / a.mq : 0 }; };
      const wk = {}, ourWk = {};
      for (const r of market) { const k = mKey(r); wk[k] = (wk[k] || 0) + (n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE)); }
      for (const r of sales) { const k = sKey(r); ourWk[k] = (ourWk[k] || 0) + n(r.NET_VALUE); }
      const size = CFG.MARKET_PER_DC[DC] || 360000;
      const teamsEst = CFG.TEAMS || Math.max(2, Math.round(Math.max(...mKeys.map(k => wk[k] / keyDays(k) * 5)) / size));
      const rowsP = codesDC.map(c => {
        const a = comp(c, cur), b = comp(c, prev); if (!a) return '';
        const dq = b && b.qd >= 200 ? (a.qd - b.qd) / b.qd : null, dp = b && b.p && a.p ? (a.p - b.p) / b.p : null;
        const our = prod[c] ? prod[c].price : null, vs = our != null && a.p ? (our - a.p) / a.p : null;
        let sig = ['', '–'];
        if (dq != null && dq < -0.3 && dp != null && dp > 0.08) sig = ['good', 'Competitors running short: raise price and produce'];
        else if (vs != null && vs < -0.1) sig = ['bad', 'We are >10 % cheaper: money left on the table'];
        else if (vs != null && vs > 0.15) sig = ['warn', 'We are >15 % pricier: watch sales'];
        else if (vs != null) sig = ['good', 'In line'];
        const f = (v, d = 0) => v == null ? '–' : `<span class="${v < 0 ? 'neg' : 'pos'}">${v > 0 ? '+' : ''}${pct(v)}</span>`;
        return `<tr><td>${name(c)}</td><td>${int(a.qd)}</td><td>${f(dq)}</td><td>${a.p ? eur(a.p, 2) : '–'}</td><td>${f(dp)}</td><td>${our != null ? eur(our, 2) : '–'}</td><td>${f(vs)}</td><td>${pct(a.share)}</td><td>${sig[0] ? `<span class="tag ${sig[0]}">${sig[1]}</span>` : sig[1]}</td></tr>`;
      }).join('');
      const rowsW = mKeys.map(k => { const tot = wk[k] || 0, us = ourWk[k] || 0, cmp = Math.max(0, tot - us), avg = cmp / (teamsEst - 1);
        return `<tr><td>${keyLabel(k)}${keyDays(k) < 5 ? ` <span class="sub">(${keyDays(k)} d so far)</span>` : ''}</td><td>${eurK(tot)}</td><td>${eurK(cmp)}</td><td>${eurK(avg)}</td><td>${eurK(us)}</td><td class="${us >= avg ? 'pos' : 'neg'}">${avg ? (us / avg).toFixed(2) + '×' : '–'}</td><td>${tot ? pct(us / tot) : '–'}</td></tr>`; }).join('');
      return `<div class="card full"><h2>Competitors (${dcName(DC)}): whole market minus us <span class="sub">· ${CFG.TEAMS ? `${teamsEst} teams` : `about ${teamsEst} teams (market revenue ÷ ${eurK(size)} per team per week)`}</span></h2>
        <div class="grid"><div><h3>By product: latest week ${keyLabel(cur)} vs ${prev ? keyLabel(prev) : '–'}</h3><div class="tbl"><table><thead><tr><th>Product</th><th>Comp. units/day</th><th>Δ units</th><th>Comp. avg price</th><th>Δ price</th><th>Our price</th><th>Us vs comp.</th><th>Our share</th><th>Signal</th></tr></thead><tbody>${rowsP}</tbody></table></div></div>
        <div><h3>By week: us vs the average competitor</h3><div class="tbl"><table><thead><tr><th>Week</th><th>Market</th><th>Competitors</th><th>Avg competitor</th><th>Us</th><th>Us ÷ avg</th><th>Our share</th></tr></thead><tbody>${rowsW}</tbody></table></div>
        <div class="note">Per-team data is not in OData (only our company + total market). “Competitors” = market − our sales. The average competitor = competitors ÷ (teams − 1). Us ÷ avg above 1.0 means we beat the average team. Competitor volumes falling while their price rises usually means they are out of stock, so that is the moment to raise price or produce that product. The current week is normalised per day.</div></div></div></div>`;
    }

    // ================= PRODUCTION & MATERIALS =================
    const gday = (r, s) => (n(r) - 1) * CFG.ROUND_DAYS + n(s);
    const fd = d => d == null ? '–' : 'day ' + (Math.abs(d % 1) > 0.05 ? d.toFixed(1) : Math.round(d));
    let prodCharts = null;
    function productionSection() {
      const CAP = CFG.CAPACITY;
      const bd = o => n(o.BEGIN_STEP) ? gday(o.BEGIN_ROUND, o.BEGIN_STEP) : 1e9;
      const orders = rows('Production_Orders').slice().sort((a, b) => bd(a) - bd(b) || String(a.PRODUCTION_ORDER).localeCompare(String(b.PRODUCTION_ORDER), undefined, { numeric: true }));
      let t = elapsed, prevC = null, switches = 0; const sched = [];
      for (const o of orders) {
        const c = code(o.MATERIAL_NUMBER), tq = n(o.TARGET_QUANTITY), cq = n(o.CONFIRMED_QUANTITY);
        if (prevC && prevC !== c) switches++;
        const b = n(o.BEGIN_STEP) ? gday(o.BEGIN_ROUND, o.BEGIN_STEP) : null, e = n(o.END_STEP) ? gday(o.END_ROUND, o.END_STEP) : null;
        const done = tq > 0 && cq >= tq;
        let start = b, end = e;
        if (!done) {
          const setup = prevC && prevC !== c ? CFG.SETUP_H / 24 : 0;
          if (start == null) start = Math.max(t, elapsed);
          if (end == null) end = Math.max(start, t) + setup + (tq - cq) / CAP;
          t = Math.max(t, end);
        }
        sched.push({ id: o.PRODUCTION_ORDER, c, tq, cq, start, end, done, running: !done && (cq > 0 || (b != null && b <= elapsed)) });
        prevC = c;
      }
      const open = sched.filter(o => !o.done);
      const started = sched.filter(o => o.done || o.running); let swDone = 0; for (let i = 1; i < started.length; i++) if (started[i].c !== started[i - 1].c) swDone++;
      const lineFree = open.length ? Math.max(...open.map(o => o.end || elapsed)) : elapsed;
      const show = sched.slice(-14);
      const d0 = Math.min(elapsed, ...show.map(o => o.start ?? elapsed)), d1 = Math.max(elapsed + 1, ...show.map(o => o.end ?? elapsed + 1));
      const X = d => ((d - d0) / (d1 - d0) * 100).toFixed(1);
      const schedRows = show.map(o => `<tr><td>${o.id}</td><td>${name(o.c)}</td><td>${int(o.cq)} / ${int(o.tq)}</td><td>${fd(o.start)}</td><td>${fd(o.end)}</td>
        <td><span class="tag ${o.done ? '' : o.running ? 'good' : 'warn'}">${o.done ? 'done' : o.running ? 'running' : 'queued'}</span></td>
        <td class="gantt"><div class="gbar ${o.done ? 'done' : o.running ? 'run' : ''}" style="left:${X(o.start ?? d0)}%;width:${Math.max(1, X(o.end ?? d0) - X(o.start ?? d0))}%"></div><div class="gnow" style="left:${X(elapsed)}%"></div></td></tr>`).join('');

      // capacity utilisation
      const yieldDay = {}, yieldDC = {};
      for (const r of rows('Production')) { const d = n(r.SIM_ELAPSED_STEPS), c = code(r.MATERIAL_NUMBER); yieldDay[d] = (yieldDay[d] || 0) + n(r.YIELD); yieldDC[d + '|' + c] = (yieldDC[d + '|' + c] || 0) + n(r.YIELD); }
      const yDays = Object.keys(yieldDay).map(Number);
      const firstProd = yDays.length ? Math.min(...yDays) : null;
      const totalY = Object.values(yieldDay).reduce((a, b) => a + b, 0);
      const span = firstProd ? Math.max(1, elapsed - firstProd + 1) : 0;
      const util = span ? totalY / (span * CAP) : 0;
      if (span >= 3) calcCtx.sw = +(swDone / span * CFG.ROUND_DAYS).toFixed(1);
      const idleDays = firstProd ? Array.from({ length: span }, (_, i) => firstProd + i).filter(d => !(yieldDay[d] > 0)).length : 0;

      // stock projection per finished product
      const rate = {}; for (const r of allSales) if (n(r.SIM_ELAPSED_STEPS) > elapsed - 5) { const c = mcode(r); rate[c] = (rate[c] || 0) + n(r.QUANTITY) / 5; }
      const fgCodes = [...new Set([...Object.keys(stock).filter(c => /^F/.test(c) && (stock[c] > 0 || rate[c] > 0)), ...open.map(o => o.c)])].sort();
      const projRows = fgCodes.map(c => {
        const s = stock[c] || 0, r = rate[c] || 0, out = r > 0 ? elapsed + s / r : null;
        const arr = open.filter(o => o.c === c).map(o => o.end).sort((a, b) => a - b)[0] ?? null;
        let st = ['good', 'OK'];
        if (s === 0) st = arr != null ? ['warn', `empty until ${fd(arr)}`] : ['bad', 'empty, nothing planned'];
        else if (out != null && arr == null) st = out - elapsed <= 5 ? ['bad', 'runs out soon, nothing planned'] : ['warn', 'no batch planned'];
        else if (out != null && arr > out) st = ['bad', `${(arr - out).toFixed(1)} days without stock`];
        return `<tr><td>${name(c)}</td><td>${int(s)}</td><td>${int(r)}</td><td>${out == null ? '–' : fd(out)}</td><td>${fd(arr)}</td><td><span class="tag ${st[0]}">${st[1]}</span></td></tr>`;
      }).join('');

      // raw materials & purchase orders
      const reserved = {}; for (const o of open) { const rc = recipe(o.c); for (const m in rc) reserved[m] = (reserved[m] || 0) + rc[m] * (o.tq - o.cq); }
      const pos = rows('Purchase_Orders').slice().sort((a, b) => n(b.SIM_ELAPSED_STEPS) - n(a.SIM_ELAPSED_STEPS));
      const openPO = {}, lead = {};
      const poRows = pos.slice(0, 20).map(r => {
        const m = code(r.MATERIAL_NUMBER), ord = n(r.SIM_ELAPSED_STEPS), rec = n(r.GOODS_RECEIPT_STEP) ? gday(r.GOODS_RECEIPT_ROUND, r.GOODS_RECEIPT_STEP) : null;
        return `<tr><td>${r.PURCHASING_ORDER}</td><td>${name(m)}</td><td>${r.VENDOR || ''}</td><td>${int(r.QUANTITY)}</td><td>${eur(r.UNIT_PRICE, 2)}</td><td>${fd(ord)}</td><td>${/expected/i.test(r.STATUS || '') || (rec && rec > elapsed) ? `<span class="tag warn">open · expected ${rec ? fd(rec) : fd(ord + 1) + '–' + fd(ord + CFG.LEAD_DAYS).replace('day ', '')}</span>` : rec ? fd(rec) : `<span class="tag warn">open · expected ${fd(ord + 1)}–${fd(ord + CFG.LEAD_DAYS).replace('day ', '')}</span>`}</td><td>${rec ? (rec - ord) + ' d' : '–'}</td></tr>`;
      }).join('');
      for (const r of pos) { const m = code(r.MATERIAL_NUMBER), ord = n(r.SIM_ELAPSED_STEPS), rec = n(r.GOODS_RECEIPT_STEP) ? gday(r.GOODS_RECEIPT_ROUND, r.GOODS_RECEIPT_STEP) : null;
        const isOpen = /expected/i.test(r.STATUS || '') || !rec || rec > elapsed;   // SAP fills the planned receipt date already at order creation
        if (isOpen) openPO[m] = (openPO[m] || 0) + n(r.QUANTITY); else { const v = r.VENDOR || '?'; (lead[v] = lead[v] || []).push(rec - ord); } }
      const leadTxt = Object.entries(lead).map(([v, a]) => `${v}: ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)} d avg`).join(' · ');
      const mats = Object.keys(stock).filter(c => /^[RP]/.test(c)).sort();
      const rawRows = mats.map(m => { const s = stock[m] || 0, res = reserved[m] || 0, free = s - res;
        return `<tr><td>${name(m)}</td><td>${int(s)}</td><td>${int(res)}</td><td class="${free < 0 ? 'neg' : ''}">${int(free)}</td><td>${int(openPO[m] || 0)}</td><td>${free < 0 ? '<span class="tag bad">short for queue</span>' : free < (m[0] === 'R' ? 2000 : 16000) && !openPO[m] ? '<span class="tag warn">low, nothing ordered</span>' : '<span class="tag good">OK</span>'}</td></tr>`; }).join('');

      prodCharts = { yieldDay, yieldDC, firstProd };
      // ---- BOM detective: SAP has no BOM entity in OData, so infer kg/units per box from stock movements ----
      // consumption(d, m) = opening(d) + goods receipts(d) − opening(d+1); use only days where exactly one product was produced
      // and no receipt of that material landed on d−1…d+1 (receipt-day timing uncertainty).
      const openB = {}; for (const r of rows('Inventory')) { const k = n(r.SIM_ELAPSED_STEPS) + '|' + code(r.MATERIAL_NUMBER); openB[k] = (openB[k] || 0) + n(r.INVENTORY_OPENING_BALANCE); }
      const recDay = {}; for (const r of rows('Purchase_Orders')) if (n(r.GOODS_RECEIPT_STEP)) { const k = gday(r.GOODS_RECEIPT_ROUND, r.GOODS_RECEIPT_STEP) + '|' + code(r.MATERIAL_NUMBER); recDay[k] = (recDay[k] || 0) + n(r.QUANTITY); }
      const bom = {}; const bomMats = [...new Set(rows('Inventory').map(r => code(r.MATERIAL_NUMBER)).filter(m => /^[RP]/.test(m)))].sort();
      for (const d of yDays) {
        const made = Object.keys(yieldDC).filter(k => k.startsWith(d + '|') && yieldDC[k] > 0); if (made.length !== 1) continue;
        const c = made[0].split('|')[1], y = yieldDC[made[0]]; if (y < 1000) continue;
        for (const m of bomMats) {
          if (openB[d + '|' + m] == null || openB[(d + 1) + '|' + m] == null) continue;
          if (recDay[(d - 1) + '|' + m] || recDay[d + '|' + m] || recDay[(d + 1) + '|' + m]) continue;
          const b = (bom[c] = bom[c] || {})[m] = bom[c][m] || { cons: 0, y: 0, days: 0 };
          b.cons += openB[d + '|' + m] - openB[(d + 1) + '|' + m]; b.y += y; b.days++;
        }
      }
      const bomDiff = [];
      const bomRows = Object.keys(bom).sort().map(c => { const def = recipe(c);
        const cells = bomMats.map(m => { const b = bom[c][m], dv = def[m] || 0; if (!b) return `<td class="sub">${dv ? +dv.toFixed(3) : '·'}</td>`;
          const v = b.cons / b.y, off = Math.abs(v - dv) > Math.max(0.02, dv * 0.1);
          if (off) bomDiff.push(`${c}: ${m} ${+v.toFixed(3)} (expected ${+dv.toFixed(3)})`);
          return `<td class="${off ? 'neg' : ''}" title="${b.days} clean days">${Math.abs(v) < 0.005 ? '0' : +v.toFixed(3)}${off ? `<div class="sub">exp. ${+dv.toFixed(3)}</div>` : ''}</td>`; }).join('');
        return `<tr><td>${name(c)}</td>${cells}<td>${Math.max(...Object.values(bom[c]).map(b => b.days))}</td></tr>`; }).join('');
      const bomHtmlF = () => `<div class="full"><h3>BOM detective: actual consumption per box (from stock movements)</h3>${tbl(['Product', ...bomMats, 'Clean days'], bomRows, 'needs at least one day where only one product was produced')}
        <div class="note">${bomDiff.length ? `<b style="color:var(--bad)">Differs from the recipe in the header:</b> ${bomDiff.join(' · ')}. If this repeats over several days, the BOM changed: check it in SAP (ZCS02 / CS03) and put the new shares into the <b>Recipe</b> field in the header, so costs, planning and ME59N use them. ` : bomRows ? `<b style="color:var(--good)">Matches the recipe in the header (${recipeText()} + packaging).</b> ` : ''}Grey = default recipe where there is no clean measurement yet. Measured only on days with exactly one product on the line and no delivery of that material around that day. kg per box for raw materials, pieces for packaging.</div></div>`;
      const tbl = (head, body, empty) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${head.length}" class="sub">${empty || 'no data yet'}</td></tr>`}</tbody></table></div>`;
      return `<div class="card full"><h2>Production &amp; materials</h2>
        <ul class="alerts">
          <li class="${open.length ? (lineFree - elapsed < 1 ? 'warn' : 'good') : (PHASE.production ? 'bad' : '')}">${open.length ? `Line busy until about <b>${fd(lineFree)}</b> (${(lineFree - elapsed).toFixed(1)} days of queue, ${open.length} open orders).` : (PHASE.production ? 'No open production orders, so the line is idle.' : `No production in this phase (${PHASE.label}).`)}</li>
          <li class="${util && util < 0.85 ? 'warn' : 'good'}">Capacity use since first production (${firstProd ? fd(firstProd) : '–'}): <b>${pct(util)}</b> · produced ${int(totalY)} units · ${swDone} product changes so far ≈ ${int(swDone * CAP * CFG.SETUP_H / 24)} units lost to setup (${Math.max(0, switches - swDone)} more planned in the queue) · ${idleDays} idle days.</li>
        </ul>
        <div class="grid">
          <div class="full"><h3>Production schedule (CO41 / ZCOOIS)</h3>${tbl(['Order', 'Product', 'Confirmed / target', 'Start', 'End', 'Status', `Timeline (red = today, ${fd(d0)}–${fd(d1)})`], schedRows, 'no production orders yet')}</div>
          <div><h3>Daily output vs capacity</h3><div class="chart"><canvas id="cProd"></canvas></div></div>
          <div><h3>Finished-goods stock by day</h3><div class="chart"><canvas id="cInv"></canvas></div></div>
          <div><h3>Stock-out vs next production</h3>${tbl(['Product', 'Stock', 'Sales/day (last 5 d)', 'Stock-out', 'Next batch ready', 'Status'], projRows)}
            <div class="note">If the stock-out day comes before the next batch is ready, the product will be missing from the shelf. Release that order sooner or raise its price to slow sales.</div></div>
          <div><h3>Raw materials &amp; packaging</h3>${tbl(['Material', 'Stock', 'Reserved for queue', 'Free', 'On order', 'Status'], rawRows)}</div>
          ${bomHtmlF()}
          <div class="full"><h3>Purchase orders (ME59N / ZME2N)</h3>${tbl(['PO', 'Material', 'Vendor', 'Qty', 'Unit price', 'Ordered', 'Received', 'Lead time'], poRows, 'no purchase orders yet')}
            <div class="note">${leadTxt ? 'Observed lead time: ' + leadTxt + '. ' : ''}Suppliers deliver in 1–${CFG.LEAD_DAYS} days and you pay 20 days after delivery. A production order can only be released when all of its raw materials are in stock.</div></div>
        </div></div>`;
    }

    let html = '<div class="kpis">' + kpis.map(k => `<div class="kpi"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="d">${k[2]}</div></div>`).join('') + '</div>';

    const signal = p => {
      const ref = p.lastMq ? p.lastMv / p.lastMq : (p.mq ? p.mv / p.mq : null);
      if (p.price == null || ref == null) return ['–', ''];
      const gap = (p.price - ref) / ref;
      if (gap < -0.08) return [p.inv === 0 ? 'Below market, sold out – raise' : 'Raise price', 'bad'];
      if (gap > 0.15 && p.inv > 0) return ['Above market – watch sales', 'warn'];
      return ['OK', 'good'];
    };
    html += recommendations();
    html += '<div class="grid">';
    html += financeSection();
    html += `<div class="card full"><h2>Our prices vs. market (${dcName(DC)})</h2><div class="tbl"><table><thead><tr>
<th>Product</th><th>Our price</th><th>Market – last 2 weeks</th><th>Market – overall</th><th>Gap</th><th>Unit cost</th><th>Margin/unit at market price</th><th>Units sold</th><th>Inventory</th><th>Signal</th></tr></thead><tbody>` +
      codesDC.map(c => {
        const p = prod[c]; const ref = p.lastMq ? p.lastMv / p.lastMq : null; const all = p.mq ? p.mv / p.mq : null; const uc = unitCost(c);
        const gap = (p.price != null && ref) ? (p.price - ref) / ref : null; const [s, cls] = signal(p);
        return `<tr><td>${name(c)}</td><td>${p.price != null ? eur(p.price, 2) : '–'}</td><td>${ref ? eur(ref, 2) : '–'}</td><td>${all ? eur(all, 2) : '–'}</td>
  <td class="${gap == null ? '' : gap < 0 ? 'neg' : 'pos'}">${gap == null ? '–' : (gap > 0 ? '+' : '') + pct(gap)}</td><td>${uc ? eur(uc, 2) : '–'}</td><td>${(uc && ref) ? eur(ref - uc, 2) : '–'}</td>
  <td>${int(p.q)}</td><td>${p.inv == null ? '–' : int(p.inv)}</td><td>${cls ? `<span class="tag ${cls}">${s}</span>` : s}</td></tr>`;
      }).join('') +
      `</tbody></table></div><div class="note">Unit cost (same rule as the recommendations) = SAP standard cost from the last 5 days of sales, otherwise cheapest supplier price × the recipe in the header. Margins are before fixed costs. “Market – last 2 weeks” = volume-weighted average price of all teams over the last two 5-day weeks. “Raise price” = we are more than 8 % below market.</div></div>`;
    html += competitorSection();
    html += `<div class="card"><h2>Company valuation and profit by day</h2><div class="chart"><canvas id="cVal"></canvas></div></div>`;
    html += `<div class="card"><h2>Our sales by day (units)</h2><div class="chart"><canvas id="cDaily"></canvas></div></div>`;
    html += `<div class="card"><h2>Average market price by week</h2><div class="chart"><canvas id="cMktPrice"></canvas></div></div>`;
    html += `<div class="card"><h2>Market volume vs. our sales by week</h2><div class="chart"><canvas id="cShare"></canvas></div></div>`;

    const areas = [...new Set([...market, ...sales].map(r => r.AREA).filter(Boolean))].sort();
    const sh = {}, mk = {};
    for (const r of sales) { const k = mcode(r) + '|' + r.AREA; sh[k] = (sh[k] || 0) + n(r.QUANTITY); }
    for (const r of market) { const k = mcode(r) + '|' + r.AREA; mk[k] = (mk[k] || 0) + n(r.QUANTITY); }
    const accent = css('--accent');
    html += `<div class="card full"><h2>Our market share &amp; regional preference: product × region (${dcName(DC)}, units, whole data period)</h2><div class="tbl"><table class="heat"><thead><tr><th>Product</th>${areas.map(a => `<th style="text-align:center">${a}</th>`).join('')}<th style="text-align:center">Total</th></tr></thead><tbody>` +
      codesDC.map(c => {
        let so = 0, mo = 0;
        const stTot = areas.reduce((t, a) => t + (storesOf(a) || 0), 0), mTot = areas.reduce((t, a) => t + (mk[c + '|' + a] || 0), 0);
        const cells = areas.map(a => { const s = sh[c + '|' + a] || 0, m = mk[c + '|' + a] || 0; so += s; mo += m; const f = m ? s / m : 0;
          const st = storesOf(a); const pref = st && stTot && mTot ? (m / st) / (mTot / stTot) : null;
          return `<td style="background:color-mix(in srgb, ${accent} ${Math.round(Math.min(f * 2, 1) * 55)}%, transparent)">${m ? pct(f) : '–'}<div class="sub">${int(s)} / ${int(m)}${pref != null ? ` · pref <b style="color:${pref >= 1.1 ? 'var(--good)' : pref <= 0.9 ? 'var(--bad)' : 'inherit'}">${pref.toFixed(2)}</b>` : ''}</div></td>`; }).join('');
        return `<tr><td>${name(c)}</td>${cells}<td><b>${mo ? pct(so / mo) : '–'}</b></td></tr>`;
      }).join('') +
      `</tbody></table></div><div class="note">Cell: our share · our units / total market units · <b>pref</b> = market units per store in that region ÷ the product's average per store (above 1.0 means the region likes this flavour more than its size suggests, so target it with ZADS). 0 % with a large market = orders that went to competitors.</div></div>`;
    html += productionSection();
    html += '</div>';

    charts.forEach(ch => ch.destroy()); charts = [];
    const y = window.scrollY;
    app.innerHTML = html;
    window.scrollTo(0, y);

    updateCalc();
    if (!window.Chart) { document.querySelectorAll('.chart').forEach(e => e.innerHTML = '<div class="empty">Chart.js failed to load (internet required).</div>'); return; }
    Chart.defaults.color = css('--muted'); Chart.defaults.borderColor = css('--line'); Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.animation = false;
    const palette = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#9333ea', '#ea580c', '#0d9488', '#4b5563'];
    const allCodes = Object.keys(code2name).sort();
    const color = c => palette[Math.max(0, allCodes.indexOf(c)) % palette.length];
    const money = { callback: v => eurK(v) };
    const mk2 = (id, cfg) => charts.push(new Chart(document.getElementById(id), cfg));

    mk2('cVal', { type: 'line', data: { labels: val.map(r => `D${n(r.SIM_ELAPSED_STEPS)}`), datasets: [
      { label: 'Company valuation', data: val.map(r => n(r.COMPANY_VALUATION)), borderColor: palette[0], yAxisID: 'y', tension: .2, pointRadius: 2 },
      { label: 'Cumulative profit', data: val.map(r => n(r.PROFIT)), borderColor: palette[1], yAxisID: 'y1', tension: .2, pointRadius: 2 },
    ] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { type: 'logarithmic', ticks: money, title: { display: true, text: 'valuation (log)' } }, y1: { position: 'right', grid: { display: false }, ticks: money } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eurK(c.raw)}` } } } } });

    if (document.getElementById('cDebt')) mk2('cDebt', { type: 'line', data: { labels: val.map(r => `D${n(r.SIM_ELAPSED_STEPS)}`), datasets: [
      { label: 'Loan', data: val.map(r => n(r.BANK_LOAN)), borderColor: palette[2], pointRadius: 0, tension: .2 },
      { label: 'Cash', data: val.map(r => n(r.BANK_CASH_ACCOUNT)), borderColor: palette[1], pointRadius: 0, tension: .2 },
      { label: 'Payables', data: val.map(r => Math.abs(n(r.ACCOUNTS_PAYABLE))), borderColor: palette[3], pointRadius: 0, tension: .2, borderDash: [4, 3] },
      { label: 'Debt loading', data: val.map(r => n(r.DEBT_LOADING)), borderColor: palette[0], pointRadius: 0, tension: .2, borderWidth: 3 },
    ] }, options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { ticks: money } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${eurK(c.raw)}` } } } } });
    const days = sales.map(r => n(r.SIM_ELAPSED_STEPS));
    const maxDay = Math.max(elapsed, ...days, 1); const dayAxis = Array.from({ length: maxDay }, (_, i) => i + 1);
    mk2('cDaily', { type: 'bar', data: { labels: dayAxis.map(d => `D${d}`), datasets: codes.filter(c => prod[c].q).map(c => ({ label: name(c), backgroundColor: color(c), data: dayAxis.map(d => sales.filter(r => n(r.SIM_ELAPSED_STEPS) === d && mcode(r) === c).reduce((a, r) => a + n(r.QUANTITY), 0)) })) },
      options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { labels: { boxWidth: 10 } } } } });

    mk2('cMktPrice', { type: 'line', data: { labels: mKeys.map(keyLabel), datasets: codes.filter(c => prod[c].mq).map(c => ({ label: name(c), borderColor: color(c), backgroundColor: color(c), tension: .2, pointRadius: 2,
      data: mKeys.map(k => { const rs = market.filter(r => mKey(r) === k && mcode(r) === c); const q = rs.reduce((a, r) => a + n(r.QUANTITY), 0); const v = rs.reduce((a, r) => a + (n(r.NET_VALUE) || n(r.QUANTITY) * n(r.AVERAGE_PRICE)), 0); return q ? +(v / q).toFixed(2) : null; }) })) },
      options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: v => '€' + v } } }, plugins: { legend: { labels: { boxWidth: 10 } } } } });

    const sKeys = sortKeys([...mKeys, ...sales.map(sKey)]);
    const mq = sKeys.map(k => market.filter(r => mKey(r) === k).reduce((a, r) => a + n(r.QUANTITY), 0));
    const oq = sKeys.map(k => sales.filter(r => sKey(r) === k).reduce((a, r) => a + n(r.QUANTITY), 0));
    mk2('cShare', { data: { labels: sKeys.map(keyLabel), datasets: [
      { type: 'bar', label: 'Market (all teams), units', data: mq, backgroundColor: css('--line'), yAxisID: 'y' },
      { type: 'bar', label: 'Us, units', data: oq, backgroundColor: palette[0], yAxisID: 'y' },
      { type: 'line', label: 'Our share', data: sKeys.map((k, i) => mq[i] ? +(oq[i] / mq[i] * 100).toFixed(1) : null), borderColor: palette[2], yAxisID: 'y1', pointRadius: 3 },
    ] }, options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: v => int(v) } }, y1: { position: 'right', grid: { display: false }, ticks: { callback: v => v + ' %' } } } } });
    // production charts
    if (prodCharts && document.getElementById('cProd')) {
      const dStart = Math.max(1, elapsed - CFG.ROUND_DAYS + 1); const dAx = Array.from({ length: Math.max(elapsed - dStart + 1, 1) }, (_, i) => dStart + i);
      const pcs = [...new Set(rows('Production').map(r => code(r.MATERIAL_NUMBER)))].sort();
      mk2('cProd', { data: { labels: dAx.map(d => `D${d}`), datasets: [
        ...pcs.map(c => ({ type: 'bar', label: name(c), backgroundColor: color(c), stack: 'y', data: dAx.map(d => prodCharts.yieldDC[d + '|' + c] || 0) })),
        { type: 'line', label: 'Capacity', data: dAx.map(() => CFG.CAPACITY), borderColor: css('--bad'), borderDash: [5, 4], pointRadius: 0 },
      ] }, options: { maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: v => int(v) } } }, plugins: { legend: { labels: { boxWidth: 10 } } } } });
      const invR = rows('Inventory').filter(r => /^F/.test(code(r.MATERIAL_NUMBER)));
      const ic = [...new Set(invR.map(r => code(r.MATERIAL_NUMBER)))].sort().filter(c => invR.some(r => code(r.MATERIAL_NUMBER) === c && n(r.INVENTORY_OPENING_BALANCE) > 0));
      const idays = [...new Set(invR.map(r => n(r.SIM_ELAPSED_STEPS)))].sort((a, b) => a - b);
      mk2('cInv', { type: 'line', data: { labels: idays.map(d => `D${d}`), datasets: ic.map(c => ({ label: name(c), borderColor: color(c), backgroundColor: color(c), pointRadius: 0, tension: .2,
        data: idays.map(d => invR.filter(r => n(r.SIM_ELAPSED_STEPS) === d && code(r.MATERIAL_NUMBER) === c).reduce((a, r) => a + n(r.INVENTORY_OPENING_BALANCE), 0)) })) },
        options: { maintainAspectRatio: false, scales: { y: { ticks: { callback: v => int(v) } } }, plugins: { legend: { labels: { boxWidth: 10 } } } } });
    }
  }


  // ---------- loop ----------
  let lastData = null;
  function setStatus(cls, text) {
    document.getElementById('erpsim-dot').className = 'dot ' + cls;
    document.getElementById('erpsim-status').textContent = text;
  }
  async function tick() {
    clearTimeout(window.__erpsimTimer);
    setStatus('busy', 'updating…');
    try {
      const D = LIVE ? await fetchLive() : await fetchLocal();
      lastData = D;
      render(D);
      document.getElementById('erpsim-banner').innerHTML = D._stale ? '<div class="banner">data.js could not be reloaded – showing the previous snapshot. Is refresh_data.py running?</div>' : '';
      setStatus(D._stale ? 'err' : 'ok', (D._stale ? 'stale snapshot · ' : 'updated ') + new Date().toLocaleTimeString('en-GB'));
    } catch (e) {
      setStatus('err', 'update failed');
      document.getElementById('erpsim-banner').innerHTML = `<div class="banner">${String(e.message || e)}${lastData ? ' – showing last data.' : ''}</div>`;
      if (!lastData) document.getElementById('erpsim-app').innerHTML = `<div class="card empty">${LIVE ? 'Could not load OData. Are you logged in to SAP in this browser?' : 'No <code>data.js</code> found. Run <code>python3 refresh_data.py --loop 20</code> in the outputs folder.'}</div>`;
    }
    const sec = Number(document.getElementById('erpsim-int').value);
    if (sec) window.__erpsimTimer = setTimeout(tick, sec * 1000);
  }

  async function boot() {
    ensureShell();
    const sel = document.getElementById('erpsim-int');
    sel.value = store.get('erpsim_int') || '20';
    sel.onchange = () => { store.set('erpsim_int', sel.value); tick(); };
    document.getElementById('erpsim-now').onclick = tick;
    document.getElementById('erpsim-dc').onchange = e => { dcChoice = e.target.value; store.set('erpsim_dc', dcChoice); if (lastData) render(lastData); };
    const vSel = document.getElementById('erpsim-var'), cIn = document.getElementById('erpsim-cap'), sIn = document.getElementById('erpsim-setup');
    vSel.value = SETTINGS.variant; cIn.value = CFG.CAPACITY; sIn.value = CFG.SETUP_H;
    const saveCfg = () => { store.set('erpsim_cfg', JSON.stringify(SETTINGS)); applySettings(); if (lastData) render(lastData); };
    vSel.onchange = () => { SETTINGS.variant = vSel.value; SETTINGS.capacity = VARIANT_CAP[vSel.value]; cIn.value = SETTINGS.capacity; saveCfg(); };
    cIn.onchange = () => { SETTINGS.capacity = Number(cIn.value); saveCfg(); };
    sIn.onchange = () => { SETTINGS.setupH = Number(sIn.value); saveCfg(); };
    const rIn = document.getElementById('erpsim-recipe'), nIn = document.getElementById('erpsim-rounds');
    rIn.value = recipeText(); nIn.value = CFG.ROUNDS;
    rIn.onchange = () => { SETTINGS.recipes = rIn.value; saveCfg(); rIn.value = recipeText(); };
    nIn.onchange = () => { SETTINGS.rounds = nIn.value; saveCfg(); };
    const stIn = document.getElementById('erpsim-start'); stIn.value = SETTINGS.start;
    stIn.onchange = () => { SETTINGS.start = (stIn.value.toUpperCase().match(/F\d\d/g) || []).filter(c => ALL_FG.includes(c)).join(','); stIn.value = SETTINGS.start; saveCfg(); };
    vSel.addEventListener('change', () => { if (!SETTINGS.rounds) nIn.value = CFG.ROUNDS; });
    // copy-to-clipboard buttons (data-copy holds the text)
    document.addEventListener('click', e => { const b = e.target.closest('[data-copy]'); if (!b) return;
      const done = ok => { const t = b.textContent; b.textContent = ok ? 'Copied ✓' : 'Copy failed'; setTimeout(() => b.textContent = t, 1200); };
      (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.reject()).then(() => done(true), () => {
        const ta = document.createElement('textarea'); ta.value = b.dataset.copy; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) {} ta.remove(); done(ok); }); });
    const t = store.get('erpsim_theme'); if (t) document.documentElement.dataset.theme = t;
    document.getElementById('erpsim-theme').onclick = () => {
      const dark = matchMedia('(prefers-color-scheme: dark)').matches;
      const cur = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
      document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
      store.set('erpsim_theme', document.documentElement.dataset.theme);
      if (lastData) render(lastData);
    };
    if (!window.Chart) await loadScript(CHART_JS).catch(() => {});
    tick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();