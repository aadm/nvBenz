// nvBenz charts — Chart.js v2 (vendored for offline use)

let activeCharts = {};

function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}
function textColor() {
  return getTheme() === 'light' ? '#0f172a' : '#f1f5f9';
}
function consumptionColor() {
  return getTheme() === 'light' ? '#2563eb' : '#60a5fa';
}
function costColor() {
  return textColor();
}
function priceGreenColor() {
  return getTheme() === 'light' ? '#16a34a' : '#4ade80';
}

export function destroyChart(key) {
  if (activeCharts[key]) {
    activeCharts[key].destroy();
    activeCharts[key] = null;
  }
}

// Format date label as "Mon-YY" (e.g., "Dec-26", "Mar-24")
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  return MONTHS[d.getMonth()] + '-' + String(d.getFullYear()).slice(2);
}

// Round to the nearest clean number based on magnitude
function roundToClean(value) {
  const abs = Math.abs(value);
  if (abs < 1) return Math.round(value * 10) / 10;
  if (abs < 5) return Math.round(value * 2) / 2;
  if (abs < 50) return Math.round(value / 5) * 5;
  if (abs < 100) return Math.round(value / 10) * 10;
  if (abs < 1000) return Math.round(value / 25) * 25;
  return Math.round(value / 100) * 100;
}

// Compute clean min/max with buffer, stepSize for exactly 3 ticks
function cleanAxisRange(arr, bufferPct = 0.15) {
  if (!arr || arr.length === 0) return { min: 0, max: 1, step: 0.5 };
  const dataMin = Math.min(...arr);
  const dataMax = Math.max(...arr);
  if (dataMin === dataMax) {
    const v = dataMax;
    const rMin = roundToClean(v * 0.8);
    const rMax = roundToClean(v * 1.2) || 1;
    return { min: rMin, max: rMax, step: (rMax - rMin) / 2 };
  }
  const range = dataMax - dataMin;
  const buf = range * bufferPct;
  let min = roundToClean(Math.max(0, dataMin - buf));
  let max = roundToClean(dataMax + buf);
  if (min > dataMin) min = roundToClean(dataMin - buf * 1.5);
  if (max < dataMax) max = roundToClean(dataMax + buf * 1.5);
  return { min, max, step: (max - min) / 2 };
}

// Fixed consumption axis. Two modes:
//   km/l    — extent 8-22, ticks 10/15/20, label "X km/l"
//   l/100km — inverted axis (reverse) so lower l/100km (better) sits at the
//             top, matching the km/l layout: extent 4.5 (top) to 12.5
//             (bottom), ticks 5/7/10, label "X l/100km". The middle tick is
//             deliberately NOT at the geometric midpoint.
function consumptionAxis(mode) {
  if (mode === 'l/100km') {
    return {
      min: 4.5,
      max: 12.5,
      reverse: true,
      ticks: [5, 7, 10],
      label: (v) => Math.round(v) + ' l/100km'
    };
  }
  return {
    min: 8,
    max: 22,
    reverse: false,
    ticks: [10, 15, 20],
    label: (v) => Math.round(v) + ' km/l'
  };
}

function makeConsumptionTicks(mode) {
  const axis = consumptionAxis(mode);
  return function (scale) {
    scale.ticks = axis.ticks;
    return scale.ticks;
  };
}

// X-axis callback: show only 3 labels (first, middle, last)
function threeXCallback(value, index, values) {
  if (!values || values.length <= 3) return value;
  const total = values.length;
  const mid = Math.floor((total - 1) / 2);
  if (index === 0 || index === mid || index === total - 1) return value;
  return '';
}

/* Home chart: consumption (right y, fixed 8-22 with ticks 10/15/20)
   + TOTAL COST (left y, dynamic clean range) */
export function consumptionPriceChart(canvasId, data, mode) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return null;

  const labels = data.map((d) => formatDateLabel(d.date));
  const consValues = mode === 'l/100km' ? data.map((d) => d.l100) : data.map((d) => d.kmL);
  const costValues = data.map((d) => d.cost);

  const costRange = cleanAxisRange(costValues);

  activeCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Total cost (€)',
          data: costValues,
          yAxisID: 'y-cost',
          borderColor: costColor(),
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.3
        },
        {
          label: mode === 'l/100km' ? 'Consumption (l/100 km)' : 'Consumption (km/l)',
          data: consValues,
          yAxisID: 'y-consumption',
          borderColor: consumptionColor(),
          backgroundColor: 'transparent',
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      legend: { display: false },
      title: { display: false },
      scales: {
        xAxes: [{
          ticks: {
            fontColor: textColor(),
            fontSize: 11,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            callback: threeXCallback
          },
          gridLines: { display: false, drawBorder: false }
        }],
        yAxes: [
          {
            id: 'y-cost',
            position: 'left',
            ticks: {
              fontColor: costColor(),
              fontSize: 11,
              min: costRange.min,
              max: costRange.max,
              stepSize: costRange.step,
              callback: (v) => '€' + Math.round(v)
            },
            gridLines: { display: false, drawBorder: false, drawOnChartArea: false }
          },
          {
            id: 'y-consumption',
            position: 'right',
            reverse: consumptionAxis(mode).reverse,
            afterBuildTicks: makeConsumptionTicks(mode),
            ticks: {
              fontColor: consumptionColor(),
              fontSize: 11,
              min: consumptionAxis(mode).min,
              max: consumptionAxis(mode).max,
              callback: consumptionAxis(mode).label
            },
            gridLines: { display: false, drawBorder: false, drawOnChartArea: false }
          }
        ]
      }
    }
  });
  return activeCharts[canvasId];
}

