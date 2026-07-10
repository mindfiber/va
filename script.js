const API_URL = "https://script.google.com/macros/s/AKfycbz7ENnKE3-h8njG21Y2XYIEFNaEtplfQErzedQy_gZ8-H1T7LnYZiTjQhjdSIAqaJOS/exec";

const PEOPLE = ["Calvin", "Jessica", "Issac", "수진", "여원", "경오", "대표"];
const DURATIONS = [
  { label: "안씀", value: 0 },
  { label: "1일", value: 1 },
  { label: "2일", value: 2 },
  { label: "3일", value: 3 },
  { label: "4일", value: 4 },
  { label: "5일", value: 5 },
];
const COLORS = {
  Calvin: "#2563eb",
  Jessica: "#db2777",
  Issac: "#059669",
  "수진": "#7c3aed",
  "여원": "#ea580c",
  "경오": "#0891b2",
  "대표": "#4b5563",
};

const personButtonsEl = document.getElementById("personButtons");
const durationButtonsEl = document.getElementById("durationButtons");
const resetButton = document.getElementById("resetButton");
const saveButton = document.getElementById("saveButton");
const statusEl = document.getElementById("status");
const calendarEl = document.getElementById("calendar");
const monthTitleEl = document.getElementById("monthTitle");
const legendEl = document.getElementById("legend");
const selectionSummaryEl = document.getElementById("selectionSummary");
const draftListEl = document.getElementById("draftList");
const prevMonthButton = document.getElementById("prevMonth");
const nextMonthButton = document.getElementById("nextMonth");

let vacations = [];
let holidays = {};
let statuses = {};
let current = new Date();
current.setDate(1);
let selectedPerson = "";
let selectedDuration = 1;
let selectedStartDate = "";
let draftPeriods = [];
let saving = false;

init();

function init() {
  renderPersonButtons();
  renderDurationButtons();
  renderLegend();
  renderCalendar();
  updateSelectionState();

  prevMonthButton.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    renderCalendar();
    if (isApiConfigured()) loadData();
  });

  nextMonthButton.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    renderCalendar();
    if (isApiConfigured()) loadData();
  });

  resetButton.addEventListener("click", handleReset);
  saveButton.addEventListener("click", handleSave);

  if (isApiConfigured()) {
    loadData();
  } else {
    setStatus("Apps Script 웹 앱 URL을 script.js의 API_URL에 설정해야 합니다. / Set the Apps Script web app URL in API_URL.", "error");
  }
}

function renderPersonButtons() {
  personButtonsEl.innerHTML = PEOPLE.map((person) => {
    const color = COLORS[person] || "#172033";
    const status = statuses[person] === "none" ? `<span class="chip-status">안씀</span>` : "";
    return `<button class="chip person-chip" type="button" data-person="${escapeHtml(person)}" style="--chip-color:${color}"><span>${escapeHtml(person)}</span>${status}</button>`;
  }).join("");

  personButtonsEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPerson = button.dataset.person;
      draftPeriods = vacations
        .filter((vacation) => vacation.name === selectedPerson)
        .map((vacation) => ({ ...vacation }));
      selectedStartDate = "";
      selectedDuration = statuses[selectedPerson] === "none" ? 0 : Math.min(remainingDays() || 1, 5);
      syncControlState();
      renderCalendar();
      updateSelectionState();
    });
  });
}

function renderDurationButtons() {
  durationButtonsEl.innerHTML = DURATIONS.map((duration) => {
    return `<button class="chip duration-chip" type="button" data-duration="${duration.value}">${duration.label}</button>`;
  }).join("");

  durationButtonsEl.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDuration = Number(button.dataset.duration);
      if (selectedDuration === 0) selectedStartDate = "";
      syncControlState();
      renderCalendar();
      updateSelectionState();
    });
  });
}

function syncControlState() {
  personButtonsEl.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.person === selectedPerson);
  });

  durationButtonsEl.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.duration) === selectedDuration);
  });
}

