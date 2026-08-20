// Adım 2: Uçuşlar listesi (app/ui/flights_page.py karşılığı).

import { flightText, flightPhotoCount } from "../models.js";

function summarize(flight, index) {
  let notOzet = flightText(flight).replace(/\n/g, " ");
  if (notOzet.length > 90) notOzet = notOzet.slice(0, 90) + "...";
  const photoCount = flightPhotoCount(flight);
  const photoSuffix = photoCount ? ` · 📷 ${photoCount}` : "";
  return `Uçuş ${index}${photoSuffix}\n${notOzet || "(Not girilmedi)"}`;
}

export function renderFlightsList(listEl, emptyEl, flights, selectedId) {
  listEl.innerHTML = "";
  flights.forEach((flight, i) => {
    const li = document.createElement("li");
    li.textContent = summarize(flight, i + 1);
    li.dataset.id = flight.id;
    if (flight.id === selectedId) li.classList.add("selected");
    listEl.appendChild(li);
  });
  const empty = flights.length === 0;
  emptyEl.hidden = !empty;
  listEl.hidden = empty;
}

export function updateFlightButtonStates(buttons, flights, selectedId) {
  const hasSelection = flights.some((f) => f.id === selectedId);
  buttons.editBtn.disabled = !hasSelection;
  buttons.deleteBtn.disabled = !hasSelection;
}
