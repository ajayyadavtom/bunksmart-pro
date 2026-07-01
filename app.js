/* =========================================================
   BunkSmart Pro v2 app.js (ES Module)
   Vanilla JS state engine + Firebase cloud sync + Premium QR
   ========================================================= */

const STORAGE_KEY = "bunksmart_pro_v2_state";
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_BY_JS_INDEX = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GRADE_POINTS = { "O": 10, "A+": 9, "A": 8, "B+": 7, "B": 6, "C": 5, "P": 4, "F": 0 };
const GRADE_ORDER = ["O", "A+", "A", "B+", "B", "C", "P", "F"];

/* 
  0. FIREBASE CONFIG — Hardcoded 
*/
const firebaseConfig = {
  apiKey: "AIzaSyDltFWlVhPdp5z3sDl45sbmcm_7ruWD5DM",
  authDomain: "bunksmart-pro.firebaseapp.com",
  projectId: "bunksmart-pro",
  storageBucket: "bunksmart-pro.firebasestorage.app",
  messagingSenderId: "16947399306",
  appId: "1:16947399306:web:86a588fa46c3fb353cbb73",
  measurementId: "G-K2SC7SN7RJ"
};

let fb = null; 
let currentUser = null;
let cloudSaveTimer = null;

/* 
  1. STATE ENGINE 
*/
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function buildSampleState() {
  const period = (subject, start, end) => ({ id: uid(), subject, start, end });
  const timetable = {
    Monday: [
      period("Engineering Maths-I", "09:00", "09:50"),
      period("Applied Physics", "09:50", "10:40"),
      period("C Programming", "11:00", "11:50"),
      period("BEEE", "11:50", "12:40")
    ],
    Tuesday: [
      period("Communicative English", "09:00", "09:50"),
      period("Engineering Maths-I", "09:50", "10:40"),
      period("Engineering Graphics", "11:00", "12:40")
    ],
    Wednesday: [
      period("C Programming Lab", "09:00", "10:40"),
      period("Applied Physics", "11:00", "11:50"),
      period("BEEE", "11:50", "12:40"),
      period("IDEA Lab", "14:00", "14:50")
    ],
    Thursday: [
      period("Engineering Maths-I", "09:00", "09:50"),
      period("Communicative English", "09:50", "10:40"),
      period("C Programming", "11:00", "11:50")
    ],
    Friday: [
      period("Applied Physics", "09:00", "09:50"),
      period("BEEE", "09:50", "10:40"),
      period("Engineering Graphics", "11:00", "12:40")
    ],
    Saturday: [],
    Sunday: []
  };

  const attendance = {
    "Engineering Maths-I": { attended: 18, total: 24 },
    "Applied Physics": { attended: 14, total: 21 },
    "C Programming": { attended: 21, total: 24 },
    "C Programming Lab": { attended: 5, total: 6 },
    "BEEE": { attended: 11, total: 18 },
    "Communicative English": { attended: 12, total: 14 },
    "Engineering Graphics": { attended: 8, total: 13 },
    "IDEA Lab": { attended: 6, total: 7 }
  };

  return {
    version: 2,
    settings: { targetPercentage: 75, weekendOff: { saturday: true, sunday: true } },
    timetable,
    attendance,
    logs: {},
    sgpa: {
      subjects: [
        { id: uid(), name: "Engineering Maths-I", credits: 4, grade: "A" },
        { id: uid(), name: "C Programming", credits: 4, grade: "A+" },
        { id: uid(), name: "Applied Physics", credits: 3, grade: "A" },
        { id: uid(), name: "BEEE", credits: 3, grade: "B+" }
      ]
    },
    lastSaved: Date.now()
  };
}

function isValidState(s) {
  return (s && typeof s === "object" && s.settings && typeof s.settings === "object" && s.timetable && typeof s.timetable === "object" && s.attendance && typeof s.attendance === "object");
}

