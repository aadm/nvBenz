// nvBenz — Stats view

import { getSetting, setSetting, getActiveVehicleId, getVehicleWithMostRecentFillup, getVehicles, getFillups } from '../db.js';
import { computeIntervals, formatConsumption, consumptionLabel, formatDistance, formatCost, formatVolume } from '../model.js';
import { consumptionChart, priceChart, monthlyChart } from '../charts.js';
import { iconChevronLeft, iconChart } from '../icons.js';
import { showToast } from '../router.js';

const TIME_RANGES = [
  { label: 'All', key: 'all' },
  { label: 'This<br>mo', key: 'month' },
  { label: 'Last<br>mo', key: 'last-month' },
  { label: 'This<br>yr', key: 'year' },
  { label: '1yr<br>ago', key: '1year' },
  { label: '2yr<br>ago', key: '2years' }
];

export async function renderStats() {
  const container = document.getElementById('view-stats');
  const units = await getSetting('units', 'metric');
  const consumptionMode = await getSetting('consumptionMode', 'km/l');
  const currency = await getSetting('currency', 'EUR');

  let activeId = await getActiveVehicleId();
  let activeVehicle = null;
  if (activeId) {
    const vehicles = await getVehicles();
    activeVehicle = vehicles.find((v) => String(v.id) === String(activeId));
  }
  if (!activeVehicle) {
    activeVehicle = await getVehicleWithMostRecentFillup();
    if (activeVehicle) {
      await setSetting('activeVehicleId', activeVehicle.id);
      activeId = activeVehicle.id;
    }
  }

  if (!activeVehicle) {
    container.innerHTML = `
      <div class="header" style="position:static; border-bottom:none; margin-bottom:24px; padding-top:0;">
        <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
        <h1>Stats</h1>
      </div>
      <div class="empty">
        <span class="illustration">${iconChart(56)}</span>
        <p>No vehicle selected. Add a vehicle and log a fill-up first.</p>
      </div>
    `;
    return;
  }

  const selectedRange = await getSetting('statsTimeRange', 'all');
  const fillups = await getFillups(activeVehicle.id);
  const filtered = filterByTimeRange(fillups, selectedRange);
  const intervals = computeIntervals(filtered);
  const monthly = computeMonthly(filtered);
  const allMonthly = computeMonthly(fillups); // full year for monthly chart

  // Compute stats for the filtered (time-range) data
  const totalLiters = filtered.reduce((s, f) => s + (parseFloat(f.liters) || 0), 0);
  const totalCost = filtered.reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
  const totalFillups = filtered.length;
  const odos = filtered.map((f) => parseFloat(f.odo)).filter((o) => o > 0);
  const distance = odos.length > 0 ? Math.max(...odos) - Math.min(...odos) : 0;
  const costPerKm = distance > 0 ? totalCost / distance : 0;

  // Average consumption from closed intervals in the filtered data
  const totalIntervalDistance = intervals.reduce((s, i) => s + i.distance, 0);
  const totalIntervalLiters = intervals.reduce((s, i) => s + i.liters, 0);
  const avgConsumptionKmL = totalIntervalLiters > 0 && totalIntervalDistance > 0
    ? totalIntervalDistance / totalIntervalLiters : 0;

  const makeModel = [activeVehicle.make, activeVehicle.model].filter(Boolean).join(' ').trim();

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:4px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
      <h1>${escapeHtml(activeVehicle.name)}</h1>
    </div>
    ${makeModel ? `<p style="font-size:13px; color:var(--text-secondary); margin:0 0 16px 48px;">${escapeHtml(makeModel)}</p>` : '<div style="margin-bottom:16px"></div>'}

    <div class="section-title">Time range</div>
    <div class="time-range-picker" id="time-range-picker"></div>

    <div class="card-grid" id="stats-cards">
      <div class="card">
        <div class="label">Avg consumption</div>
        <div class="value">${formatConsumption(avgConsumptionKmL, consumptionMode)}</div>
        <div class="sub">${consumptionLabel(consumptionMode)} &bull; ${totalFillups} fill-ups</div>
      </div>
      <div class="card">
        <div class="label">Total spent</div>
        <div class="value">${formatCost(totalCost, currency)}</div>
        <div class="sub">${formatVolume(totalLiters, units)} total</div>
      </div>
      <div class="card">
        <div class="label">Distance</div>
        <div class="value">${formatDistance(distance, units)}</div>
      </div>
      <div class="card">
        <div class="label">Cost / km</div>
        <div class="value">${formatCost(costPerKm, currency)}</div>
      </div>
    </div>

    <div class="section-title">Consumption</div>
    <div class="chart-wrap" style="min-height:160px; padding:12px;">
      <canvas id="chart-consumption" height="140"></canvas>
    </div>

    <div class="section-title">Price per liter</div>
    <div class="chart-wrap" style="min-height:160px; padding:12px;">
      <canvas id="chart-price" height="140"></canvas>
    </div>

    <div class="section-title">Monthly cost &amp; liters (full year)</div>
    <div class="chart-wrap" style="min-height:180px; padding:12px;">
      <canvas id="chart-monthly" height="160"></canvas>
    </div>
  `;

  renderTimeRangePicker(selectedRange);

  // Determine if we should show data point markers (short periods)
  const isShortPeriod = ['month', 'last-month'].includes(selectedRange);

  // Build chart data from intervals
  const chartData = intervals.map((i) => ({
    date: i.endDate,
    kmL: i.consumption,
    l100: i.consumption > 0 ? 100 / i.consumption : 0,
    cost: i.cost,
    liters: i.liters
  }));

  setTimeout(() => {
    import('../charts.js').then((c) => {
      c.destroyChart('chart-consumption');
      c.destroyChart('chart-price');
      c.destroyChart('chart-monthly');

      c.consumptionChart('chart-consumption', chartData, consumptionMode, { showPoints: isShortPeriod });
      c.priceChart('chart-price', chartData, { showPoints: isShortPeriod });
      c.monthlyChart('chart-monthly', allMonthly);
    });
  }, 50);
}

function renderTimeRangePicker(selectedRange) {
  const container = document.getElementById('time-range-picker');
  if (!container) return;

  const html = TIME_RANGES.map((r) => {
    const active = r.key === selectedRange;
    return `<button class="time-range-btn ${active ? 'is-active' : ''}" data-range="${r.key}">${r.label}</button>`;
  }).join('');

  container.innerHTML = html;

  container.querySelectorAll('.time-range-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await setSetting('statsTimeRange', btn.dataset.range);
      renderStats();
    });
  });
}

function filterByTimeRange(fillups, range) {
  if (!fillups || fillups.length === 0) return fillups;
  const now = new Date();
  const sorted = [...fillups].sort((a, b) => new Date(a.date) - new Date(b.date));

  switch (range) {
    case 'all':
      return sorted;
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return sorted.filter((f) => new Date(f.date) >= start);
    }
    case 'last-month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return sorted.filter((f) => new Date(f.date) >= start && new Date(f.date) <= end);
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return sorted.filter((f) => new Date(f.date) >= start);
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1);
      return sorted.filter((f) => new Date(f.date) >= start && new Date(f.date) <= now);
    }
    case '1year': {
      // "1 yr ago": end = current month minus 1 year; include 12 months prior to that
      const end = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0); // last day of (current month - 1 year)
      const start = new Date(now.getFullYear() - 1, now.getMonth() - 11, 1); // first day, 12 months window
      return sorted.filter((f) => new Date(f.date) >= start && new Date(f.date) <= end);
    }
    case '2years': {
      // "2 yr ago": end = current month minus 2 years; include 12 months prior to that
      const end2 = new Date(now.getFullYear() - 2, now.getMonth() + 1, 0);
      const start2 = new Date(now.getFullYear() - 2, now.getMonth() - 11, 1);
      return sorted.filter((f) => new Date(f.date) >= start2 && new Date(f.date) <= end2);
    }
    default:
      return sorted;
  }
}

function computeMonthly(fillups) {
  const monthly = {};
  for (const f of fillups) {
    const d = new Date(f.date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!monthly[key]) monthly[key] = { liters: 0, cost: 0, count: 0 };
    monthly[key].liters += parseFloat(f.liters) || 0;
    monthly[key].cost += parseFloat(f.cost) || 0;
    monthly[key].count += 1;
  }
  return monthly;
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
