/* =========================================================
   BunkSmart Pro v2 — app.js (ES Module)
   Vanilla JS state engine + optional Firebase cloud sync.
   Works fully offline on localStorage if Firebase is not configured.
   ========================================================= */

const STORAGE_KEY = "bunksmart_pro_v2_state";
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_BY_JS_INDEX = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const GRADE_POINTS = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, P: 4, F: 0 };
const GRADE_ORDER = ["O", "A+", "A", "B+", "B", "C", "P", "F"];

/* ---------------------------------------------------------
   0. FIREBASE CONFIG — replace with your own project keys.
   The app runs perfectly on localStorage alone if these are
   left as placeholders or if the network/CDN is unreachable.
   --------------------------------------------------------- */
const firebaseConfig = {
  const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "bunksmart-pro.firebaseapp.com",
  projectId: "bunksmart-pro",
  storageBucket: "bunksmart-pro.firebasestorage.app",
  messagingSenderId: "16947399306",
  appId: "1:16947399306:web:...",
  measurementId: "G-..."
};

let fb = null; // populated by initFirebase() if configured + reachable
let currentUser = null;
let cloudSaveTimer = null;

/* ---------------------------------------------------------
   1. STATE ENGINE — bulletproof hydration, never blind-overwrites
   --------------------------------------------------------- */

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
      period("BEEE", "11:50", "12:40"),
    ],
    Tuesday: [
      period("Communicative English", "09:00", "09:50"),
      period("Engineering Maths-I", "09:50", "10:40"),
      period("Engineering Graphics", "11:00", "12:40"),
    ],
    Wednesday: [
      period("C Programming Lab", "09:00", "10:40"),
      period("Applied Physics", "11:00", "11:50"),
      period("BEEE", "11:50", "12:40"),
      period("IDEA Lab", "14:00", "14:50"),
    ],
    Thursday: [
      period("Engineering Maths-I", "09:00", "09:50"),
      period("Communicative English", "09:50", "10:40"),
      period("C Programming", "11:00", "11:50"),
    ],
    Friday: [
      period("Applied Physics", "09:00", "09:50"),
      period("BEEE", "09:50", "10:40"),
      period("Engineering Graphics", "11:00", "12:40"),
    ],
    Saturday: [],
    Sunday: [],
  };

  const attendance = {
    "Engineering Maths-I": { attended: 18, total: 24 },
    "Applied Physics": { attended: 14, total: 21 },
    "C Programming": { attended: 21, total: 24 },
    "C Programming Lab": { attended: 5, total: 6 },
    BEEE: { attended: 11, total: 18 },
    "Communicative English": { attended: 12, total: 14 },
    "Engineering Graphics": { attended: 8, total: 13 },
    "IDEA Lab": { attended: 6, total: 7 },
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
        { id: uid(), name: "BEEE", credits: 3, grade: "B+" },
      ],
    },
    lastSaved: Date.now(),
  };
}

function isValidState(s) {
  return (
    s &&
    typeof s === "object" &&
    s.settings &&
    typeof s.settings === "object" &&
    s.timetable &&
    typeof s.timetable === "object" &&
    s.attendance &&
    typeof s.attendance === "object"
  );
}

