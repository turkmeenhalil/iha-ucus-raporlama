// IndexedDB tabanlı depolama katmanı. localStorage'ın aksine büyük ikili veri
// (uçuş fotoğrafları) için yeterli kotaya sahip; fotoğraflar orijinal kalitede,
// sıkıştırılmadan Blob olarak saklanır.

import { createReport } from "./models.js";

const DB_NAME = "iha_rapor_db";
const DB_VERSION = 1;
const STORE = "reports";

const AUTOSAVE_KEY = "autosave";
const DRAFT_PREFIX = "taslak:";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode) {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

function safeName(name) {
  const trimmed = (name || "").trim() || "TaslakRapor";
  return trimmed.replace(/[\\/:*?"<>|]+/g, "_");
}

export async function saveAutosave(report) {
  report.updated_at = nowIso();
  const store = await tx("readwrite");
  await reqToPromise(store.put({ key: AUTOSAVE_KEY, type: "autosave", updated_at: report.updated_at, data: report }));
}

export async function loadAutosave() {
  const store = await tx("readonly");
  const record = await reqToPromise(store.get(AUTOSAVE_KEY));
  if (!record) return null;
  try {
    return createReport(record.data);
  } catch {
    return null;
  }
}

export async function clearAutosave() {
  const store = await tx("readwrite");
  await reqToPromise(store.delete(AUTOSAVE_KEY));
}

export async function saveDraft(report, name) {
  report.updated_at = nowIso();
  const key = DRAFT_PREFIX + safeName(name);
  const store = await tx("readwrite");
  await reqToPromise(
    store.put({ key, type: "draft", name: safeName(name), updated_at: report.updated_at, data: report })
  );
  return key;
}

export async function loadDraft(key) {
  const store = await tx("readonly");
  const record = await reqToPromise(store.get(key));
  if (!record) throw new Error("Taslak bulunamadı: " + key);
  return createReport(record.data);
}

export async function listDrafts() {
  const store = await tx("readonly");
  const all = await reqToPromise(store.getAll());
  const drafts = all
    .filter((r) => r.type === "draft")
    .map((r) => ({
      key: r.key,
      name: r.name,
      updated_at: r.updated_at || "",
      platform: (r.data && r.data.general && r.data.general.platform) || "",
    }));
  drafts.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return drafts;
}

export async function deleteDraft(key) {
  const store = await tx("readwrite");
  await reqToPromise(store.delete(key));
}

// ---------------- Eski localStorage verisini bir kereliğine IndexedDB'ye taşı ----------------
// Fotoğraf özelliği eklenmeden önce raporlar localStorage'da tutuluyordu. Depolama
// IndexedDB'ye taşındığında uygulama artık oraya bakmadığı için eski raporlar
// "kayboldu" gibi görünüyordu — oysa localStorage'da hâlâ duruyorlardı. Bu fonksiyon
// onları IndexedDB'ye kopyalar (localStorage'daki veriyi silmez, sadece kopyalar).

const LEGACY_AUTOSAVE_KEY = "iha_rapor:autosave";
const LEGACY_DRAFT_PREFIX = "iha_rapor:taslak:";
const MIGRATION_DONE_KEY = "iha_rapor:idb_migration_v1_done";

export async function migrateLegacyLocalStorage() {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(MIGRATION_DONE_KEY)) return;

  try {
    const store = await tx("readwrite");

    const autosaveRaw = localStorage.getItem(LEGACY_AUTOSAVE_KEY);
    if (autosaveRaw) {
      const existing = await reqToPromise(store.get(AUTOSAVE_KEY));
      if (!existing) {
        const data = JSON.parse(autosaveRaw);
        await reqToPromise(
          store.put({ key: AUTOSAVE_KEY, type: "autosave", updated_at: data.updated_at || nowIso(), data })
        );
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const legacyKey = localStorage.key(i);
      if (!legacyKey || !legacyKey.startsWith(LEGACY_DRAFT_PREFIX)) continue;
      const raw = localStorage.getItem(legacyKey);
      if (!raw) continue;
      const name = legacyKey.slice(LEGACY_DRAFT_PREFIX.length);
      const newKey = DRAFT_PREFIX + name;
      const existing = await reqToPromise(store.get(newKey));
      if (existing) continue;
      const data = JSON.parse(raw);
      await reqToPromise(
        store.put({ key: newKey, type: "draft", name, updated_at: data.updated_at || nowIso(), data })
      );
    }

    localStorage.setItem(MIGRATION_DONE_KEY, "1");
  } catch {
    // Taşıma başarısız olursa sessizce geç; localStorage verisi silinmediği için veri kaybolmaz,
    // bir sonraki açılışta tekrar denenir (MIGRATION_DONE_KEY yazılmadı).
  }
}

// ---------------- Yedekleme (JSON dışa/içe aktarım) ----------------
// Blob'lar JSON'a yazılamaz; yedek dosyasında base64'e çevrilir.

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",", 2)[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mime) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

async function serializeReportForBackup(report) {
  const clone = JSON.parse(JSON.stringify(report, (k, v) => (k === "blob" ? undefined : v)));
  for (let fi = 0; fi < report.flights.length; fi++) {
    const blocks = report.flights[fi].blocks || [];
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      if (block.type !== "photo") continue;
      clone.flights[fi].blocks[bi].base64 = await blobToBase64(block.blob);
      clone.flights[fi].blocks[bi].mime = block.blob.type || "image/jpeg";
    }
  }
  return clone;
}

function deserializeReportFromBackup(raw) {
  const report = JSON.parse(JSON.stringify(raw));
  for (const flight of report.flights || []) {
    for (const block of flight.blocks || []) {
      if (block.type === "photo" && block.base64) {
        block.blob = base64ToBlob(block.base64, block.mime || "image/jpeg");
        delete block.base64;
        delete block.mime;
      }
    }
  }
  return report;
}

export async function exportAllData() {
  const store = await tx("readonly");
  const all = await reqToPromise(store.getAll());
  const autosaveRecord = all.find((r) => r.type === "autosave");
  const draftRecords = all.filter((r) => r.type === "draft");

  const drafts = {};
  for (const r of draftRecords) {
    drafts[r.key] = await serializeReportForBackup(r.data);
  }

  return {
    exported_at: nowIso(),
    autosave: autosaveRecord ? await serializeReportForBackup(autosaveRecord.data) : null,
    drafts,
  };
}

export async function importAllData(backup) {
  const store = await tx("readwrite");
  if (backup.autosave) {
    const data = deserializeReportFromBackup(backup.autosave);
    await reqToPromise(store.put({ key: AUTOSAVE_KEY, type: "autosave", updated_at: data.updated_at, data }));
  }
  for (const [key, value] of Object.entries(backup.drafts || {})) {
    const data = deserializeReportFromBackup(value);
    const name = key.startsWith(DRAFT_PREFIX) ? key.slice(DRAFT_PREFIX.length) : key;
    await reqToPromise(store.put({ key, type: "draft", name, updated_at: data.updated_at, data }));
  }
}