async function handleSave() {
  if (saving) return;

  const validationError = validateSave();
  if (validationError) {
    setStatus(validationError, "error");
    return;
  }

  const payload = selectedDuration === 0
    ? { action: "clear", name: selectedPerson }
    : { action: "saveAll", name: selectedPerson, periods: draftPeriods.map(({ startDate, duration }) => ({ startDate, duration })) };

  saving = true;
  saveButton.disabled = true;
  setStatus("저장 중입니다. Google Sheets 반영에 몇 초 걸릴 수 있습니다. / Saving. Google Sheets may take a few seconds to update.", "loading");

  try {
    await postPayload(payload);
    setStatus(selectedDuration === 0 ? "휴가를 안쓰는 것으로 저장했습니다. / Saved as not using vacation." : "저장했습니다. 달력을 새로 불러왔습니다. / Saved and refreshed the calendar.", "success");
  } catch (error) {
    setStatus(error.message || "저장 중 오류가 발생했습니다. / An error occurred while saving.", "error");
  } finally {
    saving = false;
    updateSelectionState();
  }
}

async function handleReset() {
  if (saving) return;
  if (!PEOPLE.includes(selectedPerson)) {
    setStatus("이름을 먼저 선택해주세요. / Select your name first.", "error");
    return;
  }

  saving = true;
  resetButton.disabled = true;
  saveButton.disabled = true;
  setStatus("초기화 중입니다. Google Sheets 반영에 몇 초 걸릴 수 있습니다. / Resetting. Google Sheets may take a few seconds to update.", "loading");

  try {
    await postPayload({ action: "reset", name: selectedPerson });
    draftPeriods = [];
    selectedStartDate = "";
    selectedDuration = 1;
    delete statuses[selectedPerson];
    syncControlState();
    renderPersonButtons();
    syncControlState();
    renderCalendar();
    updateSelectionState();
    setStatus("초기화했습니다. / Reset complete.", "success");
  } catch (error) {
    setStatus(error.message || "초기화 중 오류가 발생했습니다. / An error occurred while resetting.", "error");
  } finally {
    saving = false;
    updateSelectionState();
  }
}

function removeDraftPeriod(index) {
  draftPeriods.splice(index, 1);
  selectedDuration = Math.min(remainingDays() || 1, 5);
  syncControlState();
  renderCalendar();
  updateSelectionState();
}

function addSelectedPeriod() {
  const validationError = validatePeriodSelection();
  if (validationError) {
    setStatus(validationError, "error");
    return false;
  }

  const startDate = nextBusinessDate(selectedStartDate);
  const endDate = businessEndDate(startDate, selectedDuration);
  draftPeriods.push({ name: selectedPerson, startDate, duration: selectedDuration, endDate });
  selectedStartDate = "";
  selectedDuration = Math.min(remainingDays() || 1, 5);
  syncControlState();
  renderCalendar();
  updateSelectionState();
  setStatus("구간을 추가했습니다. 저장을 눌러야 시트에 반영됩니다. / Period added. Click Save to update Google Sheets.", "loading");
  return true;
}

function validatePeriodSelection() {
  if (!PEOPLE.includes(selectedPerson)) return "이름을 먼저 선택해주세요. / Select your name first.";
  if (selectedDuration === 0) return "안씀은 날짜 선택 없이 저장 버튼을 누르세요. / For Not using, click Save without selecting a date.";
  if (![1, 2, 3, 4, 5].includes(selectedDuration)) return "휴가 일수를 선택해주세요. / Select vacation days.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedStartDate)) return "달력에서 시작일을 선택해주세요. / Select a start date on the calendar.";
  if (usedDays() + selectedDuration > 5) return "선택한 일수가 총 5일을 넘습니다. 5일 이하로 설정해주세요. / Selected days exceed 5 total days. Please set 5 days or fewer.";
  if (overlapsExistingDraft(nextBusinessDate(selectedStartDate), selectedDuration)) return "이미 선택한 구간과 겹칩니다. / This overlaps with an already selected period.";
  return "";
}

