// Rapor onaylanmadan önce yapılan zorunlu alan kontrolleri (app/validation.py birebir karşılığı).

export const GENERAL_REQUIRED_FIELDS = [
  ["platform", "Platform"],
  ["tarih", "Tarih"],
  ["testin_amaci", "Testin Amacı"],
];

export function validateGeneral(general) {
  const errors = [];
  for (const [fieldName, label] of GENERAL_REQUIRED_FIELDS) {
    const value = (general[fieldName] || "").trim();
    if (!value) errors.push(`⚠ ${label} alanı boş bırakılamaz.`);
  }
  return errors;
}

export function validateFlight(flight, index) {
  const errors = [];
  if (!(flight.notlar || "").trim()) {
    errors.push(`⚠ Uçuş ${index}: Uçuş Notları alanı doldurulmalıdır.`);
  }
  return errors;
}

export function validateReport(report) {
  let errors = validateGeneral(report.general);
  if (!report.flights.length) {
    errors.push("⚠ Rapora en az bir uçuş eklenmelidir.");
  }
  report.flights.forEach((flight, i) => {
    errors = errors.concat(validateFlight(flight, i + 1));
  });
  return errors;
}