// Fills in any structurally-missing pieces of an existing state WITHOUT
// touching data the person already has. This is what eliminates the
// refresh bug: we only ever add missing keys, never replace present ones.
function reconcileState(s) {
  s.settings = s.settings || {};
  if (typeof s.settings.targetPercentage !== "number") s.settings.targetPercentage = 75;
  s.settings.weekendOff = s.settings.weekendOff || { saturday: true, sunday: true };
  if (typeof s.settings.weekendOff.saturday !== "boolean") s.settings.weekendOff.saturday = true;
  if (typeof s.settings.weekendOff.sunday !== "boolean") s.settings.weekendOff.sunday = true;

  s.timetable = s.timetable || {};
  DAY_ORDER.forEach((d) => {
    if (!Array.isArray(s.timetable[d])) s.timetable[d] = [];
    s.timetable[d].forEach((p) => {
      if (!p.id) p.id = uid();
    });
  });

  s.attendance = s.attendance || {};
  Object.keys(s.attendance).forEach((subj) => {
    const rec = s.attendance[subj];
    rec.attended = Number.isFinite(rec.attended) ? rec.attended : 0;
    rec.total = Number.isFinite(rec.total) ? rec.total : 0;
  });

  s.logs = s.logs && typeof s.logs === "object" ? s.logs : {};
  s.sgpa = s.sgpa && typeof s.sgpa === "object" ? s.sgpa : { subjects: [] };
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
    console.error("BunkSmart: localStorage is unavailable in this browser context.", err);
  }

  if (!raw) {
    const fresh = buildSampleState();
    saveState(fresh, { silent: true });
    return fresh;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) throw new Error("Stored state is missing required top-level keys.");
    return reconcileState(parsed);
  } catch (err) {
    // Never silently wipe on a parse failure — surface it, then fall back safely.
    console.error("BunkSmart: existing data could not be parsed; a fresh sample state was loaded instead. Your old raw data is still in localStorage under a backup key.", err);
    try {
      localStorage.setItem(`${STORAGE_KEY}_corrupt_backup_${Date.now()}`, raw);
    } catch (_) { /* best-effort backup only */ }
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
    console.error("BunkSmart: localStorage save failed (storage full or disabled).", err);
    if (!opts.silent) showToast("Could not save locally — storage may be full.");
  }
  if (fb && currentUser) scheduleCloudSave();
}

let state = loadState();

/* ---------------------------------------------------------
   2. DATE / TIME HELPERS
   --------------------------------------------------------- */

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

/* ---------------------------------------------------------
   3. ATTENDANCE MATH — the recovery formula
   --------------------------------------------------------- */

function computePercentage(attended, total) {
  if (!total || total <= 0) return null;
  return (attended / total) * 100;
}

// Exact spec formula for a 75% target, generalized: consecutive classes
// needed, attending every one, to lift the running percentage back to target.
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

/* ---------------------------------------------------------
   4. VTU GRADE MATH
   --------------------------------------------------------- */

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

/* ---------------------------------------------------------
   5. TOAST
   --------------------------------------------------------- */

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

/* ---------------------------------------------------------
   6. TAB NAVIGATION
   --------------------------------------------------------- */

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

/* ---------------------------------------------------------
   7. LIVE CLOCK + HEADER
   --------------------------------------------------------- */