function reconcileState(s) {
  s.settings = s.settings || {};
  if (typeof s.settings.targetPercentage !== "number") s.settings.targetPercentage = 75;
  
  s.settings.weekendOff = s.settings.weekendOff || { saturday: true, sunday: true };
  if (typeof s.settings.weekendOff.saturday !== "boolean") s.settings.weekendOff.saturday = true;
  if (typeof s.settings.weekendOff.sunday !== "boolean") s.settings.weekendOff.sunday = true;
  
  s.timetable = s.timetable || {};
  DAY_ORDER.forEach((d) => {
    if (!Array.isArray(s.timetable[d])) s.timetable[d] = [];
    s.timetable[d].forEach((p) => { if (!p.id) p.id = uid(); });
  });

  s.attendance = s.attendance || {};
  Object.keys(s.attendance).forEach((subj) => {
    const rec = s.attendance[subj];
    rec.attended = Number.isFinite(rec.attended) ? rec.attended : 0;
    rec.total = Number.isFinite(rec.total) ? rec.total : 0;
  });

  s.logs = (s.logs && typeof s.logs === "object") ? s.logs : {};
  s.sgpa = (s.sgpa && typeof s.sgpa === "object") ? s.sgpa : { subjects: [] };
  s.sgpa.subjects = Array.isArray(s.sgpa.subjects) ? s.sgpa.subjects : [];
  
  s.sgpa.subjects.forEach((row) => {
    if (!row.id) row.id = uid();
    if (!GRADE_POINTS.hasOwnProperty(row.grade)) row.grade = "A";
    row.credits = Number.isFinite(row.credits) ? row.credits : 4;
  });

  s.version = 2;
  return s;
}

function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.error("localStorage is unavailable.", err);
  }

  if (!raw) {
    const fresh = buildSampleState();
    saveState(fresh, { silent: true });
    return fresh;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) throw new Error("State missing keys.");
    return reconcileState(parsed);
  } catch (err) {
    console.error("Failed to parse existing data. Loading sample data.", err);
    const fresh = buildSampleState();
    saveState(fresh, { silent: true });
    return fresh;
  }
}

function saveState(s, opts = {}) {
  s.lastSaved = Date.now();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch (err) {
    console.error("localStorage save failed.", err);
    if (!opts.silent) showToast("Could not save locally.");
  }
  if (fb && currentUser) scheduleCloudSave();
}

let state = loadState();

/* 
  2. DATE & TIME HELPERS 
*/
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function nowDate() { return new Date(); }
function todayKey() { return isoDate(nowDate()); }
function todayDayName() { return DAY_NAMES_BY_JS_INDEX[nowDate().getDay()]; }

function nowMinutes() {
  const d = nowDate();
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function isWeekendOff(jsDayIndex) {
  if (jsDayIndex === 6) return state.settings.weekendOff.saturday;
  if (jsDayIndex === 0) return state.settings.weekendOff.sunday;
  return false;
}

/* 
  3. ATTENDANCE MATH 
*/
function computePercentage(attended, total) {
  if (!total || total <= 0) return null;
  return (attended / total) * 100;
}

function classesNeededToRecover(attended, total, targetPercentage) {
  const t = targetPercentage / 100;
  if (t >= 1) return Infinity;
  const raw = (t * total - attended) / (1 - t);
  const needed = Math.ceil(raw);
  return needed > 0 ? needed : 0;
}

function safeBunksAvailable(attended, total, targetPercentage) {
  const t = targetPercentage / 100;
  if (t <= 0) return Infinity;
  const raw = (attended - t * total) / t;
  const bunks = Math.floor(raw);
  return bunks > 0 ? bunks : 0;
}

function percentageStatus(pct, target) {
  if (pct === null) return "unknown";
  if (pct >= target) return "safe";
  if (pct >= target - 10) return "warning";
  return "critical";
}

function statusColor(status) {
  switch (status) {
    case "safe": return "#22C55E";
    case "warning": return "#F59E0B";
    case "critical": return "#F43F5E";
    default: return "#71717a";
  }
}

/* 
  4. VTU GRADE MATH 
*/
function requiredSEE(targetTotalPoints, iaMarksOutOf50) {
  return (targetTotalPoints - iaMarksOutOf50) * 2;
}

function sgpaFromRows(rows) {
  let creditSum = 0;
  let weightedSum = 0;
  rows.forEach((r) => {
    const credits = Number(r.credits) || 0;
    const points = GRADE_POINTS[r.grade] ?? 0;
    creditSum += credits;
    weightedSum += credits * points;
  });
  if (creditSum === 0) return 0;
  return weightedSum / creditSum;
}

/* 
  5. TOAST 
*/
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("is-visible");
  void el.offsetWidth;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2400);
}

