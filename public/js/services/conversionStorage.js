// services/conversionStorage.js — mdothree-timestamp
// Conversion history and timezone presets, stored ONLY in this browser
// (localStorage, with an in-memory fallback). Nothing here is sent to
// Firestore or any server: the privacy policy says tool input is processed
// locally and not stored by us. The exported API is unchanged.

const CONVERSIONS_KEY = 'mdothree-timestamp:conversions';
const PRESETS_KEY     = 'mdothree-timestamp:presets';
const MAX_CONVERSIONS = 50;
const MAX_PRESETS     = 20;

const _mem = { [CONVERSIONS_KEY]: [], [PRESETS_KEY]: [] };

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch { /* storage blocked or corrupt: fall back to memory */ }
  return _mem[key].slice();
}

function write(key, arr) {
  _mem[key] = arr.slice();
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* memory only */ }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Conversion History ----

/**
 * Record a timestamp conversion locally.
 * @param {{ type: 'unix'|'date', input: string, outputs?: Object, summary?: string }} entry
 */
export async function logConversion(entry) {
  const summary = entry.summary ??
    Object.entries(entry.outputs ?? {}).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ');
  const list = read(CONVERSIONS_KEY);
  list.unshift({
    id:        newId(),
    type:      entry.type,
    input:     String(entry.input),
    summary:   String(summary),
    createdAt: Date.now(),
  });
  write(CONVERSIONS_KEY, list.slice(0, MAX_CONVERSIONS));
}

/**
 * Load recent conversion history.
 * @param {number} [count=15]
 */
export async function loadConversionHistory(count = 15) {
  return read(CONVERSIONS_KEY).slice(0, count).map(c => ({
    ...c,
    createdAt: new Date(c.createdAt || Date.now()),
  }));
}

/**
 * Delete a conversion history entry.
 */
export async function deleteConversionEntry(id) {
  write(CONVERSIONS_KEY, read(CONVERSIONS_KEY).filter(c => c.id !== id));
}

// ---- Timezone Presets ----

/**
 * Save a timezone pair as a preset.
 * @param {{ name: string, fromTz: string, toTz: string }} preset
 */
export async function saveTimezonePreset(preset) {
  const list = read(PRESETS_KEY);
  list.unshift({
    id:     newId(),
    name:   preset.name || `${preset.fromTz} → ${preset.toTz}`,
    fromTz: preset.fromTz,
    toTz:   preset.toTz,
  });
  write(PRESETS_KEY, list.slice(0, MAX_PRESETS));
}

/**
 * Load saved timezone presets.
 */
export async function loadTimezonePresets() {
  return read(PRESETS_KEY);
}

/**
 * Delete a preset.
 */
export async function deleteTimezonePreset(id) {
  write(PRESETS_KEY, read(PRESETS_KEY).filter(p => p.id !== id));
}
