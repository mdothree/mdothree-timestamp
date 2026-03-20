// services/conversionStorage.js — mdothree-timestamp
// Saves frequently used timestamp conversions and timezone pairs to Firestore.

import {
  getDB, ensureAnonymousUser, getFirebaseAuth,
  collection, addDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, deleteDoc, doc,
} from '../config/config.js';

const CONVERSIONS_COL = 'timestamp_conversions';
const PRESETS_COL     = 'timestamp_presets';

let _memConversions = [];
let _memPresets     = [];

// ---- Conversion History ----

/**
 * Log a timestamp conversion to Firestore.
 * @param {{ type: 'unix'|'date', input: string, outputs: Object }} entry
 */
export async function logConversion(entry) {
  const user = await ensureAnonymousUser();
  if (!user) {
    _memConversions.unshift({ id: Date.now().toString(), ...entry, createdAt: new Date() });
    if (_memConversions.length > 50) _memConversions.pop();
    return;
  }
  try {
    await addDoc(collection(getDB(), CONVERSIONS_COL), {
      uid:       user.uid,
      type:      entry.type,
      input:     String(entry.input),
      // Store a compact summary of outputs (avoid huge nested maps)
      summary:   entry.summary ?? Object.entries(entry.outputs ?? {}).slice(0, 3).map(([k,v]) => `${k}: ${v}`).join(' · '),
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[conversionStorage] log failed:', e.message);
  }
}

/**
 * Load recent conversion history.
 * @param {number} [count=15]
 */
export async function loadConversionHistory(count = 15) {
  const user = getFirebaseAuth().currentUser;
  if (!user) return _memConversions.slice(0, count);
  try {
    const q = query(
      collection(getDB(), CONVERSIONS_COL),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(count),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id:        d.id,
      type:      d.data().type,
      input:     d.data().input,
      summary:   d.data().summary,
      createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
    }));
  } catch (e) {
    console.warn('[conversionStorage] load history failed:', e.message);
    return _memConversions.slice(0, count);
  }
}

/**
 * Delete a conversion history entry.
 */
export async function deleteConversionEntry(docId) {
  const user = getFirebaseAuth().currentUser;
  if (!user) { _memConversions = _memConversions.filter(c => c.id !== docId); return; }
  try { await deleteDoc(doc(getDB(), CONVERSIONS_COL, docId)); }
  catch (e) { console.warn('[conversionStorage] delete failed:', e.message); }
}

// ---- Timezone Presets ----

/**
 * Save a timezone pair as a user preset.
 * @param {{ name: string, fromTz: string, toTz: string }} preset
 */
export async function saveTimezonePreset(preset) {
  const user = await ensureAnonymousUser();
  if (!user) {
    _memPresets.push({ id: Date.now().toString(), ...preset });
    return;
  }
  try {
    await addDoc(collection(getDB(), PRESETS_COL), {
      uid:    user.uid,
      name:   preset.name || `${preset.fromTz} → ${preset.toTz}`,
      fromTz: preset.fromTz,
      toTz:   preset.toTz,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[conversionStorage] save preset failed:', e.message);
  }
}

/**
 * Load timezone presets for the current user.
 */
export async function loadTimezonePresets() {
  const user = getFirebaseAuth().currentUser;
  if (!user) return _memPresets;
  try {
    const q = query(
      collection(getDB(), PRESETS_COL),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id:     d.id,
      name:   d.data().name,
      fromTz: d.data().fromTz,
      toTz:   d.data().toTz,
    }));
  } catch (e) {
    console.warn('[conversionStorage] load presets failed:', e.message);
    return _memPresets;
  }
}

/**
 * Delete a preset.
 */
export async function deleteTimezonePreset(docId) {
  const user = getFirebaseAuth().currentUser;
  if (!user) { _memPresets = _memPresets.filter(p => p.id !== docId); return; }
  try { await deleteDoc(doc(getDB(), PRESETS_COL, docId)); }
  catch (e) { console.warn('[conversionStorage] delete preset failed:', e.message); }
}