/* 
  6. TAB NAVIGATION 
*/
function switchTab(tab) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  const panel = document.getElementById(`panel-${tab}`);
  panel.classList.remove("hidden");
  
  panel.querySelectorAll(".fade-in").forEach((el) => {
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
  });
  
  document.querySelectorAll("#tabs-desktop .tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
  document.querySelectorAll("#tabs-mobile .mobile-tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
  
  if (tab === "history") renderCalendar();
}

function initTabs() {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

/* 
  7. LIVE CLOCK + HEADER 
*/
function renderHeader() {
  const d = nowDate();
  document.getElementById("header-date").textContent = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  let attended = 0, total = 0;
  
  Object.values(state.attendance).forEach((s) => { attended += s.attended; total += s.total; });
  const overall = computePercentage(attended, total);
  const el = document.getElementById("overview-overall");
  
  if (overall === null) { 
    el.textContent = "No data yet"; 
    el.style.color = ""; 
  } else {
    el.textContent = `Overall ${overall.toFixed(1)}%`;
    el.style.color = statusColor(percentageStatus(overall, state.settings.targetPercentage));
  }
}

function tickClock() {
  const d = nowDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const el = document.getElementById("live-clock");
  if (el) el.textContent = `${hh}:${mm}:${ss}`;
}

/* 
  8. DAILY ROLL CALL 
*/
function ensureSubjectEntry(subject) {
  if (!state.attendance[subject]) state.attendance[subject] = { attended: 0, total: 0 };
}

function markPeriod(dateKey, period, status) {
  ensureSubjectEntry(period.subject);
  state.logs[dateKey] = state.logs[dateKey] || {};
  const previous = state.logs[dateKey][period.id];
  const rec = state.attendance[period.subject];

  if (previous === "attended") { rec.attended -= 1; rec.total -= 1; }
  if (previous === "bunked") { rec.total -= 1; }
  if (status === "attended") { rec.attended += 1; rec.total += 1; }
  if (status === "bunked") { rec.total += 1; }

  state.logs[dateKey][period.id] = status;
  saveState(state);
}

function renderRollCall() {
  const host = document.getElementById("rollcall-widget");
  const dayName = todayDayName();
  const jsDay = nowDate().getDay();
  const dateKey = todayKey();
  
  document.getElementById("dash-eyebrow").textContent = `${dayName} Roll Call`;
  
  if (isWeekendOff(jsDay)) {
    document.getElementById("dash-heading").textContent = "It's a Holiday!";
    host.innerHTML = `
      <div class="glass-card p-10 text-center">
        <h3 class="text-xl font-bold text-white mb-1">It's a Holiday! Rest up. 🎉</h3>
        <p class="text-sm text-zinc-500">${dayName} is set as a weekend day off.</p>
      </div>`;
    return;
  }
  
  document.getElementById("dash-heading").textContent = "Dashboard";
  const periods = state.timetable[dayName] || [];
  
  if (periods.length === 0) {
    host.innerHTML = `
      <div class="glass-card p-10 text-center">
        <h3 class="text-lg font-bold text-white mb-1">No periods scheduled</h3>
        <p class="text-sm text-zinc-500">Add ${dayName}'s periods in Control Center.</p>
      </div>`;
    return;
  }

  const marksToday = state.logs[dateKey] || {};
  const nowM = nowMinutes();
  
  const rows = periods.map((p) => {
    const startM = timeToMinutes(p.start);
    const locked = nowM < startM;
    const chosen = marksToday[p.id];
    
    let badge = '<span class="status-badge st-pending">Pending</span>';
    if (chosen === "attended") badge = '<span class="status-badge st-attended">Attended</span>';
    else if (chosen === "bunked") badge = '<span class="status-badge st-bunked">Bunked</span>';
    else if (chosen === "holiday") badge = '<span class="status-badge st-holiday">Cancelled</span>';
    else if (locked) badge = '<span class="status-badge st-locked">Locked</span>';

    const btn = (status, cls, label) => {
      const isChosen = chosen === status;
      return `<button class="rollcall-btn ${cls} ${isChosen ? "is-chosen" : ""}" data-period-id="${p.id}" data-status="${status}" ${locked ? "disabled" : ""}>${label}</button>`;
    };

    return `
      <div class="period-card ${locked ? "is-locked" : ""}">
        <div class="flex items-center justify-between gap-3 flex-wrap mb-2.5">
          <div>
            <p class="font-medium text-zinc-100 text-sm">${escapeHtml(p.subject)}</p>
            <p class="period-time mt-0.5">${formatTime12(p.start)} - ${formatTime12(p.end)}</p>
          </div>
          ${badge}
        </div>
        ${locked 
          ? `<p class="text-[11px] text-zinc-500 flex items-center gap-1.5">Class opens at ${formatTime12(p.start)}</p>` 
          : `<div class="flex gap-2">${btn("attended", "rc-attend", "Attended")}${btn("bunked", "rc-bunk", "Bunked")}</div>`
        }
      </div>`;
  }).join("");

  host.innerHTML = `<div class="space-y-2.5">${rows}</div>`;
  
  host.querySelectorAll(".rollcall-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const period = periods.find((p) => p.id === b.dataset.periodId);
      markPeriod(dateKey, period, b.dataset.status);
      showToast(`${period.subject} marked ${b.dataset.status}.`);
      renderRollCall();
      renderSubjectGrid();
      renderHeader();
    });
  });
}

