const SPREADSHEET_ID = "1NgJFVrwAXWzxc4U9363-FhU-7k5vdx5tmv32F8AuDzM";
const SHEET_NAME = "Vacation";
const HEADERS = ["name", "startDate", "duration", "endDate", "updatedAt"];
const ALLOWED_NAMES = ["Calvin", "Jessica", "Issac", "수진", "여원", "경오", "대표", "고문님"];
const ALLOWED_DURATIONS = [1, 2, 3, 4, 5];
const HOLIDAY_CALENDAR_ID = "ko.south_korea#holiday@group.v.calendar.google.com";
var HOLIDAY_CACHE = {};

function doGet(e) {
  try {
    setupSheet_();
    const action = String((e.parameter && e.parameter.action) || "list");
    if (action !== "list") return output_({ ok: false, message: "지원하지 않는 요청입니다." }, e);
    const year = Number(e.parameter && e.parameter.year) || new Date().getFullYear();
    return output_({
      vacations: getVacations_(),
      statuses: getStatuses_(),
      holidays: getHolidays_(year - 1, year + 1),
    }, e);
  } catch (error) {
    return output_({ ok: false, message: error.message || "조회 중 오류가 발생했습니다." }, e);
  }
}

function doPost(e) {
  try {
    setupSheet_();
    const payload = parsePayload_(e);
    if (payload.action === "save") return output_(saveVacation_(payload), e);
    if (payload.action === "saveAll") return output_(saveAllVacations_(payload), e);
    if (payload.action === "clear") return output_(clearVacation_(payload), e);
    if (payload.action === "reset") return output_(resetVacation_(payload), e);
    return output_({ ok: false, message: "지원하지 않는 요청입니다." }, e);
  } catch (error) {
    return output_({ ok: false, message: error.message || "저장 중 오류가 발생했습니다." }, e);
  }
}

function setupSheet_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const needsHeader = HEADERS.some((header, index) => currentHeaders[index] !== header);
  if (needsHeader) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function saveVacation_(payload) {
  const name = String(payload.name || "").trim();
  const startDate = String(payload.startDate || "").trim();
  const duration = Number(payload.duration);

  validateVacation_(name, startDate, duration);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    const adjustedStartDate = nextBusinessDate_(startDate);
    const endDate = calcBusinessEndDate_(adjustedStartDate, duration);
    const now = new Date();
    let targetRow = 0;

    for (let i = 1; i < rows.length; i += 1) {
      if (String(rows[i][0]).trim() === name) {
        if (!targetRow) {
          targetRow = i + 1;
        } else {
          sheet.deleteRow(i + 1);
          i -= 1;
          rows.splice(i, 1);
        }
      }
    }

    const values = [[name, adjustedStartDate, duration, endDate, now]];
    if (targetRow) {
      sheet.getRange(targetRow, 1, 1, HEADERS.length).setValues(values);
      return { ok: true, mode: "updated", vacation: { name, startDate: adjustedStartDate, duration, endDate } };
    }

    sheet.appendRow(values[0]);
    return { ok: true, mode: "created", vacation: { name, startDate: adjustedStartDate, duration, endDate } };
  } finally {
    lock.releaseLock();
  }
}

function clearVacation_(payload) {
  const name = String(payload.name || "").trim();
  if (!ALLOWED_NAMES.includes(name)) throw new Error("허용되지 않은 이름입니다.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    let deleted = 0;

    for (let i = rows.length - 1; i >= 1; i -= 1) {
      if (String(rows[i][0]).trim() === name) {
        sheet.deleteRow(i + 1);
        deleted += 1;
      }
    }

    sheet.appendRow([name, "", 0, "", new Date()]);
    return { ok: true, mode: "cleared", name, deleted };
  } finally {
    lock.releaseLock();
  }
}

function resetVacation_(payload) {
  const name = String(payload.name || "").trim();
  if (!ALLOWED_NAMES.includes(name)) throw new Error("허용되지 않은 이름입니다.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    let deleted = 0;

    for (let i = rows.length - 1; i >= 1; i -= 1) {
      if (String(rows[i][0]).trim() === name) {
        sheet.deleteRow(i + 1);
        deleted += 1;
      }
    }

    return { ok: true, mode: "reset", name, deleted };
  } finally {
    lock.releaseLock();
  }
}

function saveAllVacations_(payload) {
  const name = String(payload.name || "").trim();
  const periods = Array.isArray(payload.periods) ? payload.periods : [];
  if (!ALLOWED_NAMES.includes(name)) throw new Error("허용되지 않은 이름입니다.");
  if (!periods.length) throw new Error("저장할 휴가 구간이 없습니다.");

  const normalized = periods.map((period) => {
    const startDate = String(period.startDate || "").trim();
    const duration = Number(period.duration);
    validateVacation_(name, startDate, duration);
    const adjustedStartDate = nextBusinessDate_(startDate);
    const endDate = calcBusinessEndDate_(adjustedStartDate, duration);
    return { name, startDate: adjustedStartDate, duration, endDate };
  });

  const totalDuration = normalized.reduce((total, period) => total + period.duration, 0);
  if (totalDuration > 5) throw new Error("한 사람당 총 5일까지만 저장할 수 있습니다.");
  validateNoOverlap_(normalized);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheet_();
    const rows = sheet.getDataRange().getValues();
    for (let i = rows.length - 1; i >= 1; i -= 1) {
      if (String(rows[i][0]).trim() === name) {
        sheet.deleteRow(i + 1);
      }
    }

    const now = new Date();
    normalized.forEach((period) => {
      sheet.appendRow([period.name, period.startDate, period.duration, period.endDate, now]);
    });

    return { ok: true, mode: "savedAll", name, vacations: normalized };
  } finally {
    lock.releaseLock();
  }
}