/* Stats: consumption chart — fixed extent 8-22, ticks at 10/15/20 */
export function consumptionChart(canvasId, data, mode, opts = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return null;

  const labels = data.map((d) => formatDateLabel(d.date));
  const values = mode === 'l/100km' ? data.map((d) => d.l100) : data.map((d) => d.kmL);
  const showPoints = opts.showPoints || false;

  activeCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: mode === 'l/100km' ? 'Consumption (l/100 km)' : 'Consumption (km/l)',
        data: values,
        borderColor: consumptionColor(),
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointRadius: showPoints ? 5 : 0,
        pointHoverRadius: showPoints ? 7 : 0,
        pointBackgroundColor: consumptionColor(),
        pointBorderColor: consumptionColor(),
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      legend: { display: false },
      title: { display: false },
      scales: {
        xAxes: [{
          ticks: {
            fontColor: textColor(),
            fontSize: 11,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            callback: threeXCallback
          },
          gridLines: { display: false, drawBorder: false }
        }],
        yAxes: [{
          reverse: consumptionAxis(mode).reverse,
          afterBuildTicks: makeConsumptionTicks(mode),
          ticks: {
            fontColor: consumptionColor(),
            fontSize: 11,
            min: consumptionAxis(mode).min,
            max: consumptionAxis(mode).max,
            callback: consumptionAxis(mode).label
          },
          gridLines: { display: false, drawBorder: false }
        }]
      }
    }
  });
  return activeCharts[canvasId];
}

/* Stats: price per liter — green, FIXED range 1-3 €/l.
   Outlier values (mis-entries, foreign-currency rows) are clipped rather
   than allowed to widen the axis. Dots for short periods. */
export function priceChart(canvasId, data, opts = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return null;

  const labels = data.map((d) => formatDateLabel(d.date));
  const values = data.map((d) => {
    const liters = d.liters > 0 ? d.liters : 1;
    return parseFloat((d.cost / liters).toFixed(2));
  });

  const showPoints = opts.showPoints || false;

  activeCharts[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Price per liter (€/l)',
        data: values,
        borderColor: priceGreenColor(),
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointRadius: showPoints ? 5 : 0,
        pointHoverRadius: showPoints ? 7 : 0,
        pointBackgroundColor: priceGreenColor(),
        pointBorderColor: priceGreenColor(),
        fill: false,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      legend: { display: false },
      title: { display: false },
      scales: {
        xAxes: [{
          ticks: {
            fontColor: textColor(),
            fontSize: 11,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            callback: threeXCallback
          },
          gridLines: { display: false, drawBorder: false }
        }],
        yAxes: [{
          ticks: {
            fontColor: priceGreenColor(),
            fontSize: 11,
            min: 1,
            max: 3,
            stepSize: 1,
            callback: (v) => '€' + v.toFixed(0)
          },
          gridLines: { display: false, drawBorder: false }
        }]
      }
    }
  });
  return activeCharts[canvasId];
}

/* Stats: monthly cost & liters — BAR chart, solid colors, adjacent pairs,
   y-ticks show only mid and top (0 label hidden) */
export function monthlyChart(canvasId, monthly) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const keys = Object.keys(monthly).sort().slice(-12);
  const labels = keys.map((k) => {
    const [y, m] = k.split('-');
    return MONTHS[parseInt(m)-1] + '-' + y.slice(2);
  });
  const costData = keys.map((k) => monthly[k].cost);
  const literData = keys.map((k) => monthly[k].liters);

  const costMax = Math.max(...costData, 1);
  const literMax = Math.max(...literData, 1);
  const costTop = roundToClean(costMax * 1.1);
  const literTop = roundToClean(literMax * 1.1);

  activeCharts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cost (€)',
          data: costData,
          yAxisID: 'y-cost',
          backgroundColor: costColor() + 'CC',
          borderWidth: 0,
          barPercentage: 1.0,
          categoryPercentage: 0.7
        },
        {
          label: 'Liters',
          data: literData,
          yAxisID: 'y-liters',
          backgroundColor: consumptionColor() + 'CC',
          borderWidth: 0,
          barPercentage: 1.0,
          categoryPercentage: 0.7
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      legend: { display: false },
      title: { display: false },
      scales: {
        xAxes: [{
          ticks: {
            fontColor: textColor(),
            fontSize: 10,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
            callback: threeXCallback
          },
          gridLines: { display: false, drawBorder: false }
        }],
        yAxes: [
          {
            id: 'y-cost',
            position: 'left',
            ticks: {
              fontColor: costColor(),
              fontSize: 10,
              min: 0,
              max: costTop,
              stepSize: costTop / 2,
              // Hide the 0 label — only mid and top are shown
              callback: (v) => v === 0 ? '' : '€' + Math.round(v)
            },
            gridLines: { display: false, drawBorder: false, drawOnChartArea: false }
          },
          {
            id: 'y-liters',
            position: 'right',
            ticks: {
              fontColor: consumptionColor(),
              fontSize: 10,
              min: 0,
              max: literTop,
              stepSize: literTop / 2,
              // Hide the 0 label — only mid and top are shown
              callback: (v) => v === 0 ? '' : Math.round(v) + ' l'
            },
            gridLines: { display: false, drawBorder: false, drawOnChartArea: false }
          }
        ]
      }
    }
  });
  return activeCharts[canvasId];
}
