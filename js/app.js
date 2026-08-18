// Wizard koordinatörü (app/ui/report_editor.py + main_window.py karşılığı).

import { createReport, createFlight, addFlight, removeFlight, moveFlight } from "./models.js";
import { validateReport } from "./validation.js";
import * as storage from "./storage.js";
import { downloadBackup, restoreBackupFile } from "./backup.js";
import { exportReportBlob, suggestFilenamePrefix, buildFilename } from "./docx-export.js";
import { renderGeneralForm, getGeneralData, setGeneralData, markGeneralErrors, todayDisplay } from "./ui/general-page.js";
import { renderFlightsList, updateFlightButtonStates } from "./ui/flights-page.js";
import { renderDraftsList, updateDraftButtonStates } from "./ui/home.js";
import { buildPreviewHtml } from "./ui/preview-page.js";

const AUTOSAVE_INTERVAL_MS = 20000;

const el = (id) => document.getElementById(id);

const dom = {
  offlineBadge: el("offline-badge"),
  viewHome: el("view-home"),
  viewWizard: el("view-wizard"),

  draftsList: el("drafts-list"),
  draftsEmpty: el("drafts-empty"),
  btnNewReport: el("btn-new-report"),
  btnOpenDraft: el("btn-open-draft"),
  btnDeleteDraft: el("btn-delete-draft"),
  btnMenuToggle: el("btn-menu-toggle"),
  backupMenu: el("backup-menu"),
  btnBackupExport: el("btn-backup-export"),
  btnBackupImport: el("btn-backup-import"),
  backupFileInput: el("backup-file-input"),

  stepBar: el("step-bar"),
  stepPages: [el("step-0"), el("step-1"), el("step-2"), el("step-3")],
  bottomBar: el("bottom-bar"),
  btnGoBack: el("btn-go-back"),
  btnGoNext: el("btn-go-next"),
  btnHome: el("btn-home"),

  generalForm: el("general-form"),

  flightsList: el("flights-list"),
  flightsEmpty: el("flights-empty"),
  btnAddFlight: el("btn-add-flight"),
  btnFlightEdit: el("btn-flight-edit"),
  btnFlightDelete: el("btn-flight-delete"),
  btnFlightUp: el("btn-flight-up"),
  btnFlightDown: el("btn-flight-down"),

  flightModal: el("flight-modal"),
  flightModalTitle: el("flight-modal-title"),
  flightNotlar: el("flight-notlar"),
  btnFlightCancel: el("btn-flight-cancel"),
  btnFlightSave: el("btn-flight-save"),

  previewContent: el("preview-content"),
  btnPreviewBack: el("btn-preview-back"),
  btnPreviewContinue: el("btn-preview-continue"),

  confirmMessage: el("confirm-message"),
  confirmErrors: el("confirm-errors"),
  recordNameInput: el("record-name-input"),
  recordNamePreview: el("record-name-preview"),
  btnConfirmBack: el("btn-confirm-back"),
  btnSaveDraft: el("btn-save-draft"),
  btnApprove: el("btn-approve"),

  saveDraftModal: el("save-draft-modal"),
  saveDraftName: el("save-draft-name"),
  btnSaveDraftCancel: el("btn-save-draft-cancel"),
  btnSaveDraftConfirm: el("btn-save-draft-confirm"),

  notifyModal: el("notify-modal"),
  notifyTitle: el("notify-title"),
  notifyMessage: el("notify-message"),
  notifyBtnYes: el("notify-btn-yes"),
  notifyBtnNo: el("notify-btn-no"),
};

const state = {
  report: createReport(),
  currentView: "home",
  currentStep: -1, // -1: sihirli değer, Ana Menü'deyken hiçbir adım "aktif" değil (commitCurrentPage yanlışlıkla tetiklenmesin diye)
  maxReached: 0,
  selectedFlightId: null,
  editingFlightId: null,
  selectedDraftKey: null,
};

// ---------------- Bildirim (alert/confirm) yardımcı ----------------

function notify({ title, message, showNo = false }) {
  return new Promise((resolve) => {
    dom.notifyTitle.textContent = title;
    dom.notifyMessage.textContent = message;
    dom.notifyBtnNo.hidden = !showNo;
    dom.notifyModal.hidden = false;

    const cleanup = (result) => {
      dom.notifyModal.hidden = true;
      dom.notifyBtnYes.removeEventListener("click", onYes);
      dom.notifyBtnNo.removeEventListener("click", onNo);
      resolve(result);
    };
    const onYes = () => cleanup(true);
    const onNo = () => cleanup(false);
    dom.notifyBtnYes.addEventListener("click", onYes);
    dom.notifyBtnNo.addEventListener("click", onNo);
  });
}

