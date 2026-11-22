// nvBenz — Settings view

import { getSetting, setSetting, getFuelTypes } from '../db.js';
import { iconChevronLeft } from '../icons.js';
import { showToast } from '../router.js';

export async function renderSettings() {
  const container = document.getElementById('view-more');
  const units = await getSetting('units', 'metric');
  const consumptionMode = await getSetting('consumptionMode', 'km/l');
  const currency = await getSetting('currency', 'EUR');
  const theme = await getSetting('theme', 'dark');
  const githubPat = await getSetting('githubPat', '');
  const githubGistId = await getSetting('githubGistId', '');

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:16px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
      <h1>Settings</h1>
    </div>

    <div class="setting-row">
      <span class="label">Units</span>
      <select id="setting-units" style="min-height:44px">
        <option value="metric" ${units === 'metric' ? 'selected' : ''}>Metric (km, liters)</option>
        <option value="imperial" ${units === 'imperial' ? 'selected' : ''}>Imperial (mi, gal)</option>
      </select>
    </div>
    <div class="setting-row">
      <span class="label">Consumption</span>
      <select id="setting-consumption" style="min-height:44px">
        <option value="km/l" ${consumptionMode === 'km/l' ? 'selected' : ''}>km/l</option>
        <option value="l/100km" ${consumptionMode === 'l/100km' ? 'selected' : ''}>l/100 km</option>
      </select>
    </div>
    <div class="setting-row">
      <span class="label">Currency</span>
      <select id="setting-currency" style="min-height:44px">
        <option value="EUR" ${currency === 'EUR' ? 'selected' : ''}>Euro (€)</option>
        <option value="USD" ${currency === 'USD' ? 'selected' : ''}>US Dollar ($)</option>
        <option value="GBP" ${currency === 'GBP' ? 'selected' : ''}>British Pound (£)</option>
        <option value="CHF" ${currency === 'CHF' ? 'selected' : ''}>Swiss Franc (CHF)</option>
      </select>
    </div>
    <div class="setting-row">
      <span class="label">Theme</span>
      <select id="setting-theme" style="min-height:44px">
        <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
        <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
      </select>
    </div>

    <div class="section-title" style="margin-top:24px">GitHub export (gist)</div>
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
      <button class="btn-secondary" id="btn-save-settings" style="width:100%">Save settings</button>
    </div>
    <div class="form-group" style="margin-bottom:4px">
      <button class="btn-secondary" id="btn-export-gist" style="width:100%">Export to GitHub gist</button>
    </div>

    <div class="section-title" style="margin-top:24px">Fuel types</div>
    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px">Manage fuel type catalogue.</p>
    <div id="fuel-types-list"></div>
    <div class="form-group" style="margin-bottom:4px">
      <button class="btn-secondary" id="btn-add-fuel-type" style="width:100%">+ Add fuel type</button>
    </div>
  `;

  document.getElementById('setting-units').addEventListener('change', (e) => setSetting('units', e.target.value));
  document.getElementById('setting-consumption').addEventListener('change', (e) => setSetting('consumptionMode', e.target.value));
  document.getElementById('setting-currency').addEventListener('change', (e) => setSetting('currency', e.target.value));
  document.getElementById('setting-theme').addEventListener('change', (e) => {
    setSetting('theme', e.target.value);
    document.documentElement.setAttribute('data-theme', e.target.value);
  });
  document.getElementById('setting-pat').addEventListener('change', (e) => setSetting('githubPat', e.target.value));
  document.getElementById('btn-save-settings').addEventListener('click', () => {
    setSetting('githubPat', document.getElementById('setting-pat').value);
    showToast('Settings saved', 'success');
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
       <div class="main"><div class="title">${escapeHtml(ft.name)}</div><div class="subtitle">${ft.active ? 'active' : 'inactive'}</div></div>
       <div class="trailing">${ft.id}</div>
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
