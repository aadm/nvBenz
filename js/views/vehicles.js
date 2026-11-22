// nvBenz — Vehicles view

import { getVehicles, saveVehicle, deleteVehicle, setActiveVehicleId, getActiveVehicleId, getFuelTypes } from '../db.js';
import { showToast, navigate } from '../router.js';
import { iconPlus, iconChart, iconForKind, iconChevronRight, iconChevronLeft, iconCheck, iconPencil } from '../icons.js';

export async function renderVehicles() {
  const container = document.getElementById('view-vehicles');

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
      <h1>Vehicles</h1>
      <button class="icon-btn icon-btn-accent" onclick="app.editVehicle(null)" title="Add vehicle">${iconPlus(20)}</button>
    </div>

    <p style="font-size:13px; color:var(--text-secondary); margin-bottom:16px">
      Tap a vehicle to select it as active. Use the chart icon for its detailed stats, or the pencil to edit.
    </p>

    <div id="vehicles-list" class="list"></div>
  `;

  renderList();
}

async function renderList() {
  const vehicles = await getVehicles();
  const activeId = await getActiveVehicleId();
  const listEl = document.getElementById('vehicles-list');
  if (vehicles.length === 0) {
    listEl.innerHTML = `<div class="empty" style="padding:40px 24px"><span class="illustration">${iconForKind('car', 48)}</span><p>No vehicles</p></div>`;
    return;
  }

  listEl.innerHTML = vehicles.map((v) => {
    const isActive = String(v.id) === String(activeId);
    const makeModel = [v.make, v.model].filter(Boolean).join(' ').trim();
    return `
      <div class="list-row vehicle-row ${isActive ? 'is-active' : ''}" data-id="${v.id}">
        <span class="vehicle-row-icon">${iconForKind(v.kind, 20)}</span>
        <div class="main" data-action="select">
          <div class="title">${escapeHtml(v.name)} ${isActive ? '<span class="active-badge">Active</span>' : ''}</div>
          <div class="subtitle">
            ${escapeHtml(makeModel)} ${v.year ? '(' + escapeHtml(v.year) + ')' : ''}
            ${v.plate ? ' &bull; ' + escapeHtml(v.plate) : ''}
          </div>
        </div>
        <button class="row-icon-btn" data-action="stats" title="View stats">${iconChart(20)}</button>
        <button class="row-icon-btn" data-action="edit" title="Edit vehicle">${iconPencil()}</button>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.vehicle-row').forEach((row) => {
    const id = row.dataset.id;
    row.querySelector('[data-action="select"]').addEventListener('click', async () => {
      await setActiveVehicleId(id);
      showToast('Active vehicle updated', 'success');
      renderList();
    });
    row.querySelector('[data-action="stats"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      await setActiveVehicleId(id);
      navigate('stats');
    });
    row.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
      e.stopPropagation();
      editVehicle(parseInt(id, 10) || id);
    });
  });
}

// ---------- actions exposed to app.js ----------

export async function editVehicle(id) {
  const vehicles = await getVehicles();
  const v = id ? vehicles.find((x) => String(x.id) === String(id)) : null;
  const fuelTypes = await getFuelTypes();

  const name = v ? v.name : '';
  const make = v ? v.make : '';
  const model = v ? v.model : '';
  const year = v ? v.year : '';
  const plate = v ? v.plate : '';
  const kind = v ? v.kind : 'car';
  const tankCapacity = v ? (v.tankCapacity || '') : '';
  const defaultFuelTypeId = v ? (v.defaultFuelTypeId || '') : '';

  const fuelSelect = fuelTypes.map((ft) =>
    `<option value="${ft.id}" ${ft.id == defaultFuelTypeId ? 'selected' : ''}>${escapeHtml(ft.name)}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  modal.innerHTML = `
    <div class="modal modal-form">
      <h2>${id ? 'Edit vehicle' : 'Add vehicle'}</h2>
      <div class="modal-scroll">
        <form id="veh-form">
          <div class="form-group">
            <label>Nickname *</label>
            <input type="text" id="veh-name" value="${escapeHtml(name)}" placeholder="e.g. Daily driver, Weekend bike" required>
            <p style="font-size:12px; color:var(--text-secondary); margin-top:6px;">
              Short name used to quickly switch vehicles. Make + model are shown separately.
            </p>
          </div>
          <div class="form-group">
            <label>Make</label>
            <input type="text" id="veh-make" value="${escapeHtml(make)}">
          </div>
          <div class="form-group">
            <label>Model</label>
            <input type="text" id="veh-model" value="${escapeHtml(model)}">
          </div>
          <div class="form-group">
            <label>Year</label>
            <input type="number" id="veh-year" value="${escapeHtml(year)}">
          </div>
          <div class="form-group">
            <label>Plate</label>
            <input type="text" id="veh-plate" value="${escapeHtml(plate)}">
          </div>
          <div class="form-group">
            <label>Kind</label>
            <select id="veh-kind">
              <option value="car" ${kind === 'car' ? 'selected' : ''}>Car</option>
              <option value="motorbike" ${kind === 'motorbike' ? 'selected' : ''}>Motorbike</option>
            </select>
          </div>
          <div class="form-group">
            <label>Tank capacity (liters)</label>
            <input type="number" id="veh-tank" value="${escapeHtml(tankCapacity)}" placeholder="optional">
          </div>
          <div class="form-group">
            <label>Default fuel type</label>
            <select id="veh-fueltype"><option value="">None</option>${fuelSelect}</select>
          </div>
        </form>
      </div>
      <div class="modal-actions">
        ${id ? '<button class="btn-danger" onclick="deleteVehicleModal(' + id + ')">Delete</button>' : ''}
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveVehicleModal()">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  window.closeModal = () => {
    document.body.removeChild(modal);
    delete window.closeModal;
    delete window.saveVehicleModal;
    delete window.deleteVehicleModal;
  };

  window.deleteVehicleModal = async (vid) => {
    if (!confirm('Delete this vehicle and all its fill-ups? This cannot be undone.')) return;
    await deleteVehicle(vid);
    showToast('Vehicle deleted', 'success');
    closeModal();
    renderVehicles();
  };

  window.saveVehicleModal = async () => {
    const el = (id) => document.getElementById(id);
    const nameVal = el('veh-name').value.trim();
    if (!nameVal) { showToast('Name is required', 'error'); return; }

    const vehicle = {
      name: nameVal,
      make: el('veh-make').value.trim(),
      model: el('veh-model').value.trim(),
      year: el('veh-year').value.trim(),
      plate: el('veh-plate').value.trim(),
      kind: el('veh-kind').value,
      tankCapacity: el('veh-tank').value ? parseFloat(el('veh-tank').value) : null,
      defaultFuelTypeId: el('veh-fueltype').value || null,
      active: v ? v.active : false
    };

    try {
      if (id) vehicle.id = id;
      const savedId = await saveVehicle(vehicle);
      // If this is the first vehicle ever, make it active automatically
      const all = await getVehicles();
      if (all.length === 1) {
        await setActiveVehicleId(id || savedId);
      }
      showToast(id ? 'Vehicle updated' : 'Vehicle added', 'success');
      closeModal();
      renderVehicles();
    } catch (err) {
      console.error(err);
      showToast('Failed to save vehicle', 'error');
    }
  };
}

export async function deleteVehicleAction(id) {
  if (!confirm('Delete this vehicle and all its fill-ups?')) return;
  try {
    await deleteVehicle(id);
    showToast('Vehicle deleted', 'success');
    renderVehicles();
  } catch (err) {
    showToast('Failed to delete', 'error');
  }
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
