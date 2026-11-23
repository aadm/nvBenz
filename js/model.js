// nvBenz business logic — consumption computation (Fuelio-style) and stats.

import {
  getFillups, getVehicles, getFuelTypes,
  getSetting, setSetting
} from './db.js';

// ---------- unit conversion ----------

const KM_PER_MILE = 1.609344;
const LITER_PER_GALLON_US = 3.785411784;
const LITER_PER_GALLON_UK = 4.54609188;

/* Convert consumption between representations.
   Input is always in metric (km/l). Returns converted value. */
export function convertConsumption(value, from, to) {
  // Normalize everything to l/100km first
  let lPer100;
  if (from === 'km/l') {
    lPer100 = value > 0 ? 100 / value : 0;
  } else if (from === 'l/100km') {
    lPer100 = value;
  } else if (from === 'mpg-us') {
    lPer100 = value > 0 ? 235.214583 / value : 0;
  } else if (from === 'mpg-uk') {
    lPer100 = value > 0 ? 282.480936 / value : 0;
  } else {
    lPer100 = value;
  }

  if (to === 'l/100km') return lPer100;
  if (to === 'km/l') return lPer100 > 0 ? 100 / lPer100 : 0;
  if (to === 'mpg-us') return lPer100 > 0 ? 235.214583 / lPer100 : 0;
  if (to === 'mpg-uk') return lPer100 > 0 ? 282.480936 / lPer100 : 0;
  return value;
}

export function consumptionLabel(mode) {
  return mode === 'l/100km' ? 'l/100 km' : 'km/l';
}

export function formatConsumption(value, mode) {
  if (!value || value === 0) return '—';
  // value arrives in km/l; convert to l/100km when that mode is selected
  const v = mode === 'l/100km' ? 100 / value : value;
  return v.toFixed(2);
}

export function formatDistance(km, units) {
  if (units === 'imperial') {
    const miles = km / KM_PER_MILE;
    return miles.toFixed(1) + ' mi';
  }
  return km.toFixed(0) + ' km';
}

export function formatVolume(liters, units) {
  if (units === 'imperial') {
    const gal = liters / LITER_PER_GALLON_US;
    return gal.toFixed(2) + ' gal';
  }
  return liters.toFixed(2) + ' l';
}

export function formatCost(cost, currency) {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;
  return symbol + cost.toFixed(2);
}

export function formatPricePerLiter(pricePerL, currency) {
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;
  return symbol + pricePerL.toFixed(3) + '/l';
}

// ---------- Fuelio-style consumption computation ----------

// Sort fillups by date, then compute consumption per interval between full tanks.
// Partial fills accumulate into the current open interval.
export function computeIntervals(fillups) {
  const sorted = [...fillups].sort((a, b) => new Date(a.date) - new Date(b.date));
  const intervals = [];
  let open = null; // { startOdo, startDate, liters, cost, count }

  for (const f of sorted) {
    const isFull = f.full === true || f.full === 1 || f.full === '1';
    const liters = parseFloat(f.liters) || 0;
    const cost = parseFloat(f.cost) || 0;
    const odo = parseFloat(f.odo) || 0;

    if (isFull) {
      if (open !== null) {
        // Close the interval at this full tank
        const distance = odo - open.startOdo;
        const totalLiters = open.liters + liters;
        const totalCost = open.cost + cost;
        intervals.push({
          startDate: open.startDate,
          endDate: f.date,
          startOdo: open.startOdo,
          endOdo: odo,
          distance,
          liters: totalLiters,
          cost: totalCost,
          consumption: distance > 0 && totalLiters > 0 ? (distance / totalLiters) : 0, // km/l
          count: open.count + 1,
          fillupIds: [...open.fillupIds, f.id]
        });
      }
      // Start a new open interval from this full tank
      open = {
        startOdo: odo,
        startDate: f.date,
        liters: 0,
        cost: 0,
        count: 0,
        fillupIds: [f.id]
      };
    } else {
      // Partial fill — accumulate into open interval
      if (open === null) {
        // No open full-tank interval yet; start a virtual one at this partial
        open = { startOdo: odo, startDate: f.date, liters: 0, cost: 0, count: 0, fillupIds: [] };
      }
      open.liters += liters;
      open.cost += cost;
      open.count += 1;
      open.fillupIds.push(f.id);
    }
  }
  // Any remaining open interval (last fill-up was partial) is not closed — no consumption yet
  return intervals;
}