/* 
  9. SUBJECT OVERVIEW GRID 
*/
function renderSubjectGrid() {
  const host = document.getElementById("subject-grid");
  const subjects = Object.keys(state.attendance);
  if (subjects.length === 0) {
    host.innerHTML = '<p class="text-sm text-zinc-500 col-span-full">No subjects yet. Build your timetable in Control Center.</p>';
    return;
  }
  
  const target = state.settings.targetPercentage;
  
  host.innerHTML = subjects.map((subject) => {
    const rec = state.attendance[subject];
    const pct = computePercentage(rec.attended, rec.total);
    const status = percentageStatus(pct, target);
    const color = statusColor(status);
    const widthPct = pct === null ? 100 : Math.min(100, Math.max(2, pct));
    
    let warningBadge = "";
    let subtext = "";
    
    if (pct === null) {
      subtext = "No classes held yet";
    } else if (status === "safe") {
      const safeBunks = safeBunksAvailable(rec.attended, rec.total, target);
      subtext = safeBunks > 0 ? `Safe to bunk ${safeBunks} more` : "Right at the edge";
    } else {
      const needed = classesNeededToRecover(rec.attended, rec.total, target);
      subtext = Number.isFinite(needed) ? `Attend ${needed} in a row to reach target` : "Target unrecoverable";
      warningBadge = `<span class="warning-badge status-badge st-bunked ml-2">${Number.isFinite(needed) ? needed : ""} needed</span>`;
    }
    
    return `
      <div class="subject-card ${status === "critical" ? "is-critical" : ""}">
        <div class="flex items-start justify-between gap-2 mb-2.5">
          <h3 class="font-medium text-zinc-100 text-sm leading-snug">${escapeHtml(subject)}</h3>
          <span class="font-mono text-sm font-semibold shrink-0" style="color:${color}">${pct === null ? "-" : pct.toFixed(1) + "%"}</span>
        </div>
        <div class="track mb-2.5">
          <div class="progress-bar-fill h-full rounded-full" style="width:${widthPct}%; background-color:${color};"></div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-zinc-500 flex-wrap gap-1">
          <span class="font-mono">${rec.attended}/${rec.total} classes</span>
          <span class="flex items-center">${subtext}${warningBadge}</span>
        </div>
      </div>`;
  }).join("");
}

/* 
  10. HISTORY & CALENDAR 
*/
let calCursor = nowDate();
calCursor.setDate(1);

function dayAggregateStatus(dateKey) {
  const dayLogs = state.logs[dateKey];
  if (!dayLogs) return null;
  const statuses = Object.values(dayLogs).filter((s) => s !== "holiday");
  if (statuses.length === 0) return null;
  const attendedCount = statuses.filter((s) => s === "attended").length;
  if (attendedCount === statuses.length) return "full";
  if (attendedCount === 0) return "bunk";
  return "partial";
}

function renderCalendar() {
  const label = document.getElementById("cal-month-label");
  label.textContent = calCursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const grid = document.getElementById("cal-grid");
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  const firstDayIdx = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = todayKey();
  
  let cells = "";
  for (let i = 0; i < firstDayIdx; i++) cells += '<div class="cal-cell is-empty"></div>';
  
  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const key = isoDate(cellDate);
    const isFuture = key > todayIso;
    const isToday = key === todayIso;
    const agg = dayAggregateStatus(key);
    const dotColor = agg === "full" ? "#22C55E" : agg === "partial" ? "#F59E0B" : agg === "bunk" ? "#F43F5E" : "transparent";
    
    cells += `
      <button class="cal-cell ${isToday ? "is-today" : ""} ${isFuture ? "is-future" : ""}" data-date="${key}" ${isFuture ? "disabled" : ""}>
        <span>${day}</span>
        <i class="dot" style="background:${dotColor}"></i>
      </button>`;
  }
  
  grid.innerHTML = cells;
  grid.querySelectorAll(".cal-cell[data-date]:not(.is-future)").forEach((cell) => {
    cell.addEventListener("click", () => openDayModal(cell.dataset.date));
  });
}