function renderHeader() {
  const d = nowDate();
  document.getElementById("header-date").textContent = d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric" });

  let attended = 0, total = 0;
  Object.values(state.attendance).forEach((s) => { attended += s.attended; total += s.total; });
  const overall = computePercentage(attended, total);
  const el = document.getElementById("overview-overall");
  if (overall === null) { el.textContent = "No data yet"; el.style.color = ""; }
  else {
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

/* ---------------------------------------------------------
   8. DAILY ROLL CALL (time-locked)
   --------------------------------------------------------- */

function ensureSubjectEntry(subject) {
  if (!state.attendance[subject]) state.attendance[subject] = { attended: 0, total: 0 };
}

// Applies (or reverses + reapplies) a status for one period on one date,
// keeping state.attendance and state.logs in sync.
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

  document.getElementById("dash-eyebrow").textContent = `${dayName} · Roll Call`;

  if (isWeekendOff(jsDay)) {
    document.getElementById("dash-heading").textContent = "It's a Holiday!";
    host.innerHTML = `
      <div class="glass-card p-10 text-center">
        <div class="text-6xl mb-3">🎉</div>
        <h3 class="text-xl font-bold text-white mb-1">It's a Holiday! Rest up. 🎉</h3>
        <p class="text-sm text-zinc-500">${dayName} is set as a weekend day off in Control Center.</p>
      </div>`;
    return;
  }

  document.getElementById("dash-heading").textContent = "Dashboard";

  const periods = state.timetable[dayName] || [];
  if (periods.length === 0) {
    host.innerHTML = `
      <div class="glass-card p-10 text-center">
        <div class="text-5xl mb-3">🗓️</div>
        <h3 class="text-lg font-bold text-white mb-1">No periods scheduled for ${dayName}</h3>
        <p class="text-sm text-zinc-500">Add ${dayName}'s periods in Control Center → Weekly Timetable.</p>
      </div>`;
    return;
  }

  const marksToday = state.logs[dateKey] || {};
  const nowM = nowMinutes();

  const rows = periods
    .map((p) => {
      const startM = timeToMinutes(p.start);
      const endM = timeToMinutes(p.end);
      const locked = nowM < startM;
      const chosen = marksToday[p.id];

      let badge;
      if (chosen === "attended") badge = `<span class="status-badge st-attended">Attended</span>`;
      else if (chosen === "bunked") badge = `<span class="status-badge st-bunked">Bunked</span>`;
      else if (chosen === "holiday") badge = `<span class="status-badge st-holiday">Cancelled</span>`;
      else if (locked) badge = `<span class="status-badge st-locked">Locked</span>`;
      else badge = `<span class="status-badge st-pending">Pending</span>`;

      const btn = (status, cls, label) => {
        const isChosen = chosen === status;
        return `<button
            class="rollcall-btn ${cls} ${isChosen ? "is-chosen" : ""}"
            data-period-id="${p.id}" data-status="${status}"
            ${locked ? "disabled" : ""}
            aria-pressed="${isChosen}">${label}</button>`;
      };

      return `
        <div class="period-card ${locked ? "is-locked" : ""}">
          <div class="flex items-center justify-between gap-3 flex-wrap mb-2.5">
            <div>
              <p class="font-medium text-zinc-100 text-sm">${escapeHtml(p.subject)}</p>
              <p class="period-time mt-0.5">${formatTime12(p.start)} – ${formatTime12(p.end)}</p>
            </div>
            ${badge}
          </div>
          ${locked
            ? `<p class="text-[11px] text-zinc-500 flex items-center gap-1.5">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" stroke-width="1.6"/></svg>
                 Class opens at ${formatTime12(p.start)}
               </p>`
            : `<div class="flex gap-2">
                 ${btn("attended", "rc-attend", "Attended")}
                 ${btn("bunked", "rc-bunk", "Bunked")}
               </div>`
          }
        </div>`;
    })
    .join("");

  host.innerHTML = `<div class="space-y-2.5">${rows}</div>`;

  host.querySelectorAll(".rollcall-btn").forEach((b) => {
    b.addEventListener("click", () => {
      const period = periods.find((p) => p.id === b.dataset.periodId);
      markPeriod(dateKey, period, b.dataset.status);
      showToast(`${period.subject}: marked ${b.dataset.status}.`);
      renderRollCall();
      renderSubjectGrid();
      renderHeader();
    });
  });
}

/* ---------------------------------------------------------
   9. SUBJECT OVERVIEW GRID (with pulsing warning badge)
   --------------------------------------------------------- */

function renderSubjectGrid() {
  const host = document.getElementById("subject-grid");
  const subjects = Object.keys(state.attendance);
  if (subjects.length === 0) {
    host.innerHTML = `<p class="text-sm text-zinc-500 col-span-full">No subjects yet — build your timetable in Control Center.</p>`;
    return;
  }
  const target = state.settings.targetPercentage;

  host.innerHTML = subjects
    .map((subject) => {
      const rec = state.attendance[subject];
      const pct = computePercentage(rec.attended, rec.total);
      const status = percentageStatus(pct, target);
      const color = statusColor(status);
      const widthPct = pct === null ? 100 : Math.min(100, Math.max(2, pct));

      let warningBadge = "";
      let subtext;
      if (pct === null) {
        subtext = "No classes held yet";
      } else if (status === "safe") {
        const safeBunks = safeBunksAvailable(rec.attended, rec.total, target);
        subtext = safeBunks > 0 ? `Can skip ${safeBunks} more` : "Right at the edge";
      } else {
        const needed = classesNeededToRecover(rec.attended, rec.total, target);
        subtext = Number.isFinite(needed) ? `Attend ${needed} straight to recover` : `100% target — cannot recover`;
        warningBadge = `<span class="warning-badge status-badge st-bunked ml-2">${Number.isFinite(needed) ? needed : "∞"} needed</span>`;
      }

      return `
        <div class="subject-card ${status === "critical" ? "is-critical" : ""}">
          <div class="flex items-start justify-between gap-2 mb-2.5">
            <h3 class="font-medium text-zinc-100 text-sm leading-snug">${escapeHtml(subject)}</h3>
            <span class="font-mono text-sm font-semibold shrink-0" style="color:${color}">${pct === null ? "—" : pct.toFixed(1) + "%"}</span>
          </div>
          <div class="track mb-2.5">
            <div class="progress-bar-fill h-full rounded-full" style="width:${widthPct}%; background-color:${color};"></div>
          </div>
          <div class="flex items-center justify-between text-[11px] text-zinc-500 flex-wrap gap-1">
            <span class="font-mono">${rec.attended}/${rec.total}</span>
            <span class="flex items-center">${subtext}${warningBadge}</span>
          </div>
        </div>`;
    })
    .join("");
}

/* ---------------------------------------------------------
   10. HISTORY & ANALYTICS — calendar + day detail modal
   --------------------------------------------------------- */

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
  for (let i = 0; i < firstDayIdx; i++) cells += `<div class="cal-cell is-empty"></div>`;

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
    body.innerHTML = `<p class="text-sm text-zinc-500 text-center py-6">🎉 Marked as a weekend day off.</p>`;
  } else if (periods.length === 0) {
    body.innerHTML = `<p class="text-sm text-zinc-500 text-center py-6">No periods were scheduled on ${dayName}s.</p>`;
  } else {
    const dayLogs = state.logs[dateKey] || {};
    body.innerHTML = periods
      .map((p) => {
        const chosen = dayLogs[p.id];
        const btn = (status, cls, label) => `
          <button class="rollcall-btn ${cls} ${chosen === status ? "is-chosen" : ""}" data-period-id="${p.id}" data-status="${status}">${label}</button>`;
        return `
          <div class="period-card">
            <div class="flex items-center justify-between gap-3 flex-wrap mb-2.5">
              <div>
                <p class="font-medium text-zinc-100 text-sm">${escapeHtml(p.subject)}</p>
                <p class="period-time mt-0.5">${formatTime12(p.start)} – ${formatTime12(p.end)}</p>
              </div>
            </div>
            <div class="flex gap-2">
              ${btn("attended", "rc-attend", "Attended")}
              ${btn("bunked", "rc-bunk", "Bunked")}
              ${btn("holiday", "rc-holiday", "Cancelled")}
            </div>
          </div>`;
      })
      .join("");

    body.querySelectorAll(".rollcall-btn").forEach((b) => {
      b.addEventListener("click", () => {
        const period = periods.find((p) => p.id === b.dataset.periodId);
        markPeriod(dateKey, period, b.dataset.status);
        showToast(`Updated ${period.subject} for ${dateKey}.`);
        openDayModal(dateKey); // re-render modal with new state
        renderCalendar();
        renderSubjectGrid();
        renderHeader();
      });
    });
  }

  document.getElementById("day-modal").classList.remove("hidden");
}

