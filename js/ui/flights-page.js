// Adım 2: Uçuşlar listesi (app/ui/flights_page.py karşılığı).

function summarize(flight, index) {
  let notOzet = (flight.notlar || "").trim().replace(/\n/g, " ");
  if (notOzet.length > 90) notOzet = notOzet.slice(0, 90) + "...";
  return `Uçuş ${index}\n${notOzet || "(Not girilmedi)"}`;
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
  const idx = flights.findIndex((f) => f.id === selectedId);
  const hasSelection = idx !== -1;
  buttons.editBtn.disabled = !hasSelection;
  buttons.deleteBtn.disabled = !hasSelection;
  buttons.upBtn.disabled = !hasSelection || idx <= 0;
  buttons.downBtn.disabled = !hasSelection || idx === -1 || idx >= flights.length - 1;
}
