// nvBenz — Home view

import { getVehicles, getFillups, getSetting, setSetting, setActiveVehicleId, getVehicleWithMostRecentFillup } from '../db.js';
import { getStats, formatConsumption, consumptionLabel, formatDistance, formatVolume, formatCost } from '../model.js';
import { iconForKind, iconChevronRight, iconCheck, iconDarkMode, iconLightMode } from '../icons.js';

let statsChart = null;

export async function renderHome() {
  const container = document.getElementById('view-home');
  const vehicles = await getVehicles();

  if (!vehicles || vehicles.length === 0) {
    container.innerHTML = `
      <div class="header" style="position:static; border-bottom:none; margin-bottom:24px; padding-top:0;">
        <h1>nvBenz</h1>
      </div>
      <div class="empty">
        <span class="illustration">${iconForKind('car', 56)}</span>
        <p>No vehicles yet.</p>
        <p style="font-size:13px; margin-top:8px">Add your first vehicle in <b>Vehicles</b>, then log a fill-up.</p>
      </div>
    `;
    return;
  }

  // Determine active vehicle: stored preference, or most recent fillup, or first
  let activeId = await getSetting('activeVehicleId', null);
  let activeVehicle = vehicles.find((v) => String(v.id) === String(activeId));
  if (!activeVehicle) {
    activeVehicle = await getVehicleWithMostRecentFillup();
    if (activeVehicle) {
      activeId = activeVehicle.id;
      await setActiveVehicleId(activeId);
    }
  }
  if (!activeVehicle) activeVehicle = vehicles[0];

  const units = await getSetting('units', 'metric');
  const consumptionMode = await getSetting('consumptionMode', 'km/l');
  const currency = await getSetting('currency', 'EUR');

  const stats = await getStats(activeVehicle.id);

  const modeLabel = consumptionMode === 'l/100km' ? 'l/100km' : 'km/l';

  const html = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <div class="header-row" style="align-items:center; gap:10px;">
        <button class="vehicle-switcher" id="vehicle-switcher-btn" type="button" style="flex:1;">
          <span class="vehicle-switcher-icon">${iconForKind(activeVehicle.kind, 22)}</span>
          <span class="vehicle-switcher-text">
            <span class="vehicle-switcher-name">${escapeHtml(activeVehicle.name)}</span>
          </span>
          <span class="vehicle-switcher-chevron">${iconChevronRight(18)}</span>
        </button>
        <button class="icon-btn" id="theme-toggle-btn" title="Toggle theme"></button>
      </div>
    </div>

    <div class="card-grid">
      <div class="card">
        <div class="label">Avg consumption</div>
        <div class="value">${formatConsumption(stats.avgConsumptionKmL, consumptionMode)}</div>
        <div class="sub">${modeLabel} &bull; ${stats.totalFillups} fill-ups</div>
      </div>
      <div class="card">
        <div class="label">Total costs</div>
        <div class="value">${formatCost(Math.ceil(stats.totalCost), currency, 0)}</div>
        <div class="sub">${Math.ceil(stats.totalLiters)} l total</div>
      </div>
      <div class="card">
        <div class="label">Distance</div>
        <div class="value">${formatDistance(stats.distance, units)}</div>
      </div>
      <div class="card">
        <div class="label">Cost / km</div>
        <div class="value">${formatCost(stats.costPerKm, currency)}</div>
      </div>
    </div>

    <div class="section-title">Consumption &amp; costs</div>
    <div class="chart-wrap" style="min-height:120px; padding:12px;">
      <canvas id="home-consumption-chart" height="100"></canvas>
    </div>

    <div class="section-title">Recent fill-ups</div>
    <div id="home-recent-list" class="list"></div>
    <div style="margin-top:8px">
      <button class="btn-secondary" id="btn-view-all" style="width:100%">View All</button>
    </div>
  `;

  container.innerHTML = html;

  document.getElementById('vehicle-switcher-btn').addEventListener('click', () => openVehiclePickerModal(vehicles, activeVehicle.id));

  // Theme toggle: sun/moon icon, flips dark/light, persists, re-renders charts
  const themeBtn = document.getElementById('theme-toggle-btn');
  const currentTheme = await getSetting('theme', 'dark');
  themeBtn.innerHTML = currentTheme === 'dark' ? iconDarkMode(22) : iconLightMode(22);
  themeBtn.addEventListener('click', async () => {
    const newTheme = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    await setSetting('theme', newTheme);
    renderHome(); // re-render so charts pick up the new colors
  });
  document.getElementById('btn-view-all').addEventListener('click', () => {
    // Show #view-more directly WITHOUT calling router's navigate('more')
    // because navigate('more') triggers renderMore() which would overwrite
    // the fillup list we're about to render.
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    const moreView = document.getElementById('view-more');
    moreView.classList.remove('hidden');
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.view === 'more');
    });
    // Now render the fillup list into #view-more
    import('./fillup-list.js').then((m) => m.renderFillupList(activeVehicle.id));
  });

  // Render recent fill-ups (limit to 5), most recent first
  const recent = [...stats.intervals].reverse().slice(0, 5);
  const listEl = document.getElementById('home-recent-list');
  if (recent.length === 0) {
    listEl.innerHTML = '<div class="list-row"><div class="main"><div class="title">No fill-ups yet</div><div class="subtitle">Log your first refueling</div></div></div>';
  } else {
    // Map fill-up id -> fuel type so each interval can report its fuel(s)
    const allFillups = await getFillups(activeVehicle.id);
    const fuelById = new Map(allFillups.map((f) => [String(f.id), f.fuelType || '']));
    listEl.innerHTML = recent.map((i) => {
      const date = i.endDate.slice(0, 10);
      const kmL = i.consumption > 0 ? i.consumption.toFixed(1) : '—';
      const fuels = [...new Set((i.fillupIds || []).map((id) => fuelById.get(String(id))).filter(Boolean))];
      const fuelLabel = fuels.length ? ` &bull; ${escapeHtml(fuels.join(' + '))}` : '';
      return `
        <div class="list-row">
          <div class="main">
            <div class="title">${escapeHtml(date)}</div>
            <div class="subtitle">${formatDistance(i.distance, units)} &bull; ${formatVolume(i.liters, units)} &bull; ${formatCost(i.cost, currency)}${fuelLabel}</div>
          </div>
          <div class="trailing">${kmL} ${modeLabel}</div>
        </div>
      `;
    }).join('');
  }

  // Draw dual-axis consumption+price chart (last 6 months by date)
  setTimeout(() => {
    if (statsChart) { statsChart.destroy(); statsChart = null; }
    import('../charts.js').then((c) => {
      const sixMonths = getLastSixMonths(stats.consumptionOverTime);
      statsChart = c.consumptionPriceChart('home-consumption-chart', sixMonths, consumptionMode);
    });
  }, 50);
}

// Return intervals from the last 6 months (chronological), not just last 6 entries
function getLastSixMonths(intervals) {
  if (!intervals || intervals.length === 0) return [];
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  return intervals.filter((i) => new Date(i.date) >= sixMonthsAgo);
}

function openVehiclePickerModal(vehicles, activeId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

  const itemsHtml = vehicles.map((v) => {
    const isActive = String(v.id) === String(activeId);
    return `
      <div class="picker-row ${isActive ? 'is-active' : ''}" data-id="${v.id}">
        <span class="picker-row-icon">${iconForKind(v.kind, 24)}</span>
        <span class="picker-row-text">
          <span class="picker-row-name">${escapeHtml(v.name)}</span>
        </span>
        ${isActive ? `<span class="picker-row-check">${iconCheck(18)}</span>` : ''}
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="modal picker-modal">
      <h2>Select vehicle</h2>
      <div class="picker-list">${itemsHtml}</div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll('.picker-row').forEach((row) => {
    row.addEventListener('click', async () => {
      await setActiveVehicleId(row.dataset.id);
      document.body.removeChild(modal);
      renderHome();
    });
  });
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