// ---------------- Çevrimdışı rozeti ----------------

function updateOfflineBadge() {
  dom.offlineBadge.hidden = navigator.onLine;
}
window.addEventListener("online", updateOfflineBadge);
window.addEventListener("offline", updateOfflineBadge);

// ---------------- Ana Menü ----------------

function refreshDrafts() {
  const drafts = storage.listDrafts();
  renderDraftsList(dom.draftsList, dom.draftsEmpty, drafts, state.selectedDraftKey);
  updateDraftButtonStates(
    { openBtn: dom.btnOpenDraft, deleteBtn: dom.btnDeleteDraft },
    !!state.selectedDraftKey && drafts.some((d) => d.key === state.selectedDraftKey)
  );
}

function showHomeView() {
  state.currentView = "home";
  state.currentStep = -1;
  dom.viewHome.hidden = false;
  dom.viewWizard.hidden = true;
  refreshDrafts();
}

function showWizardView() {
  state.currentView = "wizard";
  dom.viewHome.hidden = true;
  dom.viewWizard.hidden = false;
}

dom.draftsList.addEventListener("click", (ev) => {
  const li = ev.target.closest("li");
  if (!li) return;
  state.selectedDraftKey = li.dataset.key;
  refreshDrafts();
});

dom.btnNewReport.addEventListener("click", () => {
  state.report = createReport({ general: { tarih: todayDisplay() } });
  state.maxReached = 0;
  showWizardView();
  goToStep(0);
});

dom.btnOpenDraft.addEventListener("click", () => {
  if (!state.selectedDraftKey) return;
  try {
    state.report = storage.loadDraft(state.selectedDraftKey);
    state.maxReached = 3;
    showWizardView();
    goToStep(0);
  } catch (err) {
    notify({ title: "Hata", message: "Taslak açılamadı: " + err.message });
  }
});

dom.btnDeleteDraft.addEventListener("click", async () => {
  if (!state.selectedDraftKey) return;
  const ok = await notify({
    title: "Raporu Sil",
    message: "Bu raporu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    showNo: true,
  });
  if (!ok) return;
  storage.deleteDraft(state.selectedDraftKey);
  state.selectedDraftKey = null;
  refreshDrafts();
});

dom.btnMenuToggle.addEventListener("click", (ev) => {
  ev.stopPropagation();
  dom.backupMenu.hidden = !dom.backupMenu.hidden;
});

document.addEventListener("click", (ev) => {
  if (!dom.backupMenu.hidden && !dom.backupMenu.contains(ev.target) && ev.target !== dom.btnMenuToggle) {
    dom.backupMenu.hidden = true;
  }
});

dom.btnBackupExport.addEventListener("click", () => {
  downloadBackup();
  dom.backupMenu.hidden = true;
});

dom.btnBackupImport.addEventListener("click", () => {
  dom.backupMenu.hidden = true;
  dom.backupFileInput.click();
});

dom.backupFileInput.addEventListener("change", async () => {
  const file = dom.backupFileInput.files[0];
  dom.backupFileInput.value = "";
  if (!file) return;
  try {
    await restoreBackupFile(file);
    refreshDrafts();
    await notify({ title: "Yedek Yüklendi", message: "Yedek başarıyla geri yüklendi." });
  } catch (err) {
    await notify({ title: "Hata", message: "Yedek dosyası okunamadı: " + err.message });
  }
});

// ---------------- Wizard navigasyonu ----------------

function commitCurrentPage() {
  if (state.currentStep === 0) {
    state.report.general = getGeneralData(dom.generalForm);
  } else if (state.currentStep === 3) {
    state.report.filenamePrefix = dom.recordNameInput.value.trim();
  }
}

function updateRecordNamePreview() {
  const prefix = dom.recordNameInput.value.trim() || suggestFilenamePrefix(state.report);
  const filename = buildFilename(prefix, state.report.general.tarih);
  dom.recordNamePreview.textContent = `Dosya adı: ${filename}`;
}

function autosave() {
  storage.saveAutosave(state.report);
}

function updateStepBar() {
  dom.stepBar.querySelectorAll(".step-btn").forEach((btn) => {
    const idx = Number(btn.dataset.step);
    btn.classList.toggle("active", idx === state.currentStep);
    btn.disabled = idx > state.maxReached;
  });
}

