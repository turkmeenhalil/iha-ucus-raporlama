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

export function createFlight(data = {}) {
  return {
    id: data.id || uuid4(),
    notlar: data.notlar ?? "",
  };
}

function nowIso() {
  return new Date().toISOString().slice(0, 19);
}

export function createReport(data = {}) {
  return {
    general: createGeneralInfo(data.general || {}),
    flights: (data.flights || []).map(createFlight),
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

export function moveFlight(report, flightId, direction) {
  const idx = report.flights.findIndex((f) => f.id === flightId);
  if (idx === -1) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= report.flights.length) return;
  const tmp = report.flights[idx];
  report.flights[idx] = report.flights[newIdx];
  report.flights[newIdx] = tmp;
}
