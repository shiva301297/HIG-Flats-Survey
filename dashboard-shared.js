// ══════════════════════════════════════════════════════════════════
//  HIG Flats — Shared Dashboard Logic
//  Used by both dashboard.html (public) and admin.html (admin)
//  IS_ADMIN and APPS_SCRIPT_URL must be defined before this file loads
// ══════════════════════════════════════════════════════════════════

const BLOCKS  = 'ABCDEFGHIJKLMNOPQRSTUVW'.split('');
const BAR_COLOR  = '#4a6fa5';
const BAR_HOVER  = '#3a5a8a';
const PALETTE    = ['#e07b39','#2a7f6f','#1c2b3a','#f5a96a','#4a8c5c','#e74c3c','#3498db','#9b59b6','#f39c12','#1abc9c'];

Chart.defaults.font.family = "'Nunito', sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.plugins.legend.position       = 'bottom';
Chart.defaults.plugins.legend.labels.padding = 12;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.register(ChartDataLabels);

// ── Chart helpers ──────────────────────────────────────────────────
function makeDoughnut(id, labels, values) {
  const total = values.reduce((a, b) => a + b, 0);
  new Chart(document.getElementById(id), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '55%',
      plugins: {
        datalabels: {
          display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
          formatter: (v) => `${v}\n(${Math.round(v / total * 100)}%)`,
          color: '#fff', font: { weight: '700', size: 10 }, textAlign: 'center'
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / total * 100)}%)` } }
      }
    }
  });
}

function makeBar(id, labels, values, horizontal = false) {
  const total = values.reduce((a, b) => a + b, 0);
  new Chart(document.getElementById(id), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: BAR_COLOR, hoverBackgroundColor: BAR_HOVER, borderRadius: 4, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
        datalabels: {
          display: true, anchor: 'end', align: 'end',
          formatter: v => v > 0 ? `${v} (${Math.round(v / total * 100)}%)` : '',
          font: { weight: '700', size: 11 }, color: '#1c2b3a'
        }
      },
      scales: {
        x: horizontal
          ? { display: false, grid: { display: false }, ticks: { display: false }, border: { display: false } }
          : { display: true, grid: { display: false }, ticks: { display: true, maxRotation: 30 }, border: { display: false } },
        y: horizontal
          ? { display: true, grid: { display: false }, ticks: { display: true, padding: 4 }, border: { display: false } }
          : { display: false, grid: { display: false }, ticks: { display: false }, border: { display: false } }
      },
      layout: { padding: { top: horizontal ? 0 : 24, right: horizontal ? 72 : 0 } }
    }
  });
}

// ── Data helpers ───────────────────────────────────────────────────
function countField(rows, field) {
  const counts = {};
  rows.forEach(r => {
    const v = String(r[field] ?? '—').trim();
    if (v && v !== '—') counts[v] = (counts[v] || 0) + 1;
  });
  return counts;
}

function countMulti(rows, field) {
  const counts = {};
  rows.forEach(r => {
    String(r[field] ?? '').split(',').map(s => s.trim()).filter(Boolean)
      .forEach(v => { if (v !== '—') counts[v] = (counts[v] || 0) + 1; });
  });
  return counts;
}

// ── Treemap renderer using D3 ──────────────────────────────────────
function buildTreemap(containerId, counts, total, labelMap, colorPalette) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = ''; // clear

  const entries = Object.entries(counts)
    .filter(([,v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">No data yet</p>';
    return;
  }

  // Build D3 hierarchy
  const root = d3.hierarchy({ children: entries.map(([key, val]) => ({ key, val })) })
    .sum(d => d.val)
    .sort((a, b) => b.value - a.value);

  // Responsive width
  const W = container.clientWidth || 600;
  const H = Math.max(220, Math.min(320, W * 0.5));
  container.style.height = H + 'px';
  container.style.position = 'relative';

  d3.treemap().size([W, H]).padding(3).round(true)(root);

  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H)
    .style('display', 'block');

  const cell = svg.selectAll('g')
    .data(root.leaves())
    .enter().append('g')
    .attr('transform', d => `translate(${d.x0},${d.y0})`);

  cell.append('rect')
    .attr('width', d => Math.max(0, d.x1 - d.x0))
    .attr('height', d => Math.max(0, d.y1 - d.y0))
    .attr('rx', 5).attr('ry', 5)
    .attr('fill', (d, i) => colorPalette[i % colorPalette.length])
    .attr('opacity', 0.88)
    .on('mouseover', function() { d3.select(this).attr('opacity', 1); })
    .on('mouseout',  function() { d3.select(this).attr('opacity', 0.88); });

  cell.append('text')
    .attr('x', 7).attr('y', 16)
    .style('font-size', d => {
      const w = d.x1 - d.x0;
      return w < 80 ? '9px' : w < 130 ? '10px' : '11px';
    })
    .style('font-weight', '700')
    .style('fill', 'white')
    .style('pointer-events', 'none')
    .text(d => {
      const w = d.x1 - d.x0;
      const label = labelMap[d.data.key] || d.data.key;
      return w < 50 ? '' : label;
    });

  cell.append('text')
    .attr('x', 7).attr('y', d => {
      const h = d.y1 - d.y0;
      return h > 32 ? 30 : 28;
    })
    .style('font-size', '10px')
    .style('fill', 'rgba(255,255,255,0.85)')
    .style('pointer-events', 'none')
    .text(d => {
      const w = d.x1 - d.x0;
      const h = d.y1 - d.y0;
      if (w < 50 || h < 28) return '';
      const pct = total > 0 ? Math.round(d.data.val / total * 100) : 0;
      return `${d.data.val} (${pct}%)`;
    });

  // Tooltip on title
  cell.append('title')
    .text(d => {
      const label = labelMap[d.data.key] || d.data.key;
      const pct = total > 0 ? Math.round(d.data.val / total * 100) : 0;
      return `${label}: ${d.data.val} owners (${pct}%)`;
    });
}

function buildBlockGrid(respondedFlats) {
  const grid = document.getElementById('blockGrid');
  BLOCKS.forEach(block => {
    const unit = document.createElement('div');
    unit.className = 'block-unit';
    unit.innerHTML = `<div class="block-label">Block ${block}</div><div class="flat-dots" id="dots-${block}"></div>`;
    grid.appendChild(unit);
    const dotsWrap = document.getElementById(`dots-${block}`);
    for (let f = 1; f <= 6; f++) {
      const flatId = `${block}-${f}`;
      const isDone = respondedFlats.has(flatId);
      const dot = document.createElement('div');
      dot.className = `flat-dot ${isDone ? 'done' : 'pending'}`;
      dot.textContent = f;
      dot.title = `${flatId}${isDone ? ' ✓ Responded' : ' — Pending'}`;
      dotsWrap.appendChild(dot);
    }
  });
}

function buildStats(rows) {
  const total = 138;
  const responded = rows.length;
  const pending = total - responded;
  const pct = Math.round(responded / total * 100);
  const supportVals = rows.map(r => parseFloat(String(r['Q15 — Redevelopment Support (1–5)'] ?? ''))).filter(v => !isNaN(v));
  const avgSupport = supportVals.length > 0 ? (supportVals.reduce((a, b) => a + b, 0) / supportVals.length).toFixed(1) : '—';
  document.getElementById('statRow').innerHTML = `
    <div class="stat-card highlight"><div class="sv">${responded}</div><div class="sl">Responses Received</div><div class="sp">${pct}% of 138 flats</div></div>
    <div class="stat-card"><div class="sv">${pending}</div><div class="sl">Responses Pending</div><div class="sp">${100 - pct}% remaining</div></div>
    <div class="stat-card"><div class="sv">${pct}%</div><div class="sl">Completion Rate</div><div class="sp">Target: 100%</div></div>
    <div class="stat-card"><div class="sv">${avgSupport}</div><div class="sl">Avg Support Score</div><div class="sp">Scale of 1–5</div></div>`;
  const supportScore = document.getElementById('supportScore');
  if (supportScore) { supportScore.textContent = avgSupport; }
  const supportBar = document.getElementById('supportBar');
  if (supportBar) { supportBar.style.width = avgSupport !== '—' ? (parseFloat(avgSupport) / 5 * 100) + '%' : '0%'; }
}

// ── Timeline normaliser ────────────────────────────────────────────
function normaliseTimeline(raw) {
  const s = String(raw ?? '').trim();
  const map = { 'LT2YR': '<2', '2TO3YR': '2-3', '3TO4YR': '3-4', 'GT4YR': '>4' };
  if (map[s]) return map[s];
  if (['<2', '>4', '2-3', '3-4'].includes(s)) return s;
  return '—';
}

// ── Main render ────────────────────────────────────────────────────
function renderAll(data) {
  const rows = data.rows || [];
  const n    = rows.length;
  const total    = 138;
  const responded = n;
  const pct80    = Math.round(responded / total * 100);

  const respondedFlats = new Set(rows.map(r => String(r['Flat ID'] ?? '').trim().toUpperCase()));

  buildStats(rows);
  buildBlockGrid(respondedFlats);

  // ── 80% gate: public shows locked, admin always shows charts ──
  const showCharts = IS_ADMIN || pct80 >= 80;

  if (!IS_ADMIN) {
    // Update public locked placeholder
    const remaining80 = Math.max(0, Math.ceil(total * 0.8) - responded);
    const lockLabel = document.getElementById('lockPctLabel');
    const lockBar   = document.getElementById('lockBarFill');
    const lockRem   = document.getElementById('lockRemaining');
    if (lockLabel) lockLabel.textContent = pct80 + '%';
    if (lockBar)   lockBar.style.width = Math.min(pct80 / 80 * 100, 100) + '%';
    if (lockRem)   lockRem.textContent = remaining80;

    document.getElementById('allChartsLocked').style.display = showCharts ? 'none' : 'block';
    document.getElementById('allCharts').style.display        = showCharts ? 'block' : 'none';
  }

  if (!showCharts) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('dashContent').style.display   = 'block';
    document.getElementById('lastRefresh').textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-IN');
    return; // stop here for public view below 80%
  }

  const cnt  = f => countField(rows, f);
  const cntM = f => countMulti(rows, f);

  // Parking averages
  const carMap = { '0': 0, '1': 1, '2': 2, '3': 3 };
  const totalCar  = rows.reduce((s, r) => s + (carMap[String(r['Q5 — Car Parking Slots']  ?? '').trim()] || 0), 0);
  const totalBike = rows.reduce((s, r) => s + (carMap[String(r['Q5 — Bike Parking Slots'] ?? '').trim()] || 0), 0);
  const avgCar  = n > 0 ? (totalCar  / n).toFixed(2) : '—';
  const avgBike = n > 0 ? (totalBike / n).toFixed(2) : '—';
  document.getElementById('parkingTotals').innerHTML = `
    <div class="parking-card"><div class="pv">${avgCar}</div><div class="pl">Avg Car Slots per Flat</div></div>
    <div class="parking-card"><div class="pv">${avgBike}</div><div class="pl">Avg Bike Slots per Flat</div></div>`;

  // Intent
  const intentOrder  = ['reside','rent','sell','undecided'];
  const intentLabels = { reside:'Self-Occupy', rent:'Rent Out', sell:'Sell', undecided:'Undecided' };
  const ic = cnt('Q1 — Post-Redevelopment Utilisation');
  makeBar('chartIntent', intentOrder.map(k => intentLabels[k]), intentOrder.map(k => ic[k] || 0), true);

  // Purpose
  const purpOrder  = ['residential','commercial','office'];
  const purpLabels = { residential:'Residential', commercial:'Commercial', office:'Office / Professional' };
  const pc = cnt('Q2 — Flat Purpose');
  makeBar('chartPurpose', purpOrder.map(k => purpLabels[k]), purpOrder.map(k => pc[k] || 0), true);

  // Sqft
  const sqftOrder  = ['1000-1200','1200-1500','1500-1800','1800-2200','2200-2500','>2500'];
  const sqftLabels = { '1000-1200':'1000–1200','1200-1500':'1200–1500','1500-1800':'1500–1800','1800-2200':'1800–2200','2200-2500':'2200–2500','>2500':'2500+' };
  const sc = cnt('Q3 — Preferred Sq.Ft.');
  makeBar('chartSqft', sqftOrder.map(k => sqftLabels[k]), sqftOrder.map(k => sc[k] || 0));

  // BHK
  const bhkOrder  = ['2bhk','3bhk','4bhk'];
  const bhkLabels = { '2bhk':'2 BHK', '3bhk':'3 BHK', '4bhk':'4 BHK' };
  const bc = cnt('Q4 — BHK Preference');
  makeBar('chartBhk', bhkOrder.map(k => bhkLabels[k]), bhkOrder.map(k => bc[k] || 0));

  // Correlation
  const corrMatrix = {};
  sqftOrder.forEach(s => { corrMatrix[s] = { 2: 0, 3: 0, 4: 0 }; });
  rows.forEach(r => {
    const s = String(r['Q3 — Preferred Sq.Ft.'] ?? '').trim();
    const b = String(r['Q4 — BHK Preference']   ?? '').trim();
    const bnum = b === '2bhk' ? 2 : b === '3bhk' ? 3 : b === '4bhk' ? 4 : null;
    if (corrMatrix[s] && bnum) corrMatrix[s][bnum]++;
  });
  new Chart(document.getElementById('chartCorrelation'), {
    type: 'bar',
    data: {
      labels: sqftOrder.map(k => sqftLabels[k]),
      datasets: [
        { label: '2 BHK', data: sqftOrder.map(s => corrMatrix[s][2]), backgroundColor: '#4a6fa5', borderRadius: 4 },
        { label: '3 BHK', data: sqftOrder.map(s => corrMatrix[s][3]), backgroundColor: '#2a7f6f', borderRadius: 4 },
        { label: '4 BHK', data: sqftOrder.map(s => corrMatrix[s][4]), backgroundColor: '#1c2b3a', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        datalabels: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw} owners` } }
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { display: false }, border: { display: false }, title: { display: true, text: 'No. of Owners' } }
      },
      layout: { padding: { top: 10 } }
    }
  });

  // Insights
  const insightsList = document.getElementById('insightsList');
  const topSqft    = sqftOrder.reduce((a, b) => (sc[a] || 0) >= (sc[b] || 0) ? a : b);
  const topSqftPct = n > 0 ? Math.round((sc[topSqft] || 0) / n * 100) : 0;
  const topBhk     = bhkOrder.reduce((a, b) => (bc[a] || 0) >= (bc[b] || 0) ? a : b);
  const topBhkPct  = n > 0 ? Math.round((bc[topBhk] || 0) / n * 100) : 0;
  [
    `🏆 Most preferred area band: <strong>${sqftLabels[topSqft]} sq.ft.</strong> — chosen by ${topSqftPct}% of responding owners.`,
    `🛏️ Most preferred BHK: <strong>${bhkLabels[topBhk]}</strong> — selected by ${topBhkPct}% of owners.`
  ].forEach(text => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;background:var(--teal-light);border-radius:6px;border-left:3px solid var(--teal)';
    div.innerHTML = text;
    insightsList.appendChild(div);
  });

  // Greenery
  const gc = cnt('Q6 — Greenery Preference');
  const greenLabels = { yes_priority:'Priority (even if area ↓)', yes_balance:'Balanced', neutral:'Neutral', no:'Maximise Build' };
  makeDoughnut('chartGreen', Object.keys(gc).map(k => greenLabels[k] || k), Object.values(gc));

  // Height
  const hc = cnt('Q9 — Building Height');
  const heightOrder  = ['g+4','g+7','g+12','norm'];
  const heightLabels = { 'g+4':'G+4 Low-rise','g+7':'G+7 Mid-rise','g+12':'G+12–15 High-rise','norm':'Per CMDA Norms' };
  makeBar('chartHeight', heightOrder.map(k => heightLabels[k]), heightOrder.map(k => hc[k] || 0), true);

  // Physical infra — teal-blue palette
  const physMap = { covered_parking:'Covered Car Parking',ev_charging:'EV Charging',visitor_parking:'Visitor Parking',cycle_stand:'Cycle Stand',solar:'Solar Panels',rwh:'Rainwater Harvesting',stp:'STP & Grey Water',solid_waste:'Solid Waste Mgmt',dg_backup:'DG Backup',cctv:'24×7 CCTV',intercom:'Video Door Phone',access_ctrl:'Boom Barrier',fire_sys:'Fire Detection' };
  const physPalette = ['#1c4e6e','#1a6b8a','#1e82a3','#2498bb','#2aadd0','#32bfe0','#1d6b5c','#207a69','#238b78','#279c88'];
  buildTreemap('physicalBars', cntM('Q7 — Physical Infrastructure'), n, physMap, physPalette);

  // Social infra — warm saffron-amber palette
  const socialMap = { gym:'Gymnasium',jogging:'Jogging Track',yoga:'Yoga / Meditation',swimming:'Swimming Pool',clubhouse:'Community Hall',temple:'Temple / Prayer Room',library:'Mini Library',cowork:'Co-working Space',play_area:"Children's Play Area",senior_zone:'Senior Citizen Area',daycare:'Crèche / Day-care' };
  const socialPalette = ['#7b3500','#9a4400','#b85300','#d46212','#e07b39','#e99060','#c45c00','#a84e00','#8c4000','#d4780a'];
  buildTreemap('socialBars', cntM('Q8 — Social Infrastructure'), n, socialMap, socialPalette);

  // Members
  const mc = cnt('Q10 — New Members Willing to Add');
  const memLabels = { none:'No New Members','2per':'2 per Block (~46)','4per':'4 per Block (~92)',sqft:'By Sq.Ft. Vote' };
  makeDoughnut('chartMembers', Object.keys(mc).map(k => memLabels[k] || k), Object.values(mc));

  // Rent allowance
  const rc = cnt('Q12 — Min. Rent Allowance (₹)');
  const rentOrder  = ['<20k','20-30k','30-50k','>50k'];
  const rentLabels = { '<20k':'< ₹20K','20-30k':'₹20–30K','30-50k':'₹30–50K','>50k':'> ₹50K' };
  makeBar('chartRent', rentOrder.map(k => rentLabels[k]), rentOrder.map(k => rc[k] || 0));

  // Developer
  const dc = cntM('Q13 — Developer Criteria (up to 2)');
  const devOrder  = ['track','area','finance','local','design'];
  const devLabels = { track:'Track Record',area:'Area Offered',finance:'Financial Strength',local:'Local Reputation',design:'Design Quality' };
  makeBar('chartDev', devOrder.map(k => devLabels[k] || k), devOrder.map(k => dc[k] || 0), true);

  // Timeline
  const tlc = {};
  const tlOrder  = ['<2','2-3','3-4','>4'];
  const tlLabels = { '<2':'< 2 yrs','2-3':'2–3 yrs','3-4':'3–4 yrs','>4':'4+ yrs' };
  rows.forEach(r => {
    const v = normaliseTimeline(r['Q14 — Acceptable Timeline']);
    if (v !== '—') tlc[v] = (tlc[v] || 0) + 1;
  });
  const tlTotal = tlOrder.map(k => tlc[k] || 0).reduce((a, b) => a + b, 0);
  new Chart(document.getElementById('chartTimeline'), {
    type: 'bar',
    data: {
      labels: tlOrder.map(k => tlLabels[k]),
      datasets: [{ data: tlOrder.map(k => tlc[k] || 0), backgroundColor: BAR_COLOR, hoverBackgroundColor: BAR_HOVER, borderRadius: 4, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          display: true, anchor: 'end', align: 'top',
          formatter: v => v > 0 ? `${v} (${Math.round(v / tlTotal * 100)}%)` : '',
          font: { weight: '700', size: 11 }, color: '#1c2b3a'
        }
      },
      scales: {
        x: { type: 'category', grid: { display: false } },
        y: { display: false, ticks: { display: false }, border: { display: false } }
      },
      layout: { padding: { top: 28 } }
    }
  });

  // Support
  const supDist = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  rows.forEach(r => {
    const v = String(r['Q15 — Redevelopment Support (1–5)'] ?? '').trim();
    if (supDist[v] !== undefined) supDist[v]++;
  });
  makeBar('chartSupport',
    [['1','Strongly Against'],['2','Against'],['3','Neutral'],['4','Support'],['5','Strongly Support']],
    [supDist['1'],supDist['2'],supDist['3'],supDist['4'],supDist['5']]);

  // Show dashboard
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('dashContent').style.display   = 'block';
  document.getElementById('lastRefresh').textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-IN');
}

// ── Fetch (public dashboard auto-loads; admin loads after PIN) ──────
if (typeof IS_ADMIN !== 'undefined' && !IS_ADMIN) {
  fetch(APPS_SCRIPT_URL + '?action=getDashboard')
    .then(r => r.json())
    .then(data => {
      try {
        renderAll(data);
      } catch(renderErr) {
        console.error('Render error:', renderErr);
        document.getElementById('loadingScreen').innerHTML =
          `<p style="color:#e74c3c;font-size:14px">⚠️ Dashboard render error.<br/><small>${renderErr.message}</small></p>`;
      }
    })
    .catch(err => {
      document.getElementById('loadingScreen').innerHTML =
        `<p style="color:#e74c3c;font-size:14px">⚠️ Could not load dashboard data.<br/>Please ensure the Apps Script is deployed and accessible.<br/><br/><small>${err.message}</small></p>`;
    });
}
