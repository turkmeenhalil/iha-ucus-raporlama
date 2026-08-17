// Ana Menü: taslak listesi (app/ui/home.py karşılığı).

export function renderDraftsList(listEl, emptyEl, drafts, selectedKey) {
  listEl.innerHTML = "";
  drafts.forEach((draft) => {
    const li = document.createElement("li");
    let label = `${draft.name} — ${draft.updated_at}`;
    if (draft.platform) label = `${draft.name} — ${draft.platform} (${draft.updated_at})`;
    li.textContent = label;
    li.dataset.key = draft.key;
    if (draft.key === selectedKey) li.classList.add("selected");
    listEl.appendChild(li);
  });
  const empty = drafts.length === 0;
  emptyEl.hidden = !empty;
  listEl.hidden = empty;
}

export function updateDraftButtonStates(buttons, hasSelection) {
  buttons.openBtn.disabled = !hasSelection;
  buttons.deleteBtn.disabled = !hasSelection;
}
