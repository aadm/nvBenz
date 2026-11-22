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

// Compute clean min/max with buffer, then stepSize for exactly 3 ticks
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
  // Ensure data fits within axis
  if (min > dataMin) min = roundToClean(dataMin - buf * 1.5);
  if (max < dataMax) max = roundToClean(dataMax + buf * 1.5);
  return { min, max, step: (max - min) / 2 };
}

// X-axis callback: show only 3 labels (first, middle, last)
function threeXCallback(value, index, values) {
  if (!values || values.length <= 3) return value;
  const total = values.length;
  const mid = Math.floor((total - 1) / 2);
  if (index === 0 || index === mid || index === total - 1) return value;
  return '';
}

/* Home chart: consumption (right y) + TOTAL COST (left y), clean ranges, 3 ticks each */
export function consumptionPriceChart(canvasId, data, mode) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return null;

  const labels = data.map((d) => formatDateLabel(d.date));
  const consValues = mode === 'l/100km' ? data.map((d) => d.l100) : data.map((d) => d.kmL);
  const costValues = data.map((d) => d.cost);

  const consRange = cleanAxisRange(consValues);
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
            ticks: {
              fontColor: consumptionColor(),
              fontSize: 11,
              min: consRange.min,
              max: consRange.max,
              stepSize: consRange.step,
              callback: (v) => Math.round(v) + ' km/l'
            },
            gridLines: { display: false, drawBorder: false, drawOnChartArea: false }
          }
        ]
      }
    }
  });
  return activeCharts[canvasId];
}

/* Stats: consumption chart — FIXED scale 5-25 km/l, exactly 3 ticks */
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
          ticks: {
            fontColor: consumptionColor(),
            fontSize: 11,
            min: 5,
            max: 25,
            stepSize: 10,
            callback: (v) => Math.round(v) + ' km/l'
          },
          gridLines: { display: false, drawBorder: false }
        }]
      }
    }
  });
  return activeCharts[canvasId];
}

/* Stats: price per liter — green, clean range, dots for short periods */
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
  const range = cleanAxisRange(values, 0.2);

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
            min: range.min,
            max: range.max,
            stepSize: range.step,
            callback: (v) => '€' + v.toFixed(2)
          },
          gridLines: { display: false, drawBorder: false }
        }]
      }
    }
  });
  return activeCharts[canvasId];
}

/* Stats: monthly cost & liters — BAR chart, solid colors, adjacent pairs, 3 y-ticks (0, mid, top) */
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
              callback: (v) => '€' + Math.round(v)
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
              callback: (v) => Math.round(v) + ' l'
            },
            gridLines: { display: false, drawBorder: false, drawOnChartArea: false }
          }
        ]
      }
    }
  });
  return activeCharts[canvasId];
}
