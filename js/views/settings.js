// nvBenz — Settings view

import { getSetting, setSetting, getFuelTypes } from '../db.js';
import { iconChevronLeft } from '../icons.js';
import { showToast } from '../router.js';

export async function renderSettings() {
  const container = document.getElementById('view-more');
  const consumptionMode = await getSetting('consumptionMode', 'km/l');
  const currency = await getSetting('currency', 'EUR');
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

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
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
      <div class="setting-name">Currency</div>
      <div class="segmented" id="seg-currency">
        ${currencyOptions.map(o => `
          <button class="seg-btn ${currency === o.value ? 'is-active' : ''}" data-value="${o.value}">${o.label}</button>
        `).join('')}
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
  segCurrency.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      segCurrency.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('is-active', b === btn));
      await setSetting('currency', btn.dataset.value);
      showToast('Currency saved', 'success');
    });
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
