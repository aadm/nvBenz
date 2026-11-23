// nvBenz — Import / Export view

import {
  getVehicles, getFuelTypes, getFillups, getSetting, setSetting,
  saveVehicle, saveFuelType, saveFillup
} from '../db.js';
import { idbClear } from '../../idb.js';
import { normalizeFuelType } from '../model.js';
import { iconChevronLeft } from '../icons.js';
import { showToast } from '../router.js';

// Keep a running log of every import session so the user can review it later
let importLog = [];

export async function renderImportExport() {
  const container = document.getElementById('view-more');

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goMore()">${iconChevronLeft(24)}</button>
      <h1>Import / Export</h1>
    </div>

    <div class="section-title">Export your data</div>
    <p style="font-size:14px; color:var(--text-secondary); margin-bottom:12px">
      Download a CSV backup of vehicles, fuel types and fill-ups.
    </p>
    <button class="btn-secondary" id="btn-export-csv" style="width:100%">Export CSV</button>
    <button class="btn-secondary" id="btn-export-json" style="width:100%; margin-top:8px">Export JSON snapshot</button>

    <div class="section-title" style="margin-top:28px">Import Fuelio archive</div>
    <p style="font-size:14px; color:var(--text-secondary); margin-bottom:12px">
      Select the extracted <code>vehicle-*-local.csv</code> files from your Fuelio <code>.fuelio</code> zip —
      or any plain CSV with a fill-up log (date, odometer, liters, cost columns).<br>
    </p>
    <p style="font-size:12px; color:var(--text-secondary); margin-bottom:12px; background:var(--bg-tertiary); border-radius:var(--radius-sm); padding:10px 12px;">
      <b>Fuelio files:</b> only the <code>## Vehicle</code> section (name) and <code>## Log</code> section (fill-ups) are imported.<br>
      <b>Plain CSV:</b> needs at least Date, Odo/Odometer, Fuel/Liters, Price/Cost columns. GPS latitude/longitude
      columns are preserved if present.
    </p>
    <input type="file" id="fuelio-file" accept=".csv" multiple class="file-input">
    <div id="import-result" style="margin-top:12px; min-height:44px; font-size:14px;"></div>
    <button class="btn-secondary" id="btn-view-log" style="width:100%; margin-top:8px; display:none;">View full import log</button>

    <div class="section-title" style="margin-top:28px">Danger zone</div>
    <button class="btn-danger" id="btn-reset" style="width:100%">Reset all local data</button>
  `;

  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
  document.getElementById('btn-export-json').addEventListener('click', exportJson);
  document.getElementById('fuelio-file').addEventListener('change', handleFuelioImport);
  document.getElementById('btn-reset').addEventListener('click', resetData);
  document.getElementById('btn-view-log').addEventListener('click', showImportLogModal);

  if (importLog.length > 0) {
    document.getElementById('btn-view-log').style.display = 'block';
  }
}

function showImportLogModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
  const logHtml = importLog.map((entry) => {
    const color = entry.level === 'error' ? 'var(--danger)' : entry.level === 'warning' ? 'var(--warning)' : 'var(--text-secondary)';
    return `<div style="padding:6px 0; border-bottom:1px solid var(--border); font-size:12px; color:${color}; white-space:pre-wrap;">${escapeHtml(entry.message)}</div>`;
  }).join('');
  modal.innerHTML = `
    <div class="modal" style="max-height:80vh; display:flex; flex-direction:column;">
      <h2>Import log (${importLog.length} entries)</h2>
      <div style="overflow-y:auto; flex:1; margin:-4px 0;">${logHtml || '<p>No log entries.</p>'}</div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function exportCsv() {
  const vehicles = await getVehicles();
  const fuelTypes = await getFuelTypes();
  const fillups = await getFillups();

  const blob = new Blob([
    csvSection(vehiclesToCsv(vehicles)),
    csvSection(fuelTypesToCsv(fuelTypes)),
    csvSection(fillupsToCsv(fillups))
  ].join('\n'), { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, 'nvBenz-export.csv');
  showToast('CSV exported', 'success');
}

async function exportJson() {
  const vehicles = await getVehicles();
  const fuelTypes = await getFuelTypes();
  const fillups = await getFillups();
  const snapshot = {
    exportedAt: new Date().toISOString(),
    vehicles,
    fuelTypes,
    fillups
  };
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, 'nvBenz-export.json');
  showToast('JSON exported', 'success');
}

function csvSection(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const line = (arr) => arr.map((v) => {
    const s = String(v == null ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',');
  return [line(headers), ...rows.map((r) => line(headers.map((h) => r[h])))].join('\n');
}

function vehiclesToCsv(vehicles) {
  return vehicles.map((v) => ({
    id: v.id, name: v.name, make: v.make, model: v.model, year: v.year,
    plate: v.plate, kind: v.kind, tankCapacity: v.tankCapacity,
    defaultFuelTypeId: v.defaultFuelTypeId, active: v.active ? 1 : 0,
    createdAt: v.createdAt, updatedAt: v.updatedAt
  }));
}

function fuelTypesToCsv(fuelTypes) {
  return fuelTypes.map((ft) => ({ id: ft.id, name: ft.name, active: ft.active ? 1 : 0 }));
}

function fillupsToCsv(fillups) {
  return fillups.map((f) => ({
    id: f.id, vehicleId: f.vehicleId, date: f.date, odo: f.odo,
    liters: f.liters, cost: f.cost, full: f.full ? 1 : 0,
    fuelType: f.fuelType || '', notes: f.notes || '',
    lat: f.lat != null ? f.lat : '', lng: f.lng != null ? f.lng : ''
  }));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Fuelio import ----------

async function handleFuelioImport(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const resultEl = document.getElementById('import-result');
  const logBtn = document.getElementById('btn-view-log');
  resultEl.textContent = 'Reading files...';
  importLog = [];

  let vehiclesImported = 0;
  let fillupsImported = 0;
  let typesRepaired = 0;

  for (const file of files) {
    if (!file.name.endsWith('.csv')) {
      importLog.push({ level: 'warning', message: `Skipped ${file.name}: not a .csv file` });
      continue;
    }
    importLog.push({ level: 'info', message: `--- Processing ${file.name} ---` });
    const r = await importFuelioCsv(file);
    vehiclesImported += r.vehicles;
    fillupsImported += r.fillups;
    typesRepaired += r.repaired || 0;
    importLog.push(...r.log);
  }

  const warningCount = importLog.filter((l) => l.level === 'warning' || l.level === 'error').length;
  let msg = `Imported ${vehiclesImported} vehicle(s) and ${fillupsImported} fill-up(s).`;
  if (typesRepaired) msg += ` Repaired ${typesRepaired} existing fuel type(s).`;
  if (warningCount) msg += ` ${warningCount} warning(s) — tap "View full import log" for details.`;
  resultEl.textContent = msg;
  resultEl.style.color = warningCount ? 'var(--warning)' : 'var(--success)';

  logBtn.style.display = importLog.length ? 'block' : 'none';

  e.target.value = '';
}

// Known Fuelio section headers other than Vehicle/Log that must NOT be treated as vehicle or log data
const KNOWN_SECTIONS = new Set([
  '## Vehicle', '## Log', '## CostCategories', '## Costs', '## Category',
  '## TripLog', '## FavStations', '## Pictures', '## Reminders'
]);

// ---------- explicit column name mapping ----------
// Fuelio uses these exact header names. We also accept common lowercase/plain
// alternatives so a hand-made or exported-elsewhere CSV (without "## Log" markers)
// still imports correctly, as long as it has *some* recognizable date/odo/liters/cost
// columns.
const COLUMN_ALIASES = {
  date: ['Date', 'date'],
  odo: ['Odo (km)', 'Odo', 'odo', 'odometer', 'Odometer'],
  liters: ['Fuel (l)', 'Fuel', 'liters', 'Liters', 'litres', 'Litres'],
  cost: ['Price', 'price', 'cost', 'Cost', 'total', 'Total'],
  full: ['Full', 'full'],
  notes: ['Notes', 'notes', 'note', 'Note'],
  lat: ['latitude', 'Latitude', 'lat', 'Lat'],
  lng: ['longitude', 'Longitude', 'lng', 'lon', 'Lon', 'Lng']
};

const VEHICLE_COLUMN_ALIASES = {
  name: ['Name', 'name'],
  make: ['Make', 'make'],
  model: ['Model', 'model'],
  year: ['Year', 'year'],
  plate: ['Plate', 'plate'],
  tank: ['Tank1Capacity', 'tankCapacity', 'TankCapacity']
};

// Minimum columns a log table must have to be considered a valid fill-up history.
// Fuel type is NOT required here — it's derived from Notes and/or the numeric
// FuelType column.
const REQUIRED_LOG_FIELDS = ['date', 'odo', 'liters', 'cost'];

// Fuelio's numeric FuelType column codes. Fuelio assigns per-installation IDs
// rather than storing names. This mapping was inferred from the actual fleet:
//   110 → Peugeot 3008 Pure Tech / Moto Guzzi V7 / Volvo XC60 / CRF (all petrol)
//   112 → Moto Guzzi V7 (premium petrol)
//   201/202/211/219/220 → VW California BiTDi / BMW 320d (diesel family)
// Notes-based detection (hvo, diesel+…) always takes priority over the code.
// Edit this table if your Fuelio installation used different IDs.
const FUEL_TYPE_CODES = {
  110: 'Unleaded 95',
  112: 'Unleaded 98',
  201: 'Diesel',
  202: 'Diesel',
  211: 'Diesel',
  219: 'Diesel',
  220: 'Diesel'
};

function getField(rowObj, aliases) {
  for (const key of aliases) {
    if (rowObj[key] !== undefined && rowObj[key] !== '') return rowObj[key];
  }
  return '';
}

// Given a header row (array of column names), figure out which canonical fields
// it actually contains, using COLUMN_ALIASES. Returns the set of canonical field
// names found, e.g. {date, odo, liters, cost, full, notes, lat, lng}.
function detectLogColumns(header) {
  const found = new Set();
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some((a) => header.includes(a))) found.add(canonical);
  }
  return found;
}

async function importFuelioCsv(file) {
  const log = [];
  const text = await readFileAsText(file);
  const rows = parseCsv(text);
  if (rows.length < 2) {
    log.push({ level: 'warning', message: `${file.name}: empty or unreadable CSV` });
    return { vehicles: 0, fillups: 0, log };
  }

  const hasSections = rows.some((r) => r[0] && r[0].startsWith('##'));

  let vehicleHeader = null;
  let vehicleDataRow = null;
  let logHeader = null;
  let logRows = [];

  if (hasSections) {
    // Fuelio-style archive: walk section by section. Only the FIRST "## Vehicle"
    // block (vehicle metadata, one row) and the FIRST "## Log" block (fill-up
    // history) are captured. Every other section (Costs, TripLog, FavStations,
    // Pictures, ...) is explicitly skipped so it can never corrupt vehicle or
    // fill-up data.
    let currentSection = null;
    let vehicleCaptured = false;
    let logCaptured = false;

    for (const row of rows) {
      if (!row || row.length === 0) continue;

      if (row[0] && row[0].startsWith('##')) {
        currentSection = row[0];
        if (!KNOWN_SECTIONS.has(currentSection)) {
          log.push({ level: 'info', message: `${file.name}: unrecognized section "${currentSection}" — skipped` });
        }
        continue;
      }

      if (currentSection === '## Vehicle' && !vehicleCaptured) {
        if (!vehicleHeader) { vehicleHeader = row; continue; }
        vehicleDataRow = row;
        vehicleCaptured = true;
        continue;
      }

      if (currentSection === '## Log' && !logCaptured) {
        if (!logHeader) { logHeader = row; continue; }
        logRows.push(row);
        continue;
      }

      // Any row outside ## Vehicle / ## Log (e.g. Costs, TripLog, Pictures) is ignored.
    }
  } else {
    // Plain CSV, no "## SectionName" markers — treat the whole file as a log
    // table. The vehicle name comes from the filename since there's no
    // "## Vehicle" section to read it from.
    logHeader = rows[0];
    logRows = rows.slice(1);
    log.push({ level: 'info', message: `${file.name}: no section markers found — treating entire file as a fill-up log` });
  }

  let vehicles = 0;
  let fillups = 0;
  let repaired = 0;

  // Validate the log header actually has the columns we need, regardless of
  // whether this came from a "## Log" section or a plain CSV.
  if (logHeader) {
    const foundFields = detectLogColumns(logHeader);
    const missing = REQUIRED_LOG_FIELDS.filter((f) => !foundFields.has(f));
    if (missing.length) {
      log.push({
        level: 'error',
        message: `${file.name}: log table is missing required column(s): ${missing.join(', ')}. ` +
          `Expected at least one of each — date: ${COLUMN_ALIASES.date.join('/')}, ` +
          `odo: ${COLUMN_ALIASES.odo.join('/')}, liters: ${COLUMN_ALIASES.liters.join('/')}, ` +
          `cost: ${COLUMN_ALIASES.cost.join('/')}. Found columns: ${logHeader.join(', ')}`
      });
      return { vehicles: 0, fillups: 0, log };
    }
  }

  // Resolve the vehicle name: from "## Vehicle" section if present, else filename.
  let vehicleName;
  let vehicleMeta = {};
  if (vehicleHeader && vehicleDataRow) {
    const v = zipObject(vehicleHeader, vehicleDataRow);
    vehicleName = getField(v, VEHICLE_COLUMN_ALIASES.name) || file.name.replace(/\.csv$/i, '');
    vehicleMeta = {
      make: getField(v, VEHICLE_COLUMN_ALIASES.make).trim(),
      model: getField(v, VEHICLE_COLUMN_ALIASES.model).trim(),
      year: (() => { const y = getField(v, VEHICLE_COLUMN_ALIASES.year); return y && y !== '0' ? y : ''; })(),
      plate: getField(v, VEHICLE_COLUMN_ALIASES.plate),
      tankCapacity: (() => { const t = parseFloat(getField(v, VEHICLE_COLUMN_ALIASES.tank)); return t > 0 ? t : null; })()
    };
  } else {
    vehicleName = file.name.replace(/\.csv$/i, '').replace(/[-_]?local$/i, '');
    log.push({ level: 'info', message: `${file.name}: no "## Vehicle" section — using filename "${vehicleName}" as vehicle name` });
  }

  const vehicle = {
    name: vehicleName,
    make: vehicleMeta.make || '',
    model: vehicleMeta.model || '',
    year: vehicleMeta.year || '',
    plate: vehicleMeta.plate || '',
    kind: guessKind(vehicleName),
    tankCapacity: vehicleMeta.tankCapacity || null,
    defaultFuelTypeId: null,
    active: false
  };

  try {
    // De-duplicate: if a vehicle with the same name already exists, reuse it
    // instead of creating a duplicate (important when re-importing the same
    // archive, which happens often while testing).
    const existingVehicles = await getVehicles();
    const existing = existingVehicles.find((ev) => ev.name === vehicleName);
    let vehicleId;
    if (existing) {
      vehicleId = existing.id;
      log.push({ level: 'info', message: `${file.name}: vehicle "${vehicleName}" already exists — reusing it (no duplicate created)` });
    } else {
      vehicleId = await saveVehicle(vehicle);
      vehicles = 1;
      log.push({ level: 'info', message: `${file.name}: imported vehicle "${vehicleName}"` });
    }

    if (logHeader && logRows.length) {
      // Build a map of existing fill-ups for this vehicle (matched by date +
      // odometer, which uniquely identifies a fill-up) for two purposes:
      //   1. skip rows that were already imported
      //   2. REPAIR existing records whose fuelType is missing/Unspecified
      const existingFillups = await getFillups(vehicleId);
      const existingByKey = new Map(existingFillups.map((f) => [f.date + '|' + f.odo, f]));

      for (let i = 0; i < logRows.length; i++) {
        const row = logRows[i];
        const f = zipObject(logHeader, row);
        const date = getField(f, COLUMN_ALIASES.date);
        const odoRaw = getField(f, COLUMN_ALIASES.odo);
        const litersRaw = getField(f, COLUMN_ALIASES.liters);
        const costRaw = getField(f, COLUMN_ALIASES.cost);
        const fullRaw = getField(f, COLUMN_ALIASES.full);
        const full = fullRaw === '1' || fullRaw === 'true' || fullRaw === 'TRUE';
        const notes = getField(f, COLUMN_ALIASES.notes);
        const latRaw = getField(f, COLUMN_ALIASES.lat);
        const lngRaw = getField(f, COLUMN_ALIASES.lng);

        // Fuel type resolution, most specific first:
        //   1. Notes keywords (hvo, diesel+, …) — always win
        //   2. Fuelio's numeric FuelType code column
        //   3. nvBenz's own exported fuelType name column (plain CSVs)
        let fuelType = normalizeFuelType(notes) || 'Unspecified';
        if (fuelType === 'Unspecified') {
          const codeRaw = f['FuelType'];
          if (codeRaw !== undefined && codeRaw !== '') {
            const code = parseInt(codeRaw, 10);
            if (!isNaN(code) && FUEL_TYPE_CODES[code]) fuelType = FUEL_TYPE_CODES[code];
          }
        }
        if (fuelType === 'Unspecified') {
          const nameRaw = f['fuelType'];
          if (nameRaw !== undefined && nameRaw !== '') fuelType = String(nameRaw);
        }
        const rowNum = i + 1;

        if (!date || !odoRaw || !litersRaw || !costRaw) {
          log.push({ level: 'warning', message: `${file.name} row ${rowNum}: skipped — missing date/odo/liters/cost` });
          continue;
        }
        const odo = parseFloat(odoRaw);
        const liters = parseFloat(litersRaw);
        const cost = parseFloat(costRaw);
        if (isNaN(odo) || isNaN(liters) || isNaN(cost)) {
          log.push({ level: 'warning', message: `${file.name} row ${rowNum}: skipped — non-numeric odo/liters/cost` });
          continue;
        }

        // GPS coordinates are preserved as-is (not validated/used yet) for a
        // future "record refueling location" feature.
        const lat = latRaw !== '' && !isNaN(parseFloat(latRaw)) ? parseFloat(latRaw) : null;
        const lng = lngRaw !== '' && !isNaN(parseFloat(lngRaw)) ? parseFloat(lngRaw) : null;

        const key = date + '|' + odo.toString();
        const existing = existingByKey.get(key);
        if (existing) {
          // Duplicate row — but if the stored record lacks a fuel type and the
          // archive provides one, repair it in place so re-importing the same
          // Fuelio archive upgrades older data.
          const existingFt = existing.fuelType || '';
          if (fuelType !== 'Unspecified' && (!existingFt || existingFt === 'Unspecified')) {
            await saveFillup({
              ...existing,
              fuelType,
              lat: existing.lat != null ? existing.lat : lat,
              lng: existing.lng != null ? existing.lng : lng
            });
            repaired++;
            log.push({ level: 'info', message: `${file.name} row ${rowNum}: fuel type repaired → ${fuelType}` });
          } else {
            log.push({ level: 'info', message: `${file.name} row ${rowNum}: already imported (same date + odo) — skipped` });
          }
          continue;
        }

        try {
          await saveFillup({
            vehicleId,
            date,
            odo: odo.toString(),
            liters: liters.toString(),
            cost: cost.toString(),
            full,
            fuelType,
            notes,
            lat,
            lng
          });
          existingByKey.set(key, { date, odo: odo.toString() });
          fillups++;
        } catch (err) {
          log.push({ level: 'error', message: `${file.name} row ${rowNum}: save failed — ${err.message}` });
        }
      }
      log.push({ level: 'info', message: `${file.name}: imported ${fillups} new fill-up row(s), repaired ${repaired} fuel type(s), out of ${logRows.length} total` });
    } else if (!logHeader) {
      log.push({ level: 'warning', message: `${file.name}: no fill-up log found in this file` });
    }
  } catch (err) {
    log.push({ level: 'error', message: `${file.name}: vehicle save failed — ${err.message}` });
  }

  return { vehicles, fillups, repaired, log };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    rows.push(parseCsvLine(line));
  }
  return rows;
}

function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = '';
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { field += '"'; i += 2; }
          else { i++; break; }
        } else {
          field += line[i]; i++;
        }
      }
      if (i < line.length && line[i] === ',') i++;
      fields.push(field);
    } else {
      const comma = line.indexOf(',', i);
      if (comma === -1) { fields.push(line.slice(i)); i = line.length; }
      else { fields.push(line.slice(i, comma)); i = comma + 1; }
    }
  }
  return fields;
}

function zipObject(keys, values) {
  const o = {};
  for (let i = 0; i < keys.length; i++) o[keys[i]] = values[i];
  return o;
}

function guessKind(name) {
  const n = (name || '').toLowerCase();
  if (n.match(/crf|moto|guzzi|gs\b|r1250|v7|rx\b/)) return 'motorbike';
  return 'car';
}

async function resetData() {
  if (!confirm('Delete ALL local data (vehicles, fill-ups, settings)? This cannot be undone.')) return;
  try {
    await idbClear('vehicles');
    await idbClear('fuel_types');
    await idbClear('fillups');
    await idbClear('settings');
    const db = await import('../db.js');
    await db.initDb();
    importLog = [];
    showToast('Data reset', 'success');
    app.goHome();
  } catch (err) {
    showToast('Reset failed', 'error');
  }
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