function initHistoryTab() {
  document.getElementById("cal-prev").addEventListener("click", () => {
    calCursor.setMonth(calCursor.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    calCursor.setMonth(calCursor.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById("day-modal-close").addEventListener("click", () => {
    document.getElementById("day-modal").classList.add("hidden");
  });
  document.getElementById("day-modal").addEventListener("click", (e) => {
    if (e.target.id === "day-modal") document.getElementById("day-modal").classList.add("hidden");
  });
}

/* ---------------------------------------------------------
   11. SGPA HUB — grid, grade matrix, live ring
   --------------------------------------------------------- */

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
    host.innerHTML = `<p class="text-sm text-zinc-500 col-span-full">No subjects yet — add one to start building your SGPA.</p>`;
  } else {
    host.innerHTML = state.sgpa.subjects
      .map((row) => `
        <div class="subject-card" data-row-id="${row.id}">
          <div class="flex items-start justify-between gap-2 mb-3">
            <input type="text" class="field-input sgpa-name-input" style="font-family:'Inter',sans-serif;" placeholder="Subject name" value="${escapeAttr(row.name)}" />
            <button class="icon-btn sgpa-remove shrink-0" aria-label="Remove subject">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="flex items-center justify-between mb-3">
            <label class="text-[11px] text-zinc-500">Credits</label>
            <select class="field-select sgpa-credits-select" style="width:auto;padding:5px 10px;">
              ${[1, 2, 3, 4].map((c) => `<option value="${c}" ${c === row.credits ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>
          <div class="grade-matrix">
            ${GRADE_ORDER.map((g) => `<button class="grade-btn ${g === row.grade ? "is-selected" : ""}" data-grade="${g}">${g}</button>`).join("")}
          </div>
        </div>`)
      .join("");

    host.querySelectorAll(".subject-card").forEach((card) => {
      const rowId = card.dataset.rowId;
      const row = state.sgpa.subjects.find((r) => r.id === rowId);

      card.querySelector(".sgpa-name-input").addEventListener("input", (e) => {
        row.name = e.target.value;
        saveState(state);
      });
      card.querySelector(".sgpa-credits-select").addEventListener("change", (e) => {
        row.credits = Number(e.target.value);
        saveState(state);
        renderSgpaRing();
      });
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
      resultEl.className = "result-panel is-fail";
      resultEl.innerHTML = "Enter your IA marks first.";
      return;
    }
    if (ia < 0 || ia > 50) {
      resultEl.className = "result-panel is-fail";
      resultEl.innerHTML = "IA marks must be between 0 and 50.";
      return;
    }

    const see = requiredSEE(targetTotal, ia);
    if (see > 100) {
      resultEl.className = "result-panel is-fail";
      resultEl.innerHTML = `Mathematically impossible to achieve this grade with your current internals — you'd need ${see.toFixed(1)}/100 in the SEE.`;
    } else if (see <= 0) {
      resultEl.className = "result-panel is-success";
      resultEl.innerHTML = `Your internals alone already clear this grade's total. You'll still need to meet VTU's minimum SEE pass mark (commonly cited as 35/100 — confirm for your scheme).`;
    } else {
      resultEl.className = "result-panel is-success";
      resultEl.innerHTML = `Score at least <span class="font-mono font-bold text-base">${Math.ceil(see)}/100</span> in the SEE to secure this grade.`;
    }
  });

  renderSgpaGrid();
}

/* ---------------------------------------------------------
   12. CONTROL CENTER
   --------------------------------------------------------- */

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

  sat.addEventListener("change", () => {
    state.settings.weekendOff.saturday = sat.checked;
    saveState(state);
    renderRollCall();
  });
  sun.addEventListener("change", () => {
    state.settings.weekendOff.sunday = sun.checked;
    saveState(state);
    renderRollCall();
  });
}

function renderTimetableBuilder() {
  const host = document.getElementById("timetable-builder");
  host.innerHTML = DAY_ORDER
    .map((day) => `
      <div class="day-block" data-day="${day}">
        <div class="day-block-title">
          <span>${day}</span>
          <button class="ghost-btn add-period-btn" data-day="${day}">+ Add period</button>
        </div>
        <div class="periods-list" data-day="${day}"></div>
      </div>`)
    .join("");

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
    list.innerHTML = `<p class="text-[12px] text-zinc-600">No periods yet.</p>`;
    return;
  }

  list.innerHTML = periods
    .map((p) => `
      <div class="period-row" data-period-id="${p.id}">
        <input type="text" class="field-input pt-subject" style="font-family:'Inter',sans-serif;" placeholder="Subject name" value="${escapeAttr(p.subject)}" />
        <input type="time" class="field-input pt-start" value="${p.start}" />
        <input type="time" class="field-input pt-end" value="${p.end}" />
        <button class="icon-btn pt-remove" aria-label="Remove period">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>`)
    .join("");

  list.querySelectorAll(".period-row").forEach((row) => {
    const periodId = row.dataset.periodId;
    const p = periods.find((x) => x.id === periodId);

    row.querySelector(".pt-subject").addEventListener("input", (e) => {
      p.subject = e.target.value;
      saveState(state);
    });
    row.querySelector(".pt-subject").addEventListener("blur", (e) => {
      if (e.target.value.trim()) ensureSubjectEntry(e.target.value.trim());
      renderRollCall();
      renderSubjectGrid();
    });
    row.querySelector(".pt-start").addEventListener("change", (e) => {
      p.start = e.target.value;
      saveState(state);
      renderRollCall();
    });
    row.querySelector(".pt-end").addEventListener("change", (e) => {
      p.end = e.target.value;
      saveState(state);
      renderRollCall();
    });
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
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    state = buildSampleState();
    saveState(state, { silent: true });
    if (fb && currentUser) {
      try { await fb.setDoc(fb.doc(fb.db, "users", currentUser.uid), state); } catch (err) { console.error("BunkSmart: cloud reset failed.", err); }
    }
    modal.classList.add("hidden");
    renderAll();
    showToast("All data reset. Fresh sample data loaded.");
  });
}