// ---------- Stats ----------

export async function getStats(vehicleId = null) {
  const fillups = await getFillups(vehicleId);
  const vehicles = await getVehicles();
  const vehicle = vehicleId ? vehicles.find((v) => String(v.id) === String(vehicleId)) : null;
  const units = await getSetting('units', 'metric');
  const consumptionMode = await getSetting('consumptionMode', 'km/l');
  const currency = await getSetting('currency', 'EUR');

  const intervals = computeIntervals(fillups);

  const totalLiters = fillups.reduce((s, f) => s + (parseFloat(f.liters) || 0), 0);
  const totalCost = fillups.reduce((s, f) => s + (parseFloat(f.cost) || 0), 0);
  const totalFillups = fillups.length;

  // Distance: from first to last odo among fillups that have odo
  const odos = fillups.map((f) => parseFloat(f.odo)).filter((o) => o > 0);
  const distance = odos.length > 0 ? Math.max(...odos) - Math.min(...odos) : 0;

  const closedIntervals = intervals; // all closed intervals
  const totalIntervalDistance = closedIntervals.reduce((s, i) => s + i.distance, 0);
  const totalIntervalLiters = closedIntervals.reduce((s, i) => s + i.liters, 0);
  const totalIntervalCost = closedIntervals.reduce((s, i) => s + i.cost, 0);

  const avgConsumptionKmL =
    totalIntervalLiters > 0 && totalIntervalDistance > 0
      ? totalIntervalDistance / totalIntervalLiters
      : 0;

  const costPerKm = distance > 0 ? totalCost / distance : 0;
  const costPer100Km = distance > 0 ? (totalCost / distance) * 100 : 0;

  // Per-fuel-type breakdown
  const byFuel = {};
  for (const f of fillups) {
    const ft = f.fuelType || 'Unspecified';
    if (!byFuel[ft]) byFuel[ft] = { liters: 0, cost: 0, count: 0 };
    byFuel[ft].liters += parseFloat(f.liters) || 0;
    byFuel[ft].cost += parseFloat(f.cost) || 0;
    byFuel[ft].count += 1;
  }

  // Monthly aggregation (last 12 months)
  const monthly = {};
  for (const f of fillups) {
    const d = new Date(f.date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!monthly[key]) monthly[key] = { liters: 0, cost: 0, count: 0, distance: 0 };
    monthly[key].liters += parseFloat(f.liters) || 0;
    monthly[key].cost += parseFloat(f.cost) || 0;
    monthly[key].count += 1;
  }

  // Consumption over time (per closed interval, for the line chart)
  const consumptionOverTime = closedIntervals.map((i) => ({
    date: i.endDate,
    kmL: i.consumption,
    l100: i.consumption > 0 ? 100 / i.consumption : 0,
    cost: i.cost,
    distance: i.distance
  }));

  return {
    vehicle,
    units,
    consumptionMode,
    currency,
    totalFillups,
    totalLiters,
    totalCost,
    distance,
    avgConsumptionKmL,
    avgConsumptionL100: avgConsumptionKmL > 0 ? 100 / avgConsumptionKmL : 0,
    costPerKm,
    costPer100Km,
    intervals: closedIntervals,
    byFuel,
    monthly,
    consumptionOverTime
  };
}

// ---------- Fuel type normalization for Fuelio import ----------

export function normalizeFuelType(notes) {
  if (!notes) return 'Unspecified';
  const n = notes.trim().toLowerCase();
  const m = n.match(/^(hvo|diesel(?:\s*\+)?|unleaded\s*95|unleaded\s*98|diesel|lpg|petrol|benzina)/);
  if (m) {
    const t = m[1].replace(/\s+/g, ' ').trim();
    const map = {
      hvo: 'HVO',
      diesel: 'Diesel',
      'diesel +': 'Diesel+',
      'diesel+': 'Diesel+',
      'diesel +': 'Diesel+',
      'unleaded 95': 'Unleaded 95',
      'unleaded 98': 'Unleaded 98',
      lpg: 'LPG',
      petrol: 'Unleaded 95',
      benzina: 'Unleaded 95'
    };
    return map[t] || 'Unspecified';
  }
  return 'Unspecified';
}
