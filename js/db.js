// nvBenz database layer — IndexedDB backed, promise-based.
// Tables: vehicles, fuel_types, fillups, settings

import { idbGet, idbSet, idbDel, idbGetAll, idbClear } from '../idb.js';

const DEFAULTS = {
  units: 'metric',            // metric | imperial
  consumptionMode: 'km/l',    // km/l | l/100km
  currency: 'EUR',            // entry currency for the fill-up form
  currencyFactor: 1,          // entry currency units per 1 EUR (storage is EUR)
  theme: 'dark',
  githubPat: '',
  githubGistId: '',
  lastOdometer: {}            // vehicleId -> last odometer (stored as JSON string)
};

// ---------- settings ----------

export async function getSetting(key, fallback) {
  const row = await idbGet('settings', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export async function setSetting(key, value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  await idbSet('settings', { id: key, key, value: serialized, updatedAt: Date.now() });
}

// ---------- vehicles ----------

export async function getVehicles() {
  return idbGetAll('vehicles');
}

export async function getVehicle(id) {
  return idbGet('vehicles', id);
}

export async function saveVehicle(vehicle) {
  vehicle.updatedAt = Date.now();
  if (!vehicle.createdAt) vehicle.createdAt = Date.now();
  return idbSet('vehicles', vehicle);
}

export async function deleteVehicle(id) {
  return idbDel('vehicles', id);
}

// ---------- fuel types ----------

export async function getFuelTypes() {
  const list = await idbGetAll('fuel_types');
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveFuelType(fuelType) {
  fuelType.updatedAt = Date.now();
  if (!fuelType.createdAt) fuelType.createdAt = Date.now();
  return idbSet('fuel_types', fuelType);
}

export async function deleteFuelType(id) {
  return idbDel('fuel_types', id);
}

export async function seedDefaultFuelTypes() {
  const existing = await idbGetAll('fuel_types');
  if (existing.length > 0) return existing;
  const defaults = [
    { name: 'Diesel', active: true },
    { name: 'Diesel+', active: true },
    { name: 'HVO', active: true },
    { name: 'Unleaded 95', active: true },
    { name: 'Unleaded 98', active: true }
  ];
  for (const ft of defaults) await saveFuelType(ft);
  return idbGetAll('fuel_types');
}

// ---------- fillups ----------

export async function getFillups(vehicleId) {
  const all = await idbGetAll('fillups');
  const list = vehicleId ? all.filter((f) => String(f.vehicleId) === String(vehicleId)) : all;
  return list.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return da - db;
  });
}

export async function getFillup(id) {
  return idbGet('fillups', id);
}

export async function saveFillup(fillup) {
  fillup.updatedAt = Date.now();
  if (!fillup.createdAt) fillup.createdAt = Date.now();
  return idbSet('fillups', fillup);
}

export async function deleteFillup(id) {
  return idbDel('fillups', id);
}

// ---------- initialization ----------

export async function initDb() {
  // Ensure default fuel types exist
  await seedDefaultFuelTypes();

  // Ensure settings have defaults
  for (const [key, value] of Object.entries(DEFAULTS)) {
    const existing = await idbGet('settings', key);
    if (!existing) {
      await setSetting(key, value);
    }
  }

  // Seed a demo vehicle if database is empty (helps first-time users)
  const vehicles = await idbGetAll('vehicles');
  if (vehicles.length === 0) {
    await saveVehicle({
      name: 'My Car',
      make: '',
      model: '',
      year: '',
      plate: '',
      kind: 'car',
      tankCapacity: null,
      defaultFuelTypeId: null,
      active: true
    });
  }
}

// ---------- active vehicle ----------

export async function getActiveVehicleId() {
  return getSetting('activeVehicleId', null);
}

export async function setActiveVehicleId(id) {
  // Normalize to number when possible, since <select> values arrive as strings
  // but IndexedDB autoIncrement keys are numbers.
  const normalizedId = isNaN(Number(id)) ? id : Number(id);
  await setSetting('activeVehicleId', normalizedId);
  // Also update the active flag on vehicles
  const all = await idbGetAll('vehicles');
  for (const v of all) {
    const isMatch = String(v.id) === String(normalizedId);
    if (isMatch && !v.active) {
      v.active = true;
      await idbSet('vehicles', v);
    } else if (!isMatch && v.active) {
      v.active = false;
      await idbSet('vehicles', v);
    }
  }
}

export async function getVehicleWithMostRecentFillup() {
  const vehicles = await idbGetAll('vehicles');
  if (vehicles.length === 0) return null;
  let best = null;
  let bestDate = 0;
  for (const v of vehicles) {
    const fillups = await idbGetAll('fillups');
    const vFillups = fillups.filter((f) => f.vehicleId === v.id);
    if (vFillups.length === 0) continue;
    const latest = vFillups.reduce((max, f) => {
      const d = new Date(f.date).getTime();
      return d > max.d ? { d, f } : max;
    }, { d: 0, f: null });
    if (latest.d > bestDate) {
      bestDate = latest.d;
      best = v;
    }
  }
  return best || vehicles[0];
}
