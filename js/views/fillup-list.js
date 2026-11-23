// nvBenz — Fill-up list view (full history with edit)

import { getFillups, getVehicles, getSetting, getFuelTypes, saveFillup as saveFillupDb, deleteFillup } from '../db.js';
import { formatDistance, formatVolume, formatCost } from '../model.js';
import { iconChevronLeft, iconPencil, iconChevronRight } from '../icons.js';
import { navigate, showToast } from '../router.js';

// Same ordering as the fill-up screen: diesel variants first, then petrol
function fuelPriority(name) {
  const n = (name || '').toLowerCase();
  if (n === 'diesel') return 0;
  if (n === 'diesel+') return 1;
  if (n === 'hvo') return 2;
  if (n === 'unleaded 95') return 3;
  if (n === 'unleaded 98') return 4;
  return 99;
}

export async function renderFillupList(vehicleId) {
  // Note: view visibility is handled by the caller (home.js directly shows #view-more)
  const container = document.getElementById('view-more');
  const vehicles = await getVehicles();
  const activeVehicle = vehicles.find((v) => String(v.id) === String(vehicleId));
  const units = await getSetting('units', 'metric');
  const currency = await getSetting('currency', 'EUR');
  const fillups = await getFillups(vehicleId);

  const vehicleName = activeVehicle ? activeVehicle.name : 'Vehicle';

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
      <h1>${escapeHtml(vehicleName)}</h1>
    </div>

    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px">
      ${fillups.length} fill-up${fillups.length !== 1 ? 's' : ''}
    </p>

    <div id="fillup-list" class="list"></div>
  `;

  renderList(fillups, units, currency);
}

function renderList(fillups, units, currency) {
  const listEl = document.getElementById('fillup-list');
  if (!listEl) return;

  if (fillups.length === 0) {
    listEl.innerHTML = '<div class="empty" style="padding:40px 24px"><p>No fill-ups yet.</p></div>';
    return;
  }

  // Most recent first
  const sorted = [...fillups].sort((a, b) => new Date(b.date) - new Date(a.date));

  listEl.innerHTML = sorted.map((f) => {
    const date = f.date.slice(0, 10).replace(/-/g, '/');
    return `
      <div class="list-row fillup-row" data-id="${f.id}">
        <div class="main">
          <div class="title">${escapeHtml(date)}</div>
          <div class="subtitle">${formatVolume(parseFloat(f.liters), units)} &bull; ${formatCost(parseFloat(f.cost), currency)} &bull; ${f.full ? 'Full' : 'Partial'}${f.fuelType ? ' &bull; ' + escapeHtml(f.fuelType) : ''}</div>
        </div>
        <div class="trailing">${iconChevronRight(16)}</div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.fillup-row').forEach((row) => {
    row.addEventListener('click', () => {
      const id = parseInt(row.dataset.id, 10);
      openFillupEditModal(id);
    });
  });
}