function openDayModal(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);
  const dayName = DAY_NAMES_BY_JS_INDEX[d.getDay()];
  document.getElementById("day-modal-title").textContent = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  
  const body = document.getElementById("day-modal-body");
  const periods = state.timetable[dayName] || [];
  
  if (isWeekendOff(d.getDay())) {
    body.innerHTML = '<p class="text-sm text-zinc-500 text-center py-6">Marked as a weekend day off.</p>';
  } else if (periods.length === 0) {
    body.innerHTML = `<p class="text-sm text-zinc-500 text-center py-6">No periods scheduled on ${dayName}s.</p>`;
  } else {
    const dayLogs = state.logs[dateKey] || {};
    body.innerHTML = periods.map((p) => {
      const chosen = dayLogs[p.id];
      const btn = (status, cls, label) => `<button class="rollcall-btn ${cls} ${chosen === status ? "is-chosen" : ""}" data-period-id="${p.id}" data-status="${status}">${label}</button>`;
      
      return `
        <div class="period-card">
          <div class="flex items-center justify-between gap-3 flex-wrap mb-2.5">
            <div>
              <p class="font-medium text-zinc-100 text-sm">${escapeHtml(p.subject)}</p>
              <p class="period-time mt-0.5">${formatTime12(p.start)} - ${formatTime12(p.end)}</p>
            </div>
          </div>
          <div class="flex gap-2">
            ${btn("attended", "rc-attend", "Attended")}
            ${btn("bunked", "rc-bunk", "Bunked")}
            ${btn("holiday", "rc-holiday", "Cancelled")}
          </div>
        </div>`;
    }).join("");
    
    body.querySelectorAll(".rollcall-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const period = periods.find((p) => p.id === b.dataset.periodId);
        markPeriod(dateKey, period, b.dataset.status);
        showToast(`Updated ${period.subject} for ${dateKey}.`);
        openDayModal(dateKey);
        renderCalendar();
        renderSubjectGrid();
        renderHeader();
      });
    });
  }
  document.getElementById("day-modal").classList.remove("hidden");
}

function initHistoryTab() {
  document.getElementById("cal-prev").addEventListener("click", () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
  document.getElementById("cal-next").addEventListener("click", () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
  document.getElementById("day-modal-close").addEventListener("click", () => { document.getElementById("day-modal").classList.add("hidden"); });
  document.getElementById("day-modal").addEventListener("click", (e) => { if (e.target.id === "day-modal") document.getElementById("day-modal").classList.add("hidden"); });
}

/* 
  11. SGPA HUB 
*/
const RING_CIRCUMFERENCE = 2 * Math.PI * 64;

function renderSgpaRing() {
  const val = sgpaFromRows(state.sgpa.subjects);
  document.getElementById("sgpa-value").textContent = val.toFixed(2);
  const ring = document.getElementById("sgpa-ring");
  const offset = RING_CIRCUMFERENCE * (1 - Math.min(val, 10) / 10);
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${offset}`;
  document.getElementById("sgpa-subject-count").textContent = state.sgpa.subjects.length;
  const totalCredits = state.sgpa.subjects.reduce((sum, r) => sum + (Number(r.credits) || 0), 0);
  document.getElementById("sgpa-credit-count").textContent = totalCredits;
}

function renderSgpaGrid() {
  const host = document.getElementById("sgpa-subject-grid");
  if (state.sgpa.subjects.length === 0) {
    host.innerHTML = '<p class="text-sm text-zinc-500 col-span-full">No subjects yet. Add one to start building your SGPA.</p>';
  } else {
    host.innerHTML = state.sgpa.subjects.map((row) => `
      <div class="subject-card" data-row-id="${row.id}">
        <div class="flex items-start justify-between gap-2 mb-3">
          <input type="text" class="field-input sgpa-name-input" placeholder="Subject name" value="${escapeAttr(row.name)}" />
          <button class="icon-btn sgpa-remove shrink-0" aria-label="Remove subject">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="flex items-center justify-between mb-3">
          <label class="text-[11px] text-zinc-500">Credits</label>
          <select class="field-select sgpa-credits-select" style="width:auto;padding: 5px 10px;">
            ${[1, 2, 3, 4].map((c) => `<option value="${c}" ${c === row.credits ? "selected" : ""}>${c}</option>`).join("")}
          </select>
        </div>
        <div class="grade-matrix">
          ${GRADE_ORDER.map((g) => `<button class="grade-btn ${g === row.grade ? "is-selected" : ""}" data-grade="${g}">${g}</button>`).join("")}
        </div>
      </div>`).join("");
      
    host.querySelectorAll(".subject-card").forEach((card) => {
      const rowId = card.dataset.rowId;
      const row = state.sgpa.subjects.find((r) => r.id === rowId);
      
      card.querySelector(".sgpa-name-input").addEventListener("input", (e) => { row.name = e.target.value; saveState(state); });
      card.querySelector(".sgpa-credits-select").addEventListener("change", (e) => { row.credits = Number(e.target.value); saveState(state); renderSgpaRing(); });
      card.querySelectorAll(".grade-btn").forEach((gBtn) => {
        gBtn.addEventListener("click", () => {
          row.grade = gBtn.dataset.grade;
          saveState(state);
          renderSgpaGrid();
          renderSgpaRing();
        });
      });
      card.querySelector(".sgpa-remove").addEventListener("click", () => {
        state.sgpa.subjects = state.sgpa.subjects.filter((r) => r.id !== rowId);
        saveState(state);
        renderSgpaGrid();
        renderSgpaRing();
      });
    });
  }
  renderSgpaRing();
}

function initSgpaHub() {
  document.getElementById("sgpa-add-subject").addEventListener("click", () => {
    state.sgpa.subjects.push({ id: uid(), name: "", credits: 4, grade: "A" });
    saveState(state);
    renderSgpaGrid();
  });
  
  document.getElementById("pred-calc-btn").addEventListener("click", () => {
    const ia = Number(document.getElementById("pred-ia").value);
    const targetTotal = Number(document.getElementById("pred-grade").value);
    const resultEl = document.getElementById("pred-result");
    
    if (document.getElementById("pred-ia").value === "" || Number.isNaN(ia)) {
      resultEl.className = "result-panel is-fail"; resultEl.innerHTML = "Enter your IA marks first."; return;
    }
    if (ia < 0 || ia > 50) {
      resultEl.className = "result-panel is-fail"; resultEl.innerHTML = "IA marks must be between 0 and 50."; return;
    }
    
    const see = requiredSEE(targetTotal, ia);
    if (see > 100) {
      resultEl.className = "result-panel is-fail";
      resultEl.innerHTML = `Mathematically impossible. You'd need ${see.toFixed(1)}/100 in the SEE.`;
    } else if (see <= 0) {
      resultEl.className = "result-panel is-success";
      resultEl.innerHTML = `Your internals alone already clear this grade! Just meet VTU's minimum SEE pass mark.`;
    } else {
      resultEl.className = "result-panel is-success";
      resultEl.innerHTML = `Score at least <span class="font-mono font-bold text-base text-white ml-2">${Math.ceil(see)}/100</span> in the SEE to secure this grade.`;
    }
  });
}

