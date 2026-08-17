// Adım 1: Genel Bilgiler formu (app/ui/general_page.py karşılığı).

const FIELD_PAIRS = [
  [["Tarih", "tarih", "date", true], ["Proje", "proje", "text", false]],
  [["Platform", "platform", "text", true], ["YKİ", "yki", "text", false]],
  [["Test Sahası", "test_sahasi", "text", false], ["Hava Koşulları", "hava_kosullari", "text", false]],
];

const RELEASE_MATRIX_FIELD = ["Release Matrix Versiyonu", "release_matrix_versiyonu", "text", false];

const RELEASE_MATRIX_PAIRS = [
  [["OTO", "oto"], ["MCU", "mcu"]],
  [["VISAPP", "visapp"], ["VISION", "vision"]],
  [["GCS", "gcs"], ["Tapa", "tapa"]],
  [["Kamera/Pod", "kamera_pod"], ["CRPA", "crpa"]],
  [["Pervane", "pervane"], ["Motor", "motor"]],
  [["ESC", "esc"], ["Batarya", "batarya"]],
  [["Kerkes App", "kerkes_app"], ["Kerkes Vision Eng", "kerkes_vision_eng"]],
  [["SCU", "scu"], ["SCS", "scs"]],
];

const TEXT_AREA_FIELDS = [
  ["Test Ekibi", "test_ekibi", false],
  ["Testin Amacı", "testin_amaci", true],
];

function isoToDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}.${m}.${y}`;
}

function displayToIso(display) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((display || "").trim());
  if (!match) return "";
  const [, d, m, y] = match;
  return `${y}-${m}-${d}`;
}

export function todayDisplay() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${d}.${m}.${now.getFullYear()}`;
}

function fieldInputHtml(key, type, required) {
  const idAttr = `field-${key}`;
  if (type === "date") {
    return `<input class="input" type="date" id="${idAttr}" data-key="${key}">`;
  }
  return `<input class="input" type="text" id="${idAttr}" data-key="${key}">`;
}

function labelHtml(label, key, required, full = false) {
  const cls = required ? "field-label required" : "field-label";
  return `<label class="${cls}" for="field-${key}">${label}</label>`;
}

export function renderGeneralForm(formEl) {
  let html = "";

  for (const [left, right] of FIELD_PAIRS) {
    const [l1, k1, t1, r1] = left;
    const [l2, k2, t2, r2] = right;
    html += `<div>${labelHtml(l1, k1, r1)}${fieldInputHtml(k1, t1, r1)}</div>`;
    html += `<div>${labelHtml(l2, k2, r2)}${fieldInputHtml(k2, t2, r2)}</div>`;
  }

  html += `<div class="field-section-title">Release Matrix Versiyonu</div>`;
  {
    const [l, k, t, r] = RELEASE_MATRIX_FIELD;
    html += `<div class="field-full">${labelHtml(l, k, r)}${fieldInputHtml(k, t, r)}</div>`;
  }

  for (const [left, right] of RELEASE_MATRIX_PAIRS) {
    const [l1, k1] = left;
    const [l2, k2] = right;
    html += `<div>${labelHtml(l1, k1, false)}${fieldInputHtml(k1, "text", false)}</div>`;
    html += `<div>${labelHtml(l2, k2, false)}${fieldInputHtml(k2, "text", false)}</div>`;
  }

  html += `<div class="field-section-title">Test Ekibi ve Amacı</div>`;
  for (const [label, key, required] of TEXT_AREA_FIELDS) {
    html += `<div class="field-full">${labelHtml(label, key, required)}<textarea class="textarea" id="field-${key}" data-key="${key}"></textarea></div>`;
  }

  formEl.innerHTML = html;
}

export function getGeneralData(formEl) {
  const data = {};
  formEl.querySelectorAll("[data-key]").forEach((el) => {
    if (el.type === "date") {
      data[el.dataset.key] = isoToDisplay(el.value);
    } else {
      data[el.dataset.key] = el.value.trim();
    }
  });
  return data;
}

export function setGeneralData(formEl, general) {
  formEl.querySelectorAll("[data-key]").forEach((el) => {
    const value = general[el.dataset.key] || "";
    if (el.type === "date") {
      el.value = displayToIso(value);
    } else {
      el.value = value;
    }
  });
}

export function markGeneralErrors(formEl, missingKeys) {
  formEl.querySelectorAll("[data-key]").forEach((el) => {
    el.classList.toggle("error", missingKeys.has(el.dataset.key));
  });
}
