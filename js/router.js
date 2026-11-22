// nvBenz router — swaps between views

import { renderHome } from './views/home.js';
import { renderFillup } from './views/fillup.js';
import { renderStats } from './views/stats.js';
import { renderVehicles } from './views/vehicles.js';
import { renderMore } from './views/more.js';

const VIEW_MAP = {
  home: renderHome,
  fillup: renderFillup,
  stats: renderStats,
  vehicles: renderVehicles,
  more: renderMore
};

let currentView = null;

export function navigate(viewName) {
  const el = document.getElementById('view-' + viewName);
  const views = document.querySelectorAll('.view');
  views.forEach((v) => v.classList.add('hidden'));
  if (el) el.classList.remove('hidden');

  // Update bottom nav active state
  document.querySelectorAll('.nav-item').forEach((item) => {
    const active = item.dataset.view === viewName;
    item.classList.toggle('active', active);
  });

  // Render the view
  const render = VIEW_MAP[viewName];
  if (render) {
    render().catch((err) => {
      console.error('nvBenz: render error for ' + viewName, err);
      showToast('Error loading ' + viewName, 'error');
    });
  }

  currentView = viewName;
  if (history.pushState) history.pushState(null, null, '#' + viewName);
}

export function getCurrentView() {
  return currentView;
}

export function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = type ? type : '';
  toast.classList.remove('hidden');
  setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

export function initRouter() {
  window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '') || 'home';
    navigate(hash);
  });

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(item.dataset.view);
    });
  });

  const hash = window.location.hash.replace('#', '') || 'home';
  navigate(hash);
}
