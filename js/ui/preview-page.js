// Adım 3: Rapor Önizleme (app/ui/preview_page.py karşılığı) —
// docx çıktısıyla birebir aynı pembe/yeşil renk şeması.

function e(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function twoLabelValueRow(l1, v1, l2, v2) {
  return `<tr>
    <td class="label-pink">${e(l1)}</td><td>${e(v1)}</td>
    <td class="label-pink">${e(l2)}</td><td>${e(v2)}</td>
  </tr>`;
}

function headerRow(cellsSpec) {
  return `<tr>${cellsSpec
    .map(([text, isPink]) => `<td class="${isPink ? "label-pink" : "label-green"}">${e(text)}</td>`)
    .join("")}</tr>`;
}

function valueRow(values) {
  return `<tr>${values.map((v) => `<td>${e(v)}</td>`).join("")}</tr>`;
}

function labelValueRow(label, value) {
  return `<tr>
    <td class="label-pink" colspan="2">${e(label)}</td>
    <td colspan="2">${e(value)}</td>
  </tr>`;
}

function fullWidthHeader(text) {
  return `<tr><td class="label-green" colspan="4">${e(text)}</td></tr>`;
}

function fullWidthValue(value) {
  return `<tr><td colspan="4">${e(value)}</td></tr>`;
}

export function buildPreviewHtml(report) {
  const g = report.general;
  let rows = "";
  rows += twoLabelValueRow("Tarih:", g.tarih, "Proje:", g.proje);
  rows += headerRow([["Platform", false], ["YKİ", false], ["Test Sahası", false], ["Hava Koşulları", false]]);
  rows += valueRow([g.platform, g.yki, g.test_sahasi, g.hava_kosullari]);
  rows += labelValueRow("Release Matrix Versiyonu:", g.release_matrix_versiyonu);
  rows += headerRow([["OTO", true], ["MCU", true], ["VISAPP", true], ["VISION", true]]);
  rows += valueRow([g.oto, g.mcu, g.visapp, g.vision]);
  rows += headerRow([["GCS", true], ["Tapa", true], ["Kamera/Pod", true], ["CRPA", true]]);
  rows += valueRow([g.gcs, g.tapa, g.kamera_pod, g.crpa]);
  rows += headerRow([["Pervane", true], ["Motor", true], ["ESC", true], ["Batarya", true]]);
  rows += valueRow([g.pervane, g.motor, g.esc, g.batarya]);
  rows += headerRow([["Kerkes App", true], ["Kerkes Vision Eng", true], ["SCU", true], ["SCS", true]]);
  rows += valueRow([g.kerkes_app, g.kerkes_vision_eng, g.scu, g.scs]);
  rows += fullWidthHeader("Test Ekibi");
  rows += fullWidthValue(g.test_ekibi);
  rows += fullWidthHeader("Testin Amacı");
  rows += fullWidthValue(g.testin_amaci);

  let flightRows = "";
  if (!report.flights.length) {
    flightRows = `<tr><td colspan="2"><i>Bu rapora henüz uçuş eklenmemiştir.</i></td></tr>`;
  } else {
    report.flights.forEach((flight, i) => {
      flightRows += `<tr>
        <td class="flight-label">Uçuş ${i + 1}:</td>
        <td class="flight-notes">${e(flight.notlar)}</td>
      </tr>`;
    });
  }

  return `
    <div class="preview-doc-title">İHA UÇUŞ VE TEST RAPORU</div>
    <table class="preview-table">${rows}</table>
    <table class="preview-table">
      <tr><td class="label-green" colspan="2">Uçuşlar</td></tr>
      ${flightRows}
    </table>
  `;
}