/* 
  12. CONTROL CENTER 
*/
function initTargetSlider() {
  const slider = document.getElementById("target-slider");
  const label = document.getElementById("target-slider-value");
  slider.value = state.settings.targetPercentage;
  slider.style.setProperty("--fill", `${((slider.value - 50) / 40) * 100}%`);
  label.textContent = `${slider.value}%`;
  
  slider.addEventListener("input", () => {
    label.textContent = `${slider.value}%`;
    slider.style.setProperty("--fill", `${((slider.value - 50) / 40) * 100}%`);
  });
  slider.addEventListener("change", () => {
    state.settings.targetPercentage = Number(slider.value);
    saveState(state);
    renderHeader();
    renderSubjectGrid();
  });
}

function initWeekendToggles() {
  const sat = document.getElementById("toggle-saturday");
  const sun = document.getElementById("toggle-sunday");
  sat.checked = state.settings.weekendOff.saturday;
  sun.checked = state.settings.weekendOff.sunday;
  
  sat.addEventListener("change", () => { state.settings.weekendOff.saturday = sat.checked; saveState(state); renderRollCall(); });
  sun.addEventListener("change", () => { state.settings.weekendOff.sunday = sun.checked; saveState(state); renderRollCall(); });
}

function renderTimetableBuilder() {
  const host = document.getElementById("timetable-builder");
  host.innerHTML = DAY_ORDER.map((day) => `
    <div class="day-block" data-day="${day}">
      <div class="day-block-title">
        <span>${day}</span>
        <button class="ghost-btn add-period-btn" data-day="${day}">+ Add period</button>
      </div>
      <div class="periods-list" data-day="${day}"></div>
    </div>`).join("");
    
  DAY_ORDER.forEach((day) => renderPeriodsForDay(day));
  
  host.querySelectorAll(".add-period-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const day = btn.dataset.day;
      state.timetable[day].push({ id: uid(), subject: "", start: "09:00", end: "09:50" });
      saveState(state);
      renderPeriodsForDay(day);
      renderRollCall();
    });
  });
}