function goToStep(index) {
  commitCurrentPage();
  autosave();

  state.currentStep = index;
  state.maxReached = Math.max(state.maxReached, index);

  dom.stepPages.forEach((page, i) => {
    page.hidden = i !== index;
  });
  dom.bottomBar.hidden = !(index === 0 || index === 1);
  updateStepBar();

  if (index === 0) {
    setGeneralData(dom.generalForm, state.report.general);
  } else if (index === 1) {
    state.selectedFlightId = null;
    renderFlightsList(dom.flightsList, dom.flightsEmpty, state.report.flights, state.selectedFlightId);
    updateFlightButtonStates(
      { upBtn: dom.btnFlightUp, downBtn: dom.btnFlightDown, editBtn: dom.btnFlightEdit, deleteBtn: dom.btnFlightDelete },
      state.report.flights,
      state.selectedFlightId
    );
  } else if (index === 2) {
    dom.previewContent.innerHTML = buildPreviewHtml(state.report);
  } else if (index === 3) {
    const errors = validateReport(state.report);
    if (errors.length) {
      dom.confirmMessage.textContent = "Rapor onaylanmadan önce aşağıdaki eksiklerin tamamlanması gerekiyor.";
      dom.confirmErrors.innerHTML = errors.map((e) => `<li>${e}</li>`).join("");
      dom.btnApprove.disabled = true;
    } else {
      dom.confirmMessage.textContent =
        "Rapor bilgilerini kontrol ettiniz mi? Rapor onaylandıktan sonra Word dosyası oluşturulacaktır.";
      dom.confirmErrors.innerHTML = "";
      dom.btnApprove.disabled = false;
    }
    dom.recordNameInput.value = state.report.filenamePrefix || suggestFilenamePrefix(state.report);
    updateRecordNamePreview();
  }

  autosave();
}

dom.stepBar.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".step-btn");
  if (!btn || btn.disabled) return;
  goToStep(Number(btn.dataset.step));
});

dom.btnGoBack.addEventListener("click", () => goToStep(Math.max(0, state.currentStep - 1)));
dom.btnGoNext.addEventListener("click", () => goToStep(Math.min(3, state.currentStep + 1)));
dom.btnHome.addEventListener("click", () => {
  commitCurrentPage();
  autosave();
  showHomeView();
});
dom.recordNameInput.addEventListener("input", updateRecordNamePreview);

dom.btnPreviewBack.addEventListener("click", () => goToStep(1));
dom.btnPreviewContinue.addEventListener("click", () => goToStep(3));
dom.btnConfirmBack.addEventListener("click", () => goToStep(2));

// ---------------- Genel Bilgiler formu ----------------

renderGeneralForm(dom.generalForm);
dom.generalForm.addEventListener("input", () => {
  // Autosave, adım değişiminde zaten tetikleniyor; burada sadece hata vurgusunu temizle.
});

// ---------------- Uçuşlar ----------------

function refreshFlightsList() {
  renderFlightsList(dom.flightsList, dom.flightsEmpty, state.report.flights, state.selectedFlightId);
  updateFlightButtonStates(
    { upBtn: dom.btnFlightUp, downBtn: dom.btnFlightDown, editBtn: dom.btnFlightEdit, deleteBtn: dom.btnFlightDelete },
    state.report.flights,
    state.selectedFlightId
  );
}

dom.flightsList.addEventListener("click", (ev) => {
  const li = ev.target.closest("li");
  if (!li) return;
  state.selectedFlightId = li.dataset.id;
  refreshFlightsList();
});

function openFlightModal(flight) {
  state.editingFlightId = flight ? flight.id : null;
  dom.flightModalTitle.textContent = flight ? "Uçuş Düzenle" : "Uçuş Ekle";
  dom.flightNotlar.value = flight ? flight.notlar : "";
  dom.flightNotlar.classList.remove("error");
  dom.flightModal.hidden = false;
}

function closeFlightModal() {
  dom.flightModal.hidden = true;
}

dom.btnAddFlight.addEventListener("click", () => openFlightModal(null));
dom.btnFlightEdit.addEventListener("click", () => {
  const flight = state.report.flights.find((f) => f.id === state.selectedFlightId);
  if (flight) openFlightModal(flight);
});
dom.btnFlightCancel.addEventListener("click", closeFlightModal);

dom.btnFlightSave.addEventListener("click", () => {
  const notlar = dom.flightNotlar.value.trim();
  if (!notlar) {
    dom.flightNotlar.classList.add("error");
    return;
  }
  if (state.editingFlightId) {
    const flight = state.report.flights.find((f) => f.id === state.editingFlightId);
    if (flight) flight.notlar = notlar;
    state.selectedFlightId = state.editingFlightId;
  } else {
    const created = addFlight(state.report, createFlight({ notlar }));
    state.selectedFlightId = created.id;
  }
  closeFlightModal();
  refreshFlightsList();
  autosave();
});

