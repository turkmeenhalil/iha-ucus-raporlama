// Rapor verilerinden Word (.docx) dosyası üreten modül.
// app/docx_export.py ile birebir aynı tablo yapısı ve pembe/yeşil renk şeması.
// `docx` kütüphanesi web/vendor/docx.min.js içinde (global `window.docx`) yüklü olmalı.

const {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, ImageRun,
  WidthType, ShadingType, VerticalAlign, BorderStyle, AlignmentType,
  PageNumber, Footer, TableLayoutType,
} = window.docx;

const ACCENT_COLOR = "1F3B57";
const PINK_SHADE = "E3C7C0";
const GREEN_SHADE = "B4C7A0";
const BORDER_COLOR = "8496A6";
const FONT_NAME = "Calibri";

const DOCX_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

const MAX_IMAGE_WIDTH_PX = 460;
const MAX_IMAGE_HEIGHT_PX = 640;

// Uçuş fotoğrafları orijinal kalitede gömülür (yeniden sıkıştırma yok);
// Word içindeki görünür boyut sadece görüntüleme ölçeği, saklanan piksel
// verisini küçültmez. Sadece docx'in desteklemediği formatlar (webp/heic vb.)
// kayıpsız PNG'ye çevrilir.
async function loadImageForDocx(blob) {
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width;
  const height = bitmap.height;

  let type = DOCX_IMAGE_TYPES[blob.type];
  let bytes;
  if (type) {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } else {
    type = "png";
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    bytes = new Uint8Array(await pngBlob.arrayBuffer());
  }
  if (bitmap.close) bitmap.close();
  return { bytes, type, width, height };
}

function scaledImageDims(width, height) {
  let w = width;
  let h = height;
  if (w > MAX_IMAGE_WIDTH_PX) {
    h = Math.round(h * (MAX_IMAGE_WIDTH_PX / w));
    w = MAX_IMAGE_WIDTH_PX;
  }
  if (h > MAX_IMAGE_HEIGHT_PX) {
    w = Math.round(w * (MAX_IMAGE_HEIGHT_PX / h));
    h = MAX_IMAGE_HEIGHT_PX;
  }
  return { width: w, height: h };
}

function cmToDxa(cm) {
  return Math.round(cm * 566.9291338583);
}

const COL_WIDTHS = [cmToDxa(4.15), cmToDxa(4.15), cmToDxa(4.15), cmToDxa(4.15)];
const FLIGHT_COL_WIDTHS = [cmToDxa(3.0), cmToDxa(13.6)];

function cellBorders() {
  const side = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR };
  return { top: side, bottom: side, left: side, right: side };
}

function makeCell(text, { bold = false, shade = null, colSpan = 1, widthDxa } = {}) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    columnSpan: colSpan > 1 ? colSpan : undefined,
    shading: shade ? { fill: shade, type: ShadingType.CLEAR, color: "auto" } : undefined,
    borders: cellBorders(),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || "", bold, font: FONT_NAME, size: 20 })],
      }),
    ],
  });
}

function twoLabelValueRow(label1, value1, label2, value2) {
  const w = COL_WIDTHS[0];
  return new TableRow({
    children: [
      makeCell(label1, { bold: true, shade: PINK_SHADE, widthDxa: w }),
      makeCell(value1, { widthDxa: w }),
      makeCell(label2, { bold: true, shade: PINK_SHADE, widthDxa: w }),
      makeCell(value2, { widthDxa: w }),
    ],
  });
}

function headerRow(cellsSpec) {
  // cellsSpec: [[text, isPink], ...]
  const w = COL_WIDTHS[0];
  return new TableRow({
    children: cellsSpec.map(([text, isPink]) =>
      makeCell(text, { bold: true, shade: isPink ? PINK_SHADE : GREEN_SHADE, widthDxa: w })
    ),
  });
}

function valueRow(values) {
  const w = COL_WIDTHS[0];
  return new TableRow({ children: values.map((v) => makeCell(v, { widthDxa: w })) });
}

function labelValueRow(label, value) {
  const w2 = COL_WIDTHS[0] * 2;
  return new TableRow({
    children: [
      makeCell(label, { bold: true, shade: PINK_SHADE, colSpan: 2, widthDxa: w2 }),
      makeCell(value, { colSpan: 2, widthDxa: w2 }),
    ],
  });
}

function fullWidthHeader(text) {
  const w4 = COL_WIDTHS[0] * 4;
  return new TableRow({
    children: [makeCell(text, { bold: true, shade: GREEN_SHADE, colSpan: 4, widthDxa: w4 })],
  });
}

function fullWidthValue(value) {
  const w4 = COL_WIDTHS[0] * 4;
  return new TableRow({ children: [makeCell(value, { colSpan: 4, widthDxa: w4 })] });
}