function renderPeriodsForDay(day) {
  const list = document.querySelector(`.periods-list[data-day="${day}"]`);
  const periods = state.timetable[day];
  
  if (periods.length === 0) {
    list.innerHTML = '<p class="text-[12px] text-zinc-600">No periods yet.</p>';
    return;
  }
  
  list.innerHTML = periods.map((p) => `
    <div class="period-row" data-period-id="${p.id}">
      <input type="text" placeholder="Subject name" class="field-input pt-subject" value="${escapeAttr(p.subject)}" />
      <input type="time" class="field-input pt-start" value="${p.start}" />
      <input type="time" class="field-input pt-end" value="${p.end}" />
      <button class="icon-btn pt-remove" aria-label="Remove period">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>`).join("");
    
  list.querySelectorAll(".period-row").forEach((row) => {
    const periodId = row.dataset.periodId;
    const p = periods.find((x) => x.id === periodId);
    
    row.querySelector(".pt-subject").addEventListener("input", (e) => { p.subject = e.target.value; saveState(state); });
    row.querySelector(".pt-subject").addEventListener("blur", (e) => { if (e.target.value.trim()) ensureSubjectEntry(e.target.value.trim()); renderRollCall(); renderSubjectGrid(); });
    row.querySelector(".pt-start").addEventListener("change", (e) => { p.start = e.target.value; saveState(state); renderRollCall(); });
    row.querySelector(".pt-end").addEventListener("change", (e) => { p.end = e.target.value; saveState(state); renderRollCall(); });
    row.querySelector(".pt-remove").addEventListener("click", () => {
      state.timetable[day] = state.timetable[day].filter((x) => x.id !== periodId);
      saveState(state);
      renderPeriodsForDay(day);
      renderRollCall();
    });
  });
}

function initResetModal() {
  const modal = document.getElementById("reset-modal");
  document.getElementById("wipe-data-btn").addEventListener("click", () => modal.classList.remove("hidden"));
  document.getElementById("reset-cancel").addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.add("hidden"); });
  
  document.getElementById("reset-confirm").addEventListener("click", async () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    state = buildSampleState();
    saveState(state, { silent: true });
    
    if (fb && currentUser) {
      try { await fb.setDoc(fb.doc(fb.db, "users", currentUser.uid), state); } catch (err) { console.error("Cloud reset failed.", err); }
    }
    
    modal.classList.add("hidden");
    renderAll();
    showToast("All data reset. Fresh sample data loaded.");
  });
}

/* 
  13. FIREBASE AUTH + CLOUD SYNC 
*/
async function initFirebase() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.info("Running in local-only mode. Update firebaseConfig to enable cloud sync.");
    return null;
  }
  try {
    const [{ initializeApp }, authMod, storeMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const app = initializeApp(firebaseConfig);
    return {
      auth: authMod.getAuth(app),
      db: storeMod.getFirestore(app),
      GoogleAuthProvider: authMod.GoogleAuthProvider,
      signInWithPopup: authMod.signInWithPopup,
      onAuthStateChanged: authMod.onAuthStateChanged,
      signOut: authMod.signOut,
      doc: storeMod.doc,
      getDoc: storeMod.getDoc,
      setDoc: storeMod.setDoc,
    };
  } catch (err) {
    console.error("Firebase failed to load. Continuing in local mode.", err);
    return null;
  }
}

function scheduleCloudSave() {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    if (!fb || !currentUser) return;
    try {
      await fb.setDoc(fb.doc(fb.db, "users", currentUser.uid), state);
    } catch (err) { console.error("Cloud save failed.", err); }
  }, 1500);
}

async function handleAuthChange(user) {
  currentUser = user;
  const slot = document.getElementById("auth-slot");
  
  if (!user) {
    slot.innerHTML = `
      <button id="signin-btn" class="signin-btn">
        <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.1 5.4 29.3 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.3-.3-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.1 6.4 29.3 4.5 24 4.5c-7.7 0-14.3 4.3-17.7 10.2z"/><path fill="#4CAF50" d="M24 44.5c5.2 0 9.9-1.8 13.6-4.9l-6.3-5.3c-2.1 1.5-4.8 2.4-7.3 2.4-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 40.1 16.3 44.5 24 44.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.3c-.4.4 6.7-4.9 6.7-15 0-1.2-.1-2.3-.3-3.5z"/></svg>
        <span>Sign in with Google</span>
      </button>`;
    bindSignInButton();
    return;
  }
  
  slot.innerHTML = `
    <button id="user-avatar-btn" class="user-avatar-btn" title="Sign out">
      <img src="${user.photoURL || ""}" alt="" onerror="this.style.display='none'" />
      <span>${escapeHtml((user.displayName || user.email || "User").split(" ")[0])}</span>
    </button>`;
    
  document.getElementById("user-avatar-btn").addEventListener("click", async () => {
    try { await fb.signOut(fb.auth); showToast("Signed out."); } catch (err) { console.error("Sign-out failed.", err); }
  });

  try {
    const snap = await fb.getDoc(fb.doc(fb.db, "users", user.uid));
    if (snap.exists()) {
      const cloudState = snap.data();
      if (isValidState(cloudState)) {
        if ((cloudState.lastSaved || 0) > (state.lastSaved || 0)) {
          state = reconcileState(cloudState);
          saveState(state, { silent: true });
        }
        renderAll();
        showToast("Synced with cloud backup.");
      }
    } else {
      await fb.setDoc(fb.doc(fb.db, "users", user.uid), state);
      showToast("Cloud backup created.");
    }
  } catch (err) {
    console.error("Cloud sync failed.", err);
    showToast("Signed in, but cloud sync is offline.");
  }
}

