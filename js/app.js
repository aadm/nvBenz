// nvBenz — main application entry point

import { initRouter } from './router.js';
import { initDb, getActiveVehicleId, setActiveVehicleId, getVehicleWithMostRecentFillup, getVehicles } from './db.js';

window.app = {
  goHome() { navigate('home'); },
  navigate(viewName) { navigate(viewName); },
  viewFillupStats() { navigate('stats'); },
  editVehicle(id) { import('./views/vehicles.js').then((m) => m.editVehicle(id)); },
  showImportExport() { import('./views/import-export.js').then((m) => m.renderImportExport()); },
  showSettings() { import('./views/settings.js').then((m) => m.renderSettings()); },
  fillupList(vehicleId) { import('./views/fillup-list.js').then((m) => m.renderFillupList(vehicleId)); },
  selectFuelType(name) { import('./views/fillup.js').then((m) => m.selectFuelType(name)); },
  newFuelType() { import('./views/fillup.js').then((m) => m.newFuelType()); },
  toggleFull() { import('./views/fillup.js').then((m) => m.toggleFull()); },
  saveFillup() { import('./views/fillup.js').then((m) => m.saveFillup()); },
  setVehicleId(id) { import('./views/fillup.js').then((m) => m.setVehicleId(id)); },
  deleteVehicleAction(id) { import('./views/vehicles.js').then((m) => m.deleteVehicleAction(id)); },
  // Active vehicle management
  async getActiveVehicleId() { return getActiveVehicleId(); },
  async setActiveVehicleId(id) { await setActiveVehicleId(id); },
  async getVehicleWithMostRecentFillup() { return getVehicleWithMostRecentFillup(); },
  async getVehicles() { return getVehicles(); }
};

let navigate = null;

async function main() {
  await initDb();
  // Register service worker for offline caching + PWA install
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('nvBenz: service worker registered');
    } catch (e) {
      console.warn('nvBenz: SW registration failed', e);
    }
  }
  const router = await import('./router.js');
  navigate = router.navigate;
  window.app.navigate = router.navigate;
  router.initRouter();
}

main().catch((err) => {
  console.error('nvBenz: failed to initialize', err);
});
