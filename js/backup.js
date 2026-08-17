// Taslakları + otomatik kaydı tek bir JSON dosyasına yedekleme/geri yükleme.
// iOS'ta uzun süre kullanılmayan PWA'larda localStorage silinebiliyor;
// bu, ona karşı basit bir güvenlik ağı.

import { exportAllData, importAllData } from "./storage.js";

export function downloadBackup() {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `IHAUcusRaporlama_Yedek_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, "utf-8");
  });
}

export async function restoreBackupFile(file) {
  const data = await readBackupFile(file);
  if (!data || typeof data !== "object" || !("drafts" in data)) {
    throw new Error("Geçersiz yedek dosyası.");
  }
  importAllData(data);
}