function validateSave() {
  if (!PEOPLE.includes(selectedPerson)) return "이름을 먼저 선택해주세요. / Select your name first.";
  if (selectedDuration === 0) return "";
  if (!draftPeriods.length) return "저장할 휴가 구간을 먼저 추가해주세요. / Add at least one vacation period before saving.";
  if (usedDays() > 5) return "한 사람당 총 5일까지만 저장할 수 있습니다. / You can save up to 5 total days per person.";
  return "";
}

async function loadData() {
  if (!isApiConfigured()) return;
  setStatus("달력을 불러오는 중입니다. / Loading calendar.", "loading");

  try {
    const data = await getJsonp({ action: "list", year: current.getFullYear(), t: Date.now() });
    vacations = Array.isArray(data) ? data : data.vacations || [];
    holidays = normalizeHolidays(Array.isArray(data) ? [] : data.holidays || []);
    statuses = normalizeStatuses(Array.isArray(data) ? [] : data.statuses || []);
    if (selectedPerson) {
      draftPeriods = vacations
        .filter((vacation) => vacation.name === selectedPerson)
        .map((vacation) => ({ ...vacation }));
    }
    renderPersonButtons();
    syncControlState();
    renderCalendar();
    updateSelectionState();
    setStatus(vacations.length ? "달력을 불러왔습니다. / Calendar loaded." : "등록된 휴가가 없습니다. / No vacation periods have been saved yet.", "success");
  } catch (error) {
    setStatus("달력을 불러오지 못했습니다. Apps Script 배포 URL과 권한을 확인해주세요. / Failed to load. Check the Apps Script URL and permissions.", "error");
  }
}

async function postPayload(payload) {
  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new Error("저장 요청을 보내지 못했습니다. 네트워크 상태를 확인해주세요. / Could not send the save request. Check the network connection.");
  }

  await wait(900);
  await loadData();
}

function getJsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName = `vacationCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const url = new URL(API_URL);

    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set("callback", callbackName);

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("조회 시간이 초과되었습니다."));
    }, 10000);

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("조회 요청이 실패했습니다."));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

function renderLegend() {
  legendEl.innerHTML = PEOPLE.map((person) => {
    return `<span class="legend-item"><span class="swatch" style="background:${COLORS[person]}"></span>${escapeHtml(person)}</span>`;
  }).join("");
}

function renderCalendar() {
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

  monthTitleEl.textContent = `${year}년 ${month + 1}월`;
  calendarEl.innerHTML = "";

  for (let cell = 0; cell < totalCells; cell += 1) {
    const dayNumber = cell - startOffset + 1;
    const inMonth = dayNumber >= 1 && dayNumber <= lastDay.getDate();
    const dateKey = inMonth ? toDateKey(year, month + 1, dayNumber) : "";
    const dayVacations = inMonth ? vacationsForDate(dateKey) : [];
    const holidayName = inMonth ? holidays[dateKey] : "";
    const dayEl = document.createElement("button");

    dayEl.type = "button";
    dayEl.disabled = !inMonth;
    dayEl.className = dayClassName(inMonth, dateKey, dayVacations);
    const dayStyle = dayStyleForDate(dateKey, dayVacations);
    if (dayStyle) dayEl.setAttribute("style", dayStyle);
    dayEl.innerHTML = inMonth
      ? `<span class="day-number">${dayNumber}</span>${holidayName ? `<span class="holiday-name">${escapeHtml(holidayName)}</span>` : ""}<span class="vacation-list">${dayVacations.map(renderVacation).join("")}</span>`
      : "";

    if (inMonth) {
      dayEl.addEventListener("click", () => selectDate(dateKey));
    }

    calendarEl.appendChild(dayEl);
  }
}

function selectDate(dateKey) {
  if (!selectedPerson) {
    setStatus("이름을 먼저 선택해주세요. / Select your name first.", "error");
    return;
  }

  if (selectedDuration === 0) {
    setStatus("안씀은 날짜 선택이 필요 없습니다. 저장 버튼을 누르면 기존 일정이 삭제됩니다. / Not using does not need a date. Save will clear existing periods.", "loading");
    return;
  }

  const adjustedDate = nextBusinessDate(dateKey);
  selectedStartDate = adjustedDate;
  if (adjustedDate !== dateKey) {
    setStatus(`${shortDate(dateKey)}은 쉬는 날이라 ${shortDate(adjustedDate)}부터 계산합니다. / ${shortDate(dateKey)} is a day off, so counting starts from ${shortDate(adjustedDate)}.`, "loading");
  }
  addSelectedPeriod();
}

function dayClassName(inMonth, dateKey, dayVacations = []) {
  const classes = ["day"];
  if (!inMonth) classes.push("muted");
  if (dateKey && isWeekend(dateKey)) classes.push("weekend");
  if (dateKey && holidays[dateKey]) classes.push("holiday");
  if (dateKey === todayKey()) classes.push("today");
  if (dayVacations.length) classes.push("saved-day");
  if (dateKey && isPreviewDate(dateKey)) classes.push("preview");
  if (dateKey && dateKey === selectedStartDate && selectedDuration > 0) classes.push("selected-start");
  return classes.join(" ");
}

function dayStyleForDate(dateKey, dayVacations = []) {
  if (!dateKey) return "";

  if (isPreviewDate(dateKey) && selectedPerson) {
    const color = COLORS[selectedPerson] || "#ea580c";
    const rgb = hexToRgb(color);
    if (!rgb) return `--preview-color:${color}`;
    return `--preview-color:${color};--preview-bg:rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`;
  }

  if (!dayVacations.length) return "";

  if (dayVacations.length === 1) {
    const color = COLORS[dayVacations[0].name] || "#4b5563";
    const rgb = hexToRgb(color);
    if (!rgb) return `--saved-color:${color}`;
    return `--saved-color:${color};--saved-bg:rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`;
  }

  const stripe = dayVacations
    .map((vacation, index) => {
      const color = COLORS[vacation.name] || "#4b5563";
      const start = Math.round((index / dayVacations.length) * 100);
      const end = Math.round(((index + 1) / dayVacations.length) * 100);
      return `${color} ${start}% ${end}%`;
    })
    .join(", ");
  return `--saved-color:#667085;--saved-bg:linear-gradient(90deg, ${stripe})`;
}

function renderVacation(vacation) {
  const color = COLORS[vacation.name] || "#4b5563";
  const label = `${vacation.name} ${shortDate(vacation.startDate)}-${shortDate(vacation.endDate)}`;
  const selectedClass = vacation.name === selectedPerson ? " own" : "";
  return `<span class="vacation${selectedClass}" style="background:${color}" title="${escapeHtml(label)}">${escapeHtml(vacation.name)}</span>`;
}

function vacationsForDate(dateKey) {
  if (!isBusinessDate(dateKey)) return [];
  return visibleVacations()
    .filter((vacation) => vacation.startDate <= dateKey && vacation.endDate >= dateKey)
    .sort((a, b) => PEOPLE.indexOf(a.name) - PEOPLE.indexOf(b.name));
}

function visibleVacations() {
  if (!selectedPerson) return vacations;
  return vacations
    .filter((vacation) => vacation.name !== selectedPerson)
    .concat(draftPeriods);
}

function usedDays() {
  return draftPeriods.reduce((total, period) => total + Number(period.duration || 0), 0);
}

function remainingDays() {
  return Math.max(0, 5 - usedDays());
}

function overlapsExistingDraft(startDate, duration) {
  const newDates = businessDatesFrom(startDate, duration);
  return draftPeriods.some((period) => {
    const existingDates = businessDatesFrom(period.startDate, period.duration);
    return newDates.some((dateKey) => existingDates.includes(dateKey));
  });
}

