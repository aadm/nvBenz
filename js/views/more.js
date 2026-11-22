// nvBenz — More view

import { iconChevronLeft, iconChevronRight } from '../icons.js';

export async function renderMore() {
  const container = document.getElementById('view-more');

  container.innerHTML = `
    <div class="header" style="position:static; border-bottom:none; margin-bottom:20px; padding-top:0;">
      <button class="back-btn" onclick="app.goHome()">${iconChevronLeft(24)}</button>
      <h1>More</h1>
    </div>

    <div class="list">
      <div class="list-row" onclick="app.showImportExport()">
        <div class="main">
          <div class="title">Import / Export</div>
          <div class="subtitle">CSV backup, Fuelio archive import, reset data</div>
        </div>
        <div class="trailing">${iconChevronRight(18)}</div>
      </div>
      <div class="list-row" onclick="app.showSettings()">
        <div class="main">
          <div class="title">Settings</div>
          <div class="subtitle">Units, consumption, currency, theme, GitHub gist export</div>
        </div>
        <div class="trailing">${iconChevronRight(18)}</div>
      </div>
    </div>

    <div class="section-title" style="margin-top:28px">About</div>
    <p style="font-size:14px; color:var(--text-secondary); line-height:1.6">
      nvBenz: mobile-friendly web app to track vehicle fuel consumption.
      Export to GitHub gist for manual backup between devices.
    </p>
    <p style="font-size:13px; color:var(--text-secondary); margin-top:8px">
      Built in Vanilla JS, IndexedDB and Chart.js using different LLMs in OpenCode by aadm, 21-22 November 2026. Open source, no server, no tracking.
    </p>
  `;
}

export function showImportExport() {
  import('./import-export.js').then((m) => m.renderImportExport());
}

export function showSettings() {
  import('./settings.js').then((m) => m.renderSettings());
}
