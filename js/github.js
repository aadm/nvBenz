// nvBenz — GitHub gist export

import { getSetting, setSetting, getVehicles, getFuelTypes, getFillups } from './db.js';

const GITHUB_API = 'https://api.github.com';

function getAuthHeaders(pat) {
  return {
    'Authorization': 'token ' + pat,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
}

export async function exportFillupsToGist() {
  const pat = await getSetting('githubPat', '');
  if (!pat) throw new Error('No GitHub token. Enter it in Settings first.');

  const gistId = await getSetting('githubGistId', '');
  const vehicles = await getVehicles();
  const fuelTypes = await getFuelTypes();
  const fillups = await getFillups();

  const snapshot = {
    exportedAt: new Date().toISOString(),
    app: 'nvBenz',
    version: '1.0.0',
    vehicles,
    fuelTypes,
    fillups
  };

  const content = JSON.stringify(snapshot, null, 2);
  const files = {
    'nvBenz-export.json': { content }
  };

  const payload = {
    description: 'nvBenz fuel data export (' + new Date().toISOString() + ')',
    public: false,  // secret gist
    files
  };

  if (gistId) {
    // Update existing gist
    const resp = await fetch(`${GITHUB_API}/gists/${gistId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(pat),
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error('GitHub API error ' + resp.status + (err ? ': ' + err : ''));
    }
    const data = await resp.json();
    await setSetting('githubGistId', data.id);
    return data;
  } else {
    // Create new gist
    const resp = await fetch(`${GITHUB_API}/gists`, {
      method: 'POST',
      headers: getAuthHeaders(pat),
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error('GitHub API error ' + resp.status + (err ? ': ' + err : ''));
    }
    const data = await resp.json();
    await setSetting('githubGistId', data.id);
    return data;
  }
}