function openFillupEditModal(fillupId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };

  const content = document.createElement('div');
  content.className = 'modal modal-form';
  content.innerHTML = `
    <h2>Edit fill-up</h2>
    <div class="modal-scroll">
      <div id="fillup-edit-content" style="font-size:13px; color:var(--text-secondary); margin-bottom:16px;">Loading...</div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button class="btn-danger" id="btn-delete-fillup" onclick="deleteFillupModal(${fillupId})">Delete</button>
      <button class="btn-primary" id="btn-save-fillup-edit" onclick="saveFillupEditModal(${fillupId})">Save</button>
    </div>
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);

  // Load fillup data into the same form as the fill-up screen
  loadFillupEditForm(fillupId, modal);
}

async function loadFillupEditForm(fillupId, modal) {
  const fillups = await getFillups(null); // get all, then find
  const f = fillups.find((x) => x.id === fillupId);
  if (!f) {
    document.getElementById('fillup-edit-content').textContent = 'Fill-up not found.';
    return;
  }

  // Parse a numeric string that may use comma or dot as decimal separator
  const parseDecimal = (str) => {
    if (str === '' || str === null || str === undefined) return 0;
    const v = parseFloat(String(str).replace(',', '.'));
    return isNaN(v) ? 0 : v;
  };

  const contentEl = document.getElementById('fillup-edit-content');
  // Convert "yyyy-MM-dd" to "yyyy-MM-ddThh:mm" format required by datetime-local
  const dateForInput = (dateStr) => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) return dateStr.slice(0, 16);
    return dateStr.slice(0, 10) + 'T00:00';
  };

  // Fuel type dropdown: catalogue ordered, current value always selectable
  const fuelTypes = await getFuelTypes();
  const ordered = [...fuelTypes].sort((a, b) => {
    const pa = fuelPriority(a.name);
    const pb = fuelPriority(b.name);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
  const currentFuel = f.fuelType || 'Unspecified';
  let fuelSelect = '<select id="edit-fuel-type">';
  if (!ordered.some((ft) => ft.name === currentFuel) && currentFuel !== 'Unspecified') {
    fuelSelect += `<option value="${escapeHtml(currentFuel)}" selected>${escapeHtml(currentFuel)}</option>`;
  }
  for (const ft of ordered) {
    fuelSelect += `<option value="${escapeHtml(ft.name)}" ${ft.name === currentFuel ? 'selected' : ''}>${escapeHtml(ft.name)}</option>`;
  }
  if (!ordered.some((ft) => ft.name === 'Unspecified')) {
    fuelSelect += `<option value="Unspecified" ${currentFuel === 'Unspecified' ? 'selected' : ''}>Unspecified</option>`;
  }
  fuelSelect += '</select>';

  contentEl.innerHTML = `
    <div class="form-group">
      <label>Date &amp; time</label>
      <input type="datetime-local" id="edit-date" value="${escapeHtml(dateForInput(f.date))}">
    </div>
    <div class="form-group">
      <label>Odometer (km)</label>
      <input type="text" id="edit-odo" class="big-input" value="${escapeHtml(f.odo)}" placeholder="0" inputmode="decimal" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Fuel type</label>
      ${fuelSelect}
    </div>
    <div class="form-group">
      <label>Price per liter (€/l)</label>
      <input type="text" id="edit-ppl" class="big-input placeholder-muted" value="${escapeHtml((parseFloat(f.cost) / parseFloat(f.liters || 1)).toFixed(2))}" placeholder="0.00" inputmode="decimal" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Total paid (€)</label>
      <input type="text" id="edit-total" class="big-input placeholder-muted" value="${escapeHtml(parseFloat(f.cost).toFixed(2))}" placeholder="0.00" inputmode="decimal" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Liters (calculated)</label>
      <input type="text" id="edit-liters" class="big-input" readonly style="background:var(--bg-tertiary); color:var(--text-secondary);">
    </div>
    <div class="toggle-row">
      <input type="checkbox" id="edit-full" ${f.full === true || f.full === 1 || f.full === '1' ? 'checked' : ''}>
      <label for="edit-full">Full tank</label>
    </div>
    <div class="form-group">
      <label>Notes / station</label>
      <input type="text" id="edit-notes" value="${escapeHtml(f.notes || '')}" placeholder="e.g. Eni station">
    </div>
  `;

  // Wire up liters calculation
  const el = (id) => document.getElementById(id);
  const updateLiters = () => {
    const ppl = parseDecimal(el('edit-ppl').value);
    const tc = parseDecimal(el('edit-total').value);
    const litersEl = el('edit-liters');
    if (ppl > 0 && tc > 0) litersEl.value = (tc / ppl).toFixed(2);
    else litersEl.value = '';
  };
  el('edit-ppl').addEventListener('input', updateLiters);
  el('edit-total').addEventListener('input', updateLiters);
  updateLiters();

  window.deleteFillupModal = async (id) => {
    if (!confirm('Delete this fill-up? This cannot be undone.')) return;
    await deleteFillup(id);
    showToast('Fill-up deleted', 'success');
    document.body.removeChild(modal);
    renderFillupList(f.vehicleId);
  };

  window.saveFillupEditModal = async (id) => {
    const odo = parseDecimal(el('edit-odo').value);
    const ppl = parseDecimal(el('edit-ppl').value);
    const totalCost = parseDecimal(el('edit-total').value);
    if (!odo || odo <= 0 || !ppl || ppl <= 0 || !totalCost || totalCost <= 0) {
      showToast('Please fill in all numeric fields', 'error');
      return;
    }
    const liters = (totalCost / ppl).toFixed(2);
    try {
      await saveFillupDb({
        id,
        // Preserve fields the edit form does not touch — IndexedDB put()
        // replaces the whole record, so omitting vehicleId would orphan it.
        vehicleId: f.vehicleId,
        lat: f.lat,
        lng: f.lng,
        date: el('edit-date').value,
        odo: odo.toString(),
        liters,
        // Store clean 2-decimal values — Fuelio sources carry float noise
        // like 119.00999999999999
        cost: totalCost.toFixed(2),
        full: el('edit-full').checked,
        fuelType: el('edit-fuel-type').value || 'Unspecified',
        notes: el('edit-notes').value || ''
      });
      showToast('Fill-up updated', 'success');
      document.body.removeChild(modal);
      renderFillupList(f.vehicleId);
    } catch (err) {
      showToast('Failed to save', 'error');
    }
  };
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