/* ---------------------------------------------------------
   13. FIREBASE AUTH + CLOUD SYNC (optional, graceful fallback)
   --------------------------------------------------------- */

async function initFirebase() {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.info("BunkSmart: Firebase config not set — running in local-only mode. Fill in firebaseConfig in app.js to enable cloud sync.");
    return null;
  }
  try {
    const [{ initializeApp }, authMod, storeMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
    ]);
    const app = initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    const db = storeMod.getFirestore(app);
    return {
      auth, db,
      GoogleAuthProvider: authMod.GoogleAuthProvider,
      signInWithPopup: authMod.signInWithPopup,
      onAuthStateChanged: authMod.onAuthStateChanged,
      signOut: authMod.signOut,
      doc: storeMod.doc,
      getDoc: storeMod.getDoc,
      setDoc: storeMod.setDoc,
    };
  } catch (err) {
    console.error("BunkSmart: Firebase failed to load (offline, blocked, or misconfigured) — continuing in local-only mode.", err);
    return null;
  }
}

function scheduleCloudSave() {
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(async () => {
    if (!fb || !currentUser) return;
    try {
      await fb.setDoc(fb.doc(fb.db, "users", currentUser.uid), state);
    } catch (err) {
      console.error("BunkSmart: cloud save failed — your data remains safe in localStorage.", err);
    }
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
      <span>${escapeHtml((user.displayName || user.email || "Signed in").split(" ")[0])}</span>
    </button>`;
  document.getElementById("user-avatar-btn").addEventListener("click", async () => {
    try {
      await fb.signOut(fb.auth);
      showToast("Signed out. Your data stays on this device.");
    } catch (err) {
      console.error("BunkSmart: sign-out failed.", err);
    }
  });

  // Bulletproof cloud merge: prefer whichever copy (local vs cloud) was saved
  // most recently, so a fresh sign-in never silently clobbers newer local work.
  try {
    const snap = await fb.getDoc(fb.doc(fb.db, "users", user.uid));
    if (snap.exists()) {
      const cloudState = snap.data();
      if (isValidState(cloudState)) {
        const cloudIsNewer = (cloudState.lastSaved || 0) > (state.lastSaved || 0);
        if (cloudIsNewer) {
          state = reconcileState(cloudState);
          saveState(state, { silent: true });
          renderAll();
          showToast("Synced with your cloud backup.");
        } else {
          await fb.setDoc(fb.doc(fb.db, "users", user.uid), state);
          showToast("Cloud backup updated with this device's data.");
        }
      }
    } else {
      await fb.setDoc(fb.doc(fb.db, "users", user.uid), state);
      showToast("Cloud backup created.");
    }
  } catch (err) {
    console.error("BunkSmart: cloud sync failed — continuing with local data only.", err);
    showToast("Signed in, but cloud sync is unavailable right now.");
  }
}

function bindSignInButton() {
  const btn = document.getElementById("signin-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (!fb) {
      showToast("Cloud sync isn't configured for this deployment yet — your data stays safely on this device.");
      return;
    }
    try {
      await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
    } catch (err) {
      console.error("BunkSmart: sign-in failed.", err);
      showToast("Sign-in was cancelled or failed. Your local data is unaffected.");
    }
  });
}

/* ---------------------------------------------------------
   14. UTIL
   --------------------------------------------------------- */

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

/* ---------------------------------------------------------
   15. INIT
   --------------------------------------------------------- */

function renderAll() {
  renderHeader();
  renderRollCall();
  renderSubjectGrid();
  renderCalendar();
  renderSgpaGrid();
  document.getElementById("toggle-saturday").checked = state.settings.weekendOff.saturday;
  document.getElementById("toggle-sunday").checked = state.settings.weekendOff.sunday;
  document.getElementById("target-slider").value = state.settings.targetPercentage;
  document.getElementById("target-slider-value").textContent = `${state.settings.targetPercentage}%`;
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
  if (fb) {
    fb.onAuthStateChanged(fb.auth, handleAuthChange);
  }
}

document.addEventListener("DOMContentLoaded", init);