function getVacations_() {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  return rows.slice(1)
    .map((row) => {
      const name = String(row[0] || "").trim();
      const startDate = formatDate_(row[1]);
      const duration = Number(row[2]);
      const endDate = formatDate_(row[3]) || calcBusinessEndDate_(startDate, duration);
      return { name, startDate, duration, endDate };
    })
    .filter((item) => {
      return ALLOWED_NAMES.includes(item.name) && item.startDate && ALLOWED_DURATIONS.includes(item.duration);
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || ALLOWED_NAMES.indexOf(a.name) - ALLOWED_NAMES.indexOf(b.name));
}

function getStatuses_() {
  const sheet = getSheet_();
  const rows = sheet.getDataRange().getValues();
  const latestByName = {};

  rows.slice(1).forEach((row) => {
    const name = String(row[0] || "").trim();
    if (!ALLOWED_NAMES.includes(name)) return;

    const duration = Number(row[2]);
    const updatedAt = row[4] instanceof Date ? row[4].getTime() : 0;
    const status = duration === 0 ? "none" : "using";
    const current = latestByName[name];
    if (!current || updatedAt >= current.updatedAt) {
      latestByName[name] = { name, status, updatedAt };
    }
  });

  return Object.keys(latestByName).map((name) => ({
    name,
    status: latestByName[name].status,
  }));
}

function validateVacation_(name, startDate, duration) {
  if (!ALLOWED_NAMES.includes(name)) throw new Error("허용되지 않은 이름입니다.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("시작일 형식이 올바르지 않습니다.");
  if (!ALLOWED_DURATIONS.includes(duration)) throw new Error("기간은 1일부터 5일까지만 선택할 수 있습니다.");
}

function validateNoOverlap_(periods) {
  const seen = {};
  periods.forEach((period) => {
    businessDatesFrom_(period.startDate, period.duration).forEach((dateKey) => {
      if (seen[dateKey]) throw new Error("휴가 구간이 서로 겹칩니다.");
      seen[dateKey] = true;
    });
  });
}

function businessDatesFrom_(startDate, duration) {
  const dates = [];
  let cursor = nextBusinessDate_(startDate);
  while (dates.length < duration) {
    if (isBusinessDate_(cursor)) dates.push(cursor);
    cursor = addDays_(cursor, 1);
  }
  return dates;
}

function calcBusinessEndDate_(startDate, duration) {
  let cursor = nextBusinessDate_(startDate);
  let count = 0;
  while (count < duration) {
    if (isBusinessDate_(cursor)) count += 1;
    if (count === duration) return cursor;
    cursor = addDays_(cursor, 1);
  }
  return cursor;
}

function nextBusinessDate_(dateKey) {
  let cursor = dateKey;
  while (!isBusinessDate_(cursor)) {
    cursor = addDays_(cursor, 1);
  }
  return cursor;
}

function isBusinessDate_(dateKey) {
  return !isWeekend_(dateKey) && !isHoliday_(dateKey);
}

function isWeekend_(dateKey) {
  const parts = dateKey.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isHoliday_(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  const holidaySet = getHolidaySet_(year);
  return Boolean(holidaySet[dateKey]);
}

function addDays_(dateKey, amount) {
  const parts = dateKey.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + amount);
  return formatDate_(date);
}

function getHolidaySet_(year) {
  if (!HOLIDAY_CACHE[year]) {
    HOLIDAY_CACHE[year] = getHolidays_(year, year).reduce((map, holiday) => {
      map[holiday.date] = holiday.name || "공휴일";
      return map;
    }, {});
  }
  return HOLIDAY_CACHE[year];
}

function getHolidays_(startYear, endYear) {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear + 1, 0, 1);
  const calendar = CalendarApp.getCalendarById(HOLIDAY_CALENDAR_ID);
  if (!calendar) return [];

  return calendar.getEvents(start, end)
    .map((event) => ({
      date: formatDate_(event.getAllDayStartDate ? event.getAllDayStartDate() : event.getStartTime()),
      name: event.getTitle() || "공휴일",
    }))
    .filter((holiday, index, holidays) => {
      return holiday.date && holidays.findIndex((item) => item.date === holiday.date && item.name === holiday.name) === index;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatDate_(value) {
  if (!value) return "";
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value).slice(0, 10);
}

function parsePayload_(e) {
  const contents = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  return JSON.parse(contents);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function output_(data, e) {
  const callback = e && e.parameter && e.parameter.callback;
  const body = callback
    ? `${callback}(${JSON.stringify(data)});`
    : JSON.stringify(data);
  const mimeType = callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON;
  return ContentService.createTextOutput(body).setMimeType(mimeType);
}