dom.btnFlightDelete.addEventListener("click", async () => {
  if (!state.selectedFlightId) return;
  const ok = await notify({
    title: "Uçuşu Sil",
    message: "Bu uçuşu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
    showNo: true,
  });
  if (!ok) return;
  removeFlight(state.report, state.selectedFlightId);
  state.selectedFlightId = null;
  refreshFlightsList();
  autosave();
});

dom.btnFlightUp.addEventListener("click", () => {
  if (!state.selectedFlightId) return;
  moveFlight(state.report, state.selectedFlightId, -1);
  refreshFlightsList();
  autosave();
});

dom.btnFlightDown.addEventListener("click", () => {
  if (!state.selectedFlightId) return;
  moveFlight(state.report, state.selectedFlightId, 1);
  refreshFlightsList();
  autosave();
});

// ---------------- Taslak Kaydet ----------------

dom.btnSaveDraft.addEventListener("click", () => {
  dom.saveDraftName.value = state.report.general.platform || "Taslak";
  dom.saveDraftModal.hidden = false;
});
dom.btnSaveDraftCancel.addEventListener("click", () => {
  dom.saveDraftModal.hidden = true;
});
dom.btnSaveDraftConfirm.addEventListener("click", async () => {
  const name = dom.saveDraftName.value.trim();
  if (!name) return;
  storage.saveDraft(state.report, name);
  dom.saveDraftModal.hidden = true;
  await notify({ title: "Taslak Kaydedildi", message: `Taslak kaydedildi: ${name}` });
});

// ---------------- Onay / Word oluşturma ----------------

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

async function downloadOrShareBlob(blob, filename) {
  const file = new File([blob], filename, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  // Web Share API sadece iOS'ta tercih edilir: Android/Desktop'ta <a download>
  // sorunsuz çalışıyor ve paylaşım sayfası açmak gereksiz/rahatsız edici oluyor.
  // iOS Safari'de ise <a download> bazı sürümlerde güvenilir çalışmadığı için
  // dosya paylaşım sayfası üzerinden "Dosyalar"a kaydetme daha sağlam bir yol.
  if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // kullanıcı paylaşımı iptal etti
      // paylaşım başarısız olduysa indirmeye düş
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

dom.btnApprove.addEventListener("click", async () => {
  const errors = validateReport(state.report);
  if (errors.length) return;

  const prefix = dom.recordNameInput.value.trim() || suggestFilenamePrefix(state.report);
  state.report.filenamePrefix = prefix;
  const filename = buildFilename(prefix, state.report.general.tarih);

  dom.btnApprove.disabled = true;
  try {
    const blob = await exportReportBlob(state.report);
    await downloadOrShareBlob(blob, filename);
    const recordName = filename.replace(/\.docx$/i, "");
    storage.saveDraft(state.report, recordName);
    storage.clearAutosave();
    await notify({
      title: "Rapor Oluşturuldu",
      message: `Word dosyası oluşturuldu: ${filename}\nRapor, Ana Menü'deki listenizde kayıtlı kalacak.`,
    });
    showHomeView();
  } catch (err) {
    await notify({ title: "Hata", message: "Word dosyası oluşturulamadı: " + err.message });
  } finally {
    dom.btnApprove.disabled = false;
  }
});

// ---------------- Otomatik kayıt ----------------

setInterval(() => {
  if (state.currentView === "wizard") {
    commitCurrentPage();
    autosave();
  }
}, AUTOSAVE_INTERVAL_MS);

// ---------------- Başlangıç ----------------

async function checkAutosaveOnStart() {
  const autosaved = storage.loadAutosave();
  if (!autosaved) return;
  const hasContent =
    !!(autosaved.general.platform || autosaved.general.testin_amaci || autosaved.flights.length);
  if (!hasContent) {
    storage.clearAutosave();
    return;
  }
  const ok = await notify({
    title: "Kaydedilmemiş Rapor Bulundu",
    message: "Önceki oturumdan kaydedilmemiş bir rapor bulundu. Kaldığınız yerden devam etmek ister misiniz?",
    showNo: true,
  });
  if (ok) {
    state.report = autosaved;
    state.maxReached = 3;
    showWizardView();
    goToStep(0);
  } else {
    storage.clearAutosave();
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // offline ilk kurulumda sessizce yok say; sonraki online açılışta tekrar dener
    });
  }
}

updateOfflineBadge();
showHomeView();
registerServiceWorker();
checkAutosaveOnStart();