function isPreviewDate(dateKey) {
  if (!selectedStartDate || selectedDuration <= 0) return false;
  return businessDatesFrom(selectedStartDate, selectedDuration).includes(dateKey);
}

function hexToRgb(hex) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function updateSelectionState() {
  renderDraftList();
  const canSave = !saving && !validateSave();
  resetButton.disabled = saving || !PEOPLE.includes(selectedPerson);
  saveButton.disabled = !canSave;

  if (!selectedPerson) {
    selectionSummaryEl.textContent = "이름을 선택한 뒤 달력 날짜를 누르세요. / Select your name, then click a date on the calendar.";
    return;
  }

  if (selectedDuration === 0) {
    selectionSummaryEl.textContent = `${selectedPerson}: 휴가 안씀 / Not using vacation`;
    return;
  }

  if (!selectedStartDate) {
    selectionSummaryEl.textContent = `${selectedPerson}: ${usedDays()}/5일 선택됨. ${selectedDuration}일 구간의 시작일을 달력에서 선택하세요. / ${usedDays()}/5 days selected. Choose the start date for a ${selectedDuration}-day period.`;
    return;
  }

  const endDate = businessEndDate(selectedStartDate, selectedDuration);
  selectionSummaryEl.textContent = `${selectedPerson}: ${shortDate(nextBusinessDate(selectedStartDate))}부터 ${selectedDuration}일 (${shortDate(endDate)}까지), 총 ${usedDays() + selectedDuration}/5일 / ${selectedDuration} days from ${shortDate(nextBusinessDate(selectedStartDate))} to ${shortDate(endDate)}, total ${usedDays() + selectedDuration}/5 days`;
}

function renderDraftList() {
  if (!selectedPerson) {
    draftListEl.innerHTML = "";
    return;
  }

  if (selectedDuration === 0) {
    draftListEl.innerHTML = `<p class="draft-empty">저장하면 ${escapeHtml(selectedPerson)}의 기존 휴가가 모두 삭제됩니다. / Saving will clear all existing vacation periods for ${escapeHtml(selectedPerson)}.</p>`;
    return;
  }

  if (!draftPeriods.length) {
    draftListEl.innerHTML = `<p class="draft-empty">아직 추가한 구간이 없습니다. / No periods added yet.</p>`;
    return;
  }

  draftListEl.innerHTML = draftPeriods.map((period, index) => {
    return `
      <div class="draft-item">
        <span>${escapeHtml(period.name)} ${shortDate(period.startDate)}-${shortDate(period.endDate)} (${period.duration}일)</span>
        <button type="button" data-remove-index="${index}">삭제 / Remove</button>
      </div>
    `;
  }).join("");

  draftListEl.querySelectorAll("button[data-remove-index]").forEach((button) => {
    button.addEventListener("click", () => removeDraftPeriod(Number(button.dataset.removeIndex)));
  });
}

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey() {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function addDays(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return toDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function businessDatesFrom(startDate, duration) {
  const dates = [];
  let cursor = nextBusinessDate(startDate);
  while (dates.length < duration) {
    if (isBusinessDate(cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function businessEndDate(startDate, duration) {
  const dates = businessDatesFrom(startDate, duration);
  return dates[dates.length - 1] || startDate;
}

function nextBusinessDate(dateKey) {
  let cursor = dateKey;
  while (!isBusinessDate(cursor)) {
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function isBusinessDate(dateKey) {
  return !isWeekend(dateKey) && !holidays[dateKey];
}

function isWeekend(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function normalizeHolidays(items) {
  return items.reduce((map, item) => {
    if (item && item.date) map[item.date] = item.name || "공휴일";
    return map;
  }, {});
}

function normalizeStatuses(items) {
  return items.reduce((map, item) => {
    if (item && item.name) map[item.name] = item.status;
    return map;
  }, {});
}

function shortDate(dateKey) {
  return dateKey ? dateKey.slice(5).replace("-", ".") : "";
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function isApiConfigured() {
  return API_URL && !API_URL.includes("PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