function bindSignInButton() {
  const btn = document.getElementById("signin-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (!fb) { showToast("Firebase keys missing. Running in local mode."); return; }
    try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); } 
    catch (err) { console.error("Sign-in failed.", err); showToast("Sign-in failed."); }
  });
}

/* 
  14. UTIL 
*/
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/* 
  15. INIT (FIXED)
*/
function renderAll() {
  renderHeader();
  renderRollCall();
  renderSubjectGrid();
  renderCalendar();
  renderSgpaGrid();
  renderTimetableBuilder();
}

async function init() {
  initTabs();
  initSgpaHub();
  initTargetSlider();
  initWeekendToggles();
  renderTimetableBuilder();
  initHistoryTab();
  initResetModal();
  bindSignInButton();
  renderAll();
  
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(() => { renderHeader(); renderRollCall(); }, 30 * 1000);
  
  fb = await initFirebase();
  if (fb) fb.onAuthStateChanged(fb.auth, handleAuthChange);
}

// Bypassing the trap! This guarantees it launches whether the DOM is loading or already finished loading.
if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/* ==========================================
   PREMIUM UPGRADE & UPI QR CODE SYSTEM
   ========================================== */
(function() {
    const SECRET_CODE = "VTU2026"; 

    function injectPremiumUI() {
        if (localStorage.getItem('isPremium') === 'true') return;

        const btn = document.createElement('button');
        btn.innerHTML = "⭐ Unlock Lifetime History";
        btn.style.cssText = "position:fixed;bottom:80px;right:20px;background:#6366f1;color:white;padding:12px 20px;border-radius:99px;font-weight:bold;box-shadow:0 10px 15px -3px rgba(0,0,0,0.5);z-index:9999;border:none;cursor:pointer;";
        
        const modal = document.createElement('div');
        modal.style.cssText = "display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(9,9,11,0.9);backdrop-filter:blur(10px);z-index:10000;justify-content:center;align-items:center;";
        modal.innerHTML = `
            <div style="background:#18181b;border:1px solid #27272a;padding:30px;border-radius:16px;text-align:center;max-width:90%;width:350px;">
                <h2 style="color:white;font-size:24px;margin-bottom:10px;">Upgrade to Pro 🚀</h2>
                <p style="color:#a1a1aa;font-size:14px;margin-bottom:20px;">Free accounts auto-delete history every 2 months. Pay just <b>₹20</b> once to unlock lifetime storage.</p>
                
                <div style="background:#09090b;padding:15px;border-radius:8px;margin-bottom:20px;color:#cbd5e1;">
                    Scan to pay ₹20:<br>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=ajaytom@ptyes&pn=BunkSmart&am=20&cu=INR" alt="UPI QR" style="margin: 10px auto; border-radius: 8px; background: white; padding: 5px; width: 150px; height: 150px;"><br>
                    <b style="color:white;font-size:16px;">UPI: ajaytom@ptyes</b><br>
                    <span style="font-size:13px;color:#10b981;font-weight:bold;"><br>Screenshot payment and WhatsApp to:<br>+91 7996490057</span><br>
                    <span style="font-size:11px;color:#a1a1aa;">(Message admin to get your secret unlock code)</span>
                </div>

                <input id="activationCode" type="text" placeholder="Enter Secret Code" style="width:100%;padding:12px;border-radius:8px;border:1px solid #3f3f46;background:#27272a;color:white;margin-bottom:15px;text-align:center;">
                
                <button id="verifyBtn" style="width:100%;background:#10b981;color:white;padding:12px;border-radius:8px;font-weight:bold;border:none;margin-bottom:10px;cursor:pointer;">Verify & Unlock</button>
                <button id="closeModal" style="width:100%;background:transparent;color:#a1a1aa;padding:12px;border:none;cursor:pointer;">Cancel</button>
            </div>
        `;

        document.body.appendChild(btn);
        document.body.appendChild(modal);

        btn.onclick = () => modal.style.display = "flex";
        document.getElementById('closeModal').onclick = () => modal.style.display = "none";
        
        document.getElementById('verifyBtn').onclick = () => {
            const val = document.getElementById('activationCode').value.trim();
            if (val === SECRET_CODE) {
                localStorage.setItem('isPremium', 'true');
                alert("Pro Unlocked! Your attendance history is now permanent.");
                btn.remove();
                modal.remove();
            } else {
                alert("Invalid activation code. Please try again.");
            }
        };
    }

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', injectPremiumUI);
    } else {
      injectPremiumUI();
    }
})();
