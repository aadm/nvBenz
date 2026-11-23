// nvBenz — Settings view

import { getSetting, setSetting, getFuelTypes } from '../db.js';
import { iconChevronLeft } from '../icons.js';
import { showToast } from '../router.js';

// Sane fallback conversion factors (units of currency per 1 EUR).
// Overwritten on the fly from frankfurter.app (ECB reference rates)
// whenever a non-EUR currency is selected and a connection is available.
const DEFAULT_FACTORS = { USD: 1.05, GBP: 0.85, CHF: 0.94 };

function parseDecimalFactor(str) {
  const v = parseFloat(String(str).replace(',', '.'));
  return isNaN(v) || v <= 0 ? 0 : v;
}

// Best-effort live rate from frankfurter.app (ECB data, CORS-enabled).
// Resolves with the live rate, or null when offline / on error.
async function fetchLiveFactor(currency) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${currency}`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const data = await resp.json();
    const rate = data && data.rates && data.rates[currency];
    return rate && rate > 0 ? parseFloat(rate.toFixed(4)) : null;
  } catch (e) {
    return null; // offline or blocked — caller falls back to the default
  }
}

export async function renderSettings() {
  const container = document.getElementById('view-more');
  const consumptionMode = await getSetting('consumptionMode', 'km/l');
  const currency = await getSetting('currency', 'EUR');
  const storedFactor = await getSetting('currencyFactor', null);
  const githubPat = await getSetting('githubPat', '');
  const githubGistId = await getSetting('githubGistId', '');

  const modeOptions = [
    { label: 'km/l', value: 'km/l' },
    { label: 'l/100km', value: 'l/100km' }
  ];
  const currencyOptions = [
    { label: '€ EUR', value: 'EUR' },
    { label: '$ USD', value: 'USD' },
    { label: '£ GBP', value: 'GBP' },
    { label: 'CHF', value: 'CHF' }
  ];

  // Factor shown for the currently selected non-EUR currency
  const currentFactor = storedFactor || DEFAULT_FACTORS[currency] || 1;
  const isNonEur = currency !== 'EUR';

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goMore()">${iconChevronLeft(24)}</button>
      <h1>Settings</h1>
    </div>

    <div class="setting-block">
      <div class="setting-name">Consumption</div>
      <div class="segmented" id="seg-consumption">
        ${modeOptions.map(o => `
          <button class="seg-btn ${consumptionMode === o.value ? 'is-active' : ''}" data-value="${o.value}">${o.label}</button>
        `).join('')}
      </div>
    </div>

    <div class="setting-block">
      <div class="setting-name">Currency (fill-up entry)</div>
      <div class="segmented" id="seg-currency">
        ${currencyOptions.map(o => `
          <button class="seg-btn ${currency === o.value ? 'is-active' : ''}" data-value="${o.value}">${o.label}</button>
        `).join('')}
      </div>
      <div id="factor-block" style="${isNonEur ? '' : 'display:none;'} margin-top:12px;">
        <div class="form-group" style="margin-bottom:0;">
          <label>1 EUR = <span id="factor-cur">${escapeHtml(currency)}</span></label>
          <input type="text" id="setting-factor" inputmode="decimal" value="${currentFactor}" autocomplete="off">
        </div>
        <p style="font-size:11px; color:var(--text-secondary); margin-top:8px; line-height:1.5">
          Amounts entered on the fill-up form are converted to EUR with this factor
          and always stored in euros.
        </p>
      </div>
    </div>

    <div class="section-title" style="margin-top:28px">GitHub export (gist)</div>
    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px">
      Export your data to a GitHub secret gist. Create a Personal Access Token with <code>gist</code> scope at
      <a href="https://github.com/settings/tokens" target="_blank" style="color:var(--accent)">github.com/settings/tokens</a>.
    </p>
    <div class="form-group" style="margin-bottom:12px">
      <label>GitHub Personal Access Token</label>
      <form onsubmit="return false" style="margin:0">
        <input type="password" id="setting-pat" value="${escapeHtml(githubPat)}" placeholder="ghp_..." autocomplete="off">
      </form>
    </div>
    <div class="setting-row">
      <span class="label">Gist ID</span>
      <span class="value" style="font-family:monospace; font-size:12px">${escapeHtml(githubGistId) || '(none — create on first export)'}</span>
    </div>
    <div class="form-group" style="margin-bottom:4px">
      <button class="btn-secondary" id="btn-save-settings" style="width:100%">Save token</button>
    </div>
    <div class="form-group" style="margin-bottom:4px">
      <button class="btn-secondary" id="btn-export-gist" style="width:100%">Export to GitHub gist</button>
    </div>

    <div class="section-title" style="margin-top:28px">Fuel types</div>
    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px">Manage fuel type catalogue.</p>
    <div id="fuel-types-list"></div>
    <div class="form-group" style="margin-bottom:4px">
      <button class="btn-secondary" id="btn-add-fuel-type" style="width:100%">+ Add fuel type</button>
    </div>
  `;

  // Segmented controls: tap to switch, no native <select>
  const segConsumption = document.getElementById('seg-consumption');
  segConsumption.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      segConsumption.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      await setSetting('consumptionMode', btn.dataset.value);
      showToast('Consumption unit saved', 'success');
    });
  });

  const segCurrency = document.getElementById('seg-currency');
  const factorBlock = document.getElementById('factor-block');
  const factorInput = document.getElementById('setting-factor');
  const factorCurLabel = document.getElementById('factor-cur');

  // Apply a factor to the input + settings, with a small toast note
  const applyFactor = (factor, note) => {
    factorInput.value = factor;
    setSetting('currencyFactor', factor);
    if (note) showToast(note, 'success');
  };

  segCurrency.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cur = btn.dataset.value;
      segCurrency.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      await setSetting('currency', cur);

      if (cur === 'EUR') {
        // Euro needs no conversion — hide the factor block, reset factor
        factorBlock.style.display = 'none';
        await setSetting('currencyFactor', 1);
      } else {
        // Show the factor block, label it with the currency
        factorBlock.style.display = '';
        factorCurLabel.textContent = cur;
        // Best-effort live rate; fall back to the hardcoded default offline
        const live = await fetchLiveFactor(cur);
        const factor = live || DEFAULT_FACTORS[cur] || 1;
        applyFactor(factor, live ? 'Live ECB rate loaded' : 'Using default rate (offline)');
      }
      showToast('Currency saved', 'success');
    });
  });

  // Manual edits to the factor are persisted on change
  factorInput.addEventListener('change', () => {
    const f = parseDecimalFactor(factorInput.value);
    if (f > 0) {
      setSetting('currencyFactor', f);
      showToast('Conversion factor saved', 'success');
    } else {
      showToast('Enter a positive number', 'error');
    }
  });

  document.getElementById('setting-pat').addEventListener('change', (e) => setSetting('githubPat', e.target.value));
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    setSetting('githubPat', document.getElementById('setting-pat').value);
    showToast('Token saved', 'success');
  });
  document.getElementById('btn-export-gist').addEventListener('click', exportToGist);
  document.getElementById('btn-add-fuel-type').addEventListener('click', addFuelType);

  renderFuelTypesList();
}

async function renderFuelTypesList() {
  const fuelTypes = await getFuelTypes();
  const el = document.getElementById('fuel-types-list');
  if (!el) return;
  if (fuelTypes.length === 0) {
    el.innerHTML = '<p style="font-size:13px; color:var(--text-secondary)">No fuel types.</p>';
    return;
  }
  el.innerHTML = fuelTypes.map((ft) =>
    `<div class="list-row" style="cursor:default">
       <div class="main"><div class="title">${escapeHtml(ft.name)}</div></div>
     </div>`
  ).join('');
}

async function addFuelType() {
  const name = prompt('Fuel type name (e.g. HVO, Diesel+):');
  if (!name || !name.trim()) return;
  import('../db.js').then((db) => db.saveFuelType({ name: name.trim(), active: true }))
    .then(() => { showToast('Fuel type added', 'success'); renderFuelTypesList(); });
}

async function exportToGist() {
  const { exportFillupsToGist } = await import('../github.js');
  try {
    await exportFillupsToGist();
    showToast('Gist exported', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gist export failed: ' + err.message, 'error');
  }
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
