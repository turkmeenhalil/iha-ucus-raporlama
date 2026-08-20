// Rapor veri modelleri (app/models.py birebir karşılığı).

export const GENERAL_INFO_FIELDS = [
  "tarih", "proje", "platform", "yki", "test_sahasi", "hava_kosullari",
  "release_matrix_versiyonu", "oto", "mcu", "visapp", "vision",
  "gcs", "tapa", "kamera_pod", "crpa", "pervane", "motor", "esc", "batarya",
  "kerkes_app", "kerkes_vision_eng", "scu", "scs", "test_ekibi", "testin_amaci",
];

export function createGeneralInfo(data = {}) {
  const general = {};
  for (const key of GENERAL_INFO_FIELDS) {
    general[key] = data[key] ?? "";
  }
  return general;
}

function uuid4() {
  if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export function createBlock(data = {}) {
  if (data.type === "photo") {
    return { id: data.id || uuid4(), type: "photo", blob: data.blob, name: data.name || "" };
  }
  return { id: data.id || uuid4(), type: "text", text: data.text ?? "" };
}

// Uçuş içeriği, girildiği sırayla metin ve fotoğraf bloklarından oluşur
// (metin - görsel - metin - görsel ...). Eski kayıtlarda (notlar + photos)
// bu yapı otomatik olarak bloklara çevrilir.
export function createFlight(data = {}) {
  let rawBlocks = data.blocks;
  if (!rawBlocks) {
    rawBlocks = [];
    if (data.notlar) rawBlocks.push({ type: "text", text: data.notlar });
    for (const p of data.photos || []) rawBlocks.push({ type: "photo", id: p.id, blob: p.blob, name: p.name });
  }
  const blocks = rawBlocks.map(createBlock);
  if (!blocks.length) blocks.push(createBlock({ type: "text", text: "" }));
  return {
    id: data.id || uuid4(),
    blocks,
  };
}

export function flightText(flight) {
  return flight.blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export function flightPhotoCount(flight) {
  return flight.blocks.filter((b) => b.type === "photo").length;
}

function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

export function createReport(data = {}) {
  return {
    general: createGeneralInfo(data.general || {}),
    flights: (data.flights || []).map(createFlight),
    filenamePrefix: data.filenamePrefix || "",
    created_at: data.created_at || nowIso(),
    updated_at: data.updated_at || nowIso(),
  };
}

export function addFlight(report, flight = null) {
  const newFlight = flight || createFlight();
  report.flights.push(newFlight);
  return newFlight;
}

export function removeFlight(report, flightId) {
  report.flights = report.flights.filter((f) => f.id !== flightId);
}
