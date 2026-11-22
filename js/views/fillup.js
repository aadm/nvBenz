// nvBenz — Fill-up entry (one-handed optimized)
//
// Input model:
//   pricePerLiter = how much 1 liter costs (€/l)
//   totalCost     = total euros paid
//   liters        = derived: totalCost / pricePerLiter (auto-calculated)

import { getFuelTypes, getFillups, saveFillup as saveFillupDb, getSetting, setActiveVehicleId, getVehicleWithMostRecentFillup } from '../db.js';
import { iconChevronLeft } from '../icons.js';
import { showToast } from '../router.js';

let state = {
  vehicleId: null,
  date: '',
  odo: '',
  pricePerLiter: '',   // €/l
  totalCost: '',       // € total paid
  liters: '',          // derived
  fuelType: '',
  full: true,
  notes: ''
};

let fuelTypes = [];

export async function renderFillup() {
  const container = document.getElementById('view-fillup');
  fuelTypes = await getFuelTypes();

  // Order fuel types: diesel, diesel+, hvo first, then unleaded 95, 98, then rest
  const ordered = [...fuelTypes].sort((a, b) => {
    const pa = fuelPriority(a.name);
    const pb = fuelPriority(b.name);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  // Use active vehicle, or default to most recent fillup vehicle
  let activeId = await getSetting('activeVehicleId', null);
  let activeVehicle = null;
  if (activeId) {
    const vehicles = await (await import('../db.js')).getVehicles();
    activeVehicle = vehicles.find((v) => String(v.id) === String(activeId));
  }
  if (!activeVehicle) {
    activeVehicle = await getVehicleWithMostRecentFillup();
    if (activeVehicle) {
      await setActiveVehicleId(activeVehicle.id);
      activeId = activeVehicle.id;
    }
  }
  state.vehicleId = activeVehicle ? activeVehicle.id : null;

  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISO = new Date(now - tzOffset).toISOString().slice(0, 16);
  state.date = localISO;

  let suggestedOdo = '';
  if (state.vehicleId) {
    const vFillups = await getFillups(state.vehicleId);
    const last = vFillups[vFillups.length - 1];
    if (last) suggestedOdo = (parseFloat(last.odo) || 0).toFixed(0);
  }
  state.odo = suggestedOdo;
  state.pricePerLiter = '';
  state.totalCost = '';
  state.liters = '';
  state.fuelType = ordered.length ? ordered[0].name : '';
  state.full = true;
  state.notes = '';

  render(container, ordered);
}

function fuelPriority(name) {
  const n = name.toLowerCase();
  if (n === 'diesel') return 0;
  if (n === 'diesel+') return 1;
  if (n === 'hvo') return 2;
  if (n === 'unleaded 95') return 3;
  if (n === 'unleaded 98') return 4;
  return 99;
}

function render(container, ordered) {
  const vehicle = state.vehicleId ? null : null; // resolved below
  const currency = '€'; // default EUR

  let fuelSelect = '<select id="fu-fuel-type">';
  for (const ft of ordered) {
    fuelSelect += `<option value="${escapeHtml(ft.name)}" ${ft.name === state.fuelType ? 'selected' : ''}>${escapeHtml(ft.name)}</option>`;
  }
  fuelSelect += '</select>';

  const fullChecked = state.full ? 'checked' : '';

  // Derive liters preview
  const ppl = parseFloat(state.pricePerLiter);
  const tc = parseFloat(state.totalCost);
  let litersPreview = '';
  if (ppl > 0 && tc > 0) {
    litersPreview = (tc / ppl).toFixed(2);
  }

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
      <h1>New fill-up</h1>
    </div>

    <form id="fu-form">
      <div class="form-group">
        <label>Date &amp; time</label>
        <input type="datetime-local" id="fu-date" value="${escapeHtml(state.date)}">
      </div>

      <div class="form-group">
        <label>Odometer (km)</label>
        <input type="number" id="fu-odo" class="big-input" value="${escapeHtml(state.odo)}" placeholder="0" inputmode="decimal" step="any">
      </div>

      <div class="form-group">
        <label>Fuel type</label>
        ${fuelSelect}
      </div>

      <div class="input-pair">
        <div class="form-group half">
          <label>Price per liter (€/l)</label>
          <input type="number" id="fu-ppl" class="big-input placeholder-muted" value="${escapeHtml(state.pricePerLiter)}" placeholder="0.00" inputmode="decimal" step="any">
        </div>
        <div class="form-group half">
          <label>Total paid (€)</label>
          <input type="number" id="fu-total" class="big-input placeholder-muted" value="${escapeHtml(state.totalCost)}" placeholder="0.00" inputmode="decimal" step="any">
        </div>
      </div>

      <div class="form-group">
        <label>Liters (calculated)</label>
        <input type="number" id="fu-liters" class="big-input" value="${escapeHtml(litersPreview)}" readonly style="background:var(--bg-tertiary); color:var(--text-secondary);">
      </div>

      <div class="toggle-row">
        <input type="checkbox" id="fu-full" ${fullChecked} onchange="app.toggleFull()">
        <label for="fu-full">Full tank</label>
      </div>

      <div class="form-group">
        <label>Notes / station</label>
        <input type="text" id="fu-notes" value="${escapeHtml(state.notes)}" placeholder="e.g. Eni station">
      </div>

      <button type="submit" class="btn-primary" id="fu-save">Save fill-up</button>
    </form>
  `;

  const el = (id) => document.getElementById(id);
  el('fu-date').addEventListener('input', (e) => { state.date = e.target.value; });
  el('fu-odo').addEventListener('input', (e) => { state.odo = e.target.value; });
  el('fu-fuel-type').addEventListener('change', (e) => { state.fuelType = e.target.value; });
  el('fu-ppl').addEventListener('input', (e) => {
    state.pricePerLiter = e.target.value;
    const ppl = parseFloat(state.pricePerLiter);
    const tc = parseFloat(state.totalCost);
    const litersEl = el('fu-liters');
    if (ppl > 0 && tc > 0) litersEl.value = (tc / ppl).toFixed(2);
    else litersEl.value = '';
  });
  el('fu-total').addEventListener('input', (e) => {
    state.totalCost = e.target.value;
    const ppl = parseFloat(state.pricePerLiter);
    const tc = parseFloat(state.totalCost);
    const litersEl = el('fu-liters');
    if (ppl > 0 && tc > 0) litersEl.value = (tc / ppl).toFixed(2);
    else litersEl.value = '';
  });
  el('fu-notes').addEventListener('input', (e) => { state.notes = e.target.value; });

  el('fu-form').addEventListener('submit', (e) => {
    e.preventDefault();
    app.saveFillup();
  });
}

export function setVehicleId(id) { state.vehicleId = id; render(document.getElementById('view-fillup'), []); }

export function toggleFull() { state.full = !state.full; }

export async function newFuelType() {
  const name = prompt('New fuel type name (e.g. HVO, Diesel+):');
  if (!name || !name.trim()) return;
  import('../db.js').then((db) => db.saveFuelType({ name: name.trim(), active: true }))
    .then(() => {
      fuelTypes.push({ name: name.trim(), active: true });
      render(document.getElementById('view-fillup'), fuelTypes);
    });
}

export async function saveFillup() {
  if (!state.vehicleId) {
    showToast('No vehicle selected. Add one in Vehicles first.', 'error');
    return;
  }
  const odo = parseFloat(state.odo);
  const ppl = parseFloat(state.pricePerLiter);
  const totalCost = parseFloat(state.totalCost);

  if (!odo || odo <= 0) {
    showToast('Enter odometer', 'error');
    return;
  }
  if (!ppl || ppl <= 0) {
    showToast('Enter price per liter', 'error');
    return;
  }
  if (!totalCost || totalCost <= 0) {
    showToast('Enter total paid', 'error');
    return;
  }

  const liters = (totalCost / ppl).toFixed(2);

  const fillup = {
    vehicleId: state.vehicleId,
    date: state.date || new Date().toISOString().slice(0, 16),
    odo: odo.toString(),
    liters: liters,
    cost: totalCost.toString(),
    full: state.full,
    fuelType: state.fuelType || 'Unspecified',
    notes: state.notes || ''
  };

  try {
    await saveFillupDb(fillup);
    showToast('Fill-up saved', 'success');
    // Reset inputs for next entry, keep vehicle & odo
    state.pricePerLiter = '';
    state.totalCost = '';
    state.liters = '';
    state.notes = '';
    render(document.getElementById('view-fillup'), fuelTypes);
  } catch (err) {
    console.error(err);
    showToast('Failed to save', 'error');
  }
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
