// localStorage tabanlı depolama katmanı (app/storage.py karşılığı).
// Masaüstü sürümündeki "kayıt klasörü" kavramı web'de yok; dosya indirmesi
// tarayıcı/işletim sistemi tarafından yönetiliyor (bkz. docx-export.js).

import { createReport } from "./models.js";

const AUTOSAVE_KEY = "iha_rapor:autosave";
const DRAFT_PREFIX = "iha_rapor:taslak:";

function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

function safeName(name) {
  const trimmed = (name || "").trim() || "TaslakRapor";
  return trimmed.replace(/[\\/:*?"<>|]+/g, "_");
}

export function saveAutosave(report) {
  report.updated_at = nowIso();
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(report));
}

export function loadAutosave() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return createReport(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
}

export function saveDraft(report, name) {
  report.updated_at = nowIso();
  const key = DRAFT_PREFIX + safeName(name);
  localStorage.setItem(key, JSON.stringify(report));
  return key;
}

export function loadDraft(key) {
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error("Taslak bulunamadı: " + key);
  return createReport(JSON.parse(raw));
}

export function listDrafts() {
  const drafts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(DRAFT_PREFIX)) continue;
    try {
      const data = JSON.parse(localStorage.getItem(key));
      drafts.push({
        key,
        name: key.slice(DRAFT_PREFIX.length),
        updated_at: data.updated_at || "",
        platform: (data.general && data.general.platform) || "",
      });
    } catch {
      // bozuk kayıt, atla
    }
  }
  drafts.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return drafts;
}

export function deleteDraft(key) {
  localStorage.removeItem(key);
}

export function exportAllData() {
  const drafts = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DRAFT_PREFIX)) {
      drafts[key] = JSON.parse(localStorage.getItem(key));
    }
  }
  const autosaveRaw = localStorage.getItem(AUTOSAVE_KEY);
  return {
    exported_at: nowIso(),
    autosave: autosaveRaw ? JSON.parse(autosaveRaw) : null,
    drafts,
  };
}

export function importAllData(backup) {
  if (backup.autosave) {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(backup.autosave));
  }
  for (const [key, value] of Object.entries(backup.drafts || {})) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