function buildHeaderTable(general) {
  const rows = [
    twoLabelValueRow("Tarih:", general.tarih, "Proje:", general.proje),
    headerRow([
      ["Platform", false], ["YKİ", false], ["Test Sahası", false], ["Hava Koşulları", false],
    ]),
    valueRow([general.platform, general.yki, general.test_sahasi, general.hava_kosullari]),
    labelValueRow("Release Matrix Versiyonu:", general.release_matrix_versiyonu),
    headerRow([["OTO", true], ["MCU", true], ["VISAPP", true], ["VISION", true]]),
    valueRow([general.oto, general.mcu, general.visapp, general.vision]),
    headerRow([["GCS", true], ["Tapa", true], ["Kamera/Pod", true], ["CRPA", true]]),
    valueRow([general.gcs, general.tapa, general.kamera_pod, general.crpa]),
    headerRow([["Pervane", true], ["Motor", true], ["ESC", true], ["Batarya", true]]),
    valueRow([general.pervane, general.motor, general.esc, general.batarya]),
    headerRow([
      ["Kerkes App", true], ["Kerkes Vision Eng", true], ["SCU", true], ["SCS", true],
    ]),
    valueRow([general.kerkes_app, general.kerkes_vision_eng, general.scu, general.scs]),
    fullWidthHeader("Test Ekibi"),
    fullWidthValue(general.test_ekibi),
    fullWidthHeader("Testin Amacı"),
    fullWidthValue(general.testin_amaci),
  ];

  return new Table({
    rows,
    columnWidths: COL_WIDTHS,
    width: { size: COL_WIDTHS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
  });
}

function notesCell(paragraphs, widthDxa) {
  return new TableCell({
    width: { size: widthDxa, type: WidthType.DXA },
    borders: cellBorders(),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: paragraphs,
  });
}

async function buildFlightsTable(flights) {
  const [w1, w2] = FLIGHT_COL_WIDTHS;
  const rows = [
    new TableRow({
      children: [makeCell("Uçuşlar", { bold: true, shade: GREEN_SHADE, colSpan: 2, widthDxa: w1 + w2 })],
    }),
  ];

  if (!flights.length) {
    rows.push(
      new TableRow({
        children: [makeCell("Bu rapora henüz uçuş eklenmemiştir.", { colSpan: 2, widthDxa: w1 + w2 })],
      })
    );
  } else {
    for (let i = 0; i < flights.length; i++) {
      const flight = flights[i];
      const paragraphs = [];
      for (const block of flight.blocks) {
        if (block.type === "photo") {
          const { bytes, type, width, height } = await loadImageForDocx(block.blob);
          const { width: dw, height: dh } = scaledImageDims(width, height);
          paragraphs.push(
            new Paragraph({
              spacing: { before: 100, after: 100 },
              children: [new ImageRun({ data: bytes, type, transformation: { width: dw, height: dh } })],
            })
          );
        } else if (block.text) {
          paragraphs.push(
            new Paragraph({ children: [new TextRun({ text: block.text, font: FONT_NAME, size: 20 })] })
          );
        }
      }
      if (!paragraphs.length) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: "", font: FONT_NAME, size: 20 })] }));
      }
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [makeCell(`Uçuş ${i + 1}:`, { bold: true, widthDxa: w1 }), notesCell(paragraphs, w2)],
        })
      );
    }
  }

  return new Table({
    rows,
    columnWidths: FLIGHT_COL_WIDTHS,
    width: { size: w1 + w2, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
  });
}

async function buildDocument(report) {
  const headerTable = buildHeaderTable(report.general);
  const flightsTable = await buildFlightsTable(report.flights);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT_NAME, size: 22 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: cmToDxa(2),
              bottom: cmToDxa(2),
              left: cmToDxa(2.2),
              right: cmToDxa(2.2),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Sayfa ", size: 18, font: FONT_NAME }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT_NAME }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: "İHA UÇUŞ VE TEST RAPORU",
                bold: true,
                size: 32,
                font: FONT_NAME,
                color: ACCENT_COLOR,
              }),
            ],
          }),
          headerTable,
          new Paragraph({ spacing: { after: 120 }, children: [] }),
          flightsTable,
        ],
      },
    ],
  });

  return doc;
}

function cleanFilenamePart(value) {
  return (value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "");
}

export function suggestFilenamePrefix(report) {
  const platform = cleanFilenamePart(report.general.platform) || "Platform";
  const proje = cleanFilenamePart(report.general.proje) || "Proje";
  return `${platform}_${proje}_UcusRaporu`;
}

export function buildFilename(prefix, tarih) {
  const cleanPrefix = cleanFilenamePart(prefix) || "Rapor";
  const cleanTarih = cleanFilenamePart(tarih) || "Tarihsiz";
  return `${cleanPrefix}_${cleanTarih}.docx`;
}

export async function exportReportBlob(report) {
  const doc = await buildDocument(report);
  return Packer.toBlob(doc);
}
