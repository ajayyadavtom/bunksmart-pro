(function () {
  "use strict";

  const STORAGE_KEY = "bunksmart_pro_state_v4";
  const LEGACY_STORAGE_KEYS = ["bunksmart_pro_state_v3", "bunksmart_pro_state_v2"];
  const USERS_REGISTRY_KEY = "bunksmart_users_registry_v1";
  const ACTIVE_ROLL_KEY = "bunksmart_active_roll_v1";
  const USER_STATE_PREFIX = "bunksmart_user_data_v1_";
  const AUTO_DOWNLOAD_PREF_KEY = "bunksmart_auto_download_v1";
  const PHONE_DB_NAME = "BunkSmartPhoneDB";
  const PHONE_DB_VERSION = 1;
  const THEME_KEY = "bunksmart_theme";
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const GRADE_POINTS = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, P: 4, F: 0 };

  let toastTimer = null;
  let selectedRollCallDate = null; // Initialized after local date helper is ready
  let editingSubject = null;
  let graphSubject = null;
  let graphSubjectMode = "cumulative"; // "cumulative" | "daily"
  let graphSelectedIndex = null;
  let fullGraphOpen = false;
  let fullGraphSubject = null;
  let fullGraphYear = new Date().getFullYear();
  let fullGraphMonth = new Date().getMonth();
  let fullGraphMode = "daily"; // "daily" | "cumulative"
  let fullGraphSelectedDate = null;
  let rcCalendarOpen = false;
  let rcCalendarYear = new Date().getFullYear();
  let rcCalendarMonth = new Date().getMonth();
  let phoneDbInstance = null;
  let phoneDirectoryHandle = null;
  let phonePersistGranted = null;
  let lastFileSyncAt = null;
  let lastFileSyncStatus = "Phone DB ready";

  /* --- DOM & STRING HELPERS --- */
  function getEl(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(msg, type = "info") {
    const el = getEl("toast");
    if (!el) return;

    el.textContent = msg;
    el.dataset.type = type;
    el.classList.add("show");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2800);
  }

  /* --- LOCAL DATE HELPERS --- */
  function isoDate(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return new Date();
    const [y, m, d] = dateKey.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  selectedRollCallDate = isoDate();

  /* --- STATE MANAGEMENT --- */
  function buildSampleState() {
    return {
      settings: { weeklyHolidays: [0], targetPercentage: 75, startDate: "", endDate: "" },
      timetable: {
        Sunday: [],
        Monday: ["OS", "DS", "JAVA", "PDS", "DDCO", "GIT LAB(A1)"],
        Tuesday: ["DDCO", "DS", "PDS", "OS", "GIT LAB(A2)", "TUTORIALS"],
        Wednesday: ["DS", "DDCO", "PDS", "JAVA", "SOCIETAL PROJECT"],
        Thursday: ["JAVA", "DS", "YOGA", "OS", "DS Lab(A2)/JAVA Lab(A1)", "SOCIETAL PROJECT"],
        Friday: ["PDS", "OS", "DS Lab(A1)/JAVA Lab(A2)", "DDCO", "JAVA", "TUTORIALS"],
        Saturday: ["JAVA", "PDS", "OS", "DS", "DIP MATHS", "DIP MATHS", "TUTORIALS"]
      },
      attendance: {
        OS: { attended: 0, total: 0, history: [] },
        DS: { attended: 0, total: 0, history: [] },
        JAVA: { attended: 0, total: 0, history: [] },
        PDS: { attended: 0, total: 0, history: [] },
        DDCO: { attended: 0, total: 0, history: [] },
        "GIT LAB(A1)": { attended: 0, total: 0, history: [] },
        "GIT LAB(A2)": { attended: 0, total: 0, history: [] },
        "DS Lab(A1)/JAVA Lab(A2)": { attended: 0, total: 0, history: [] },
        "DS Lab(A2)/JAVA Lab(A1)": { attended: 0, total: 0, history: [] },
        "SOCIETAL PROJECT": { attended: 0, total: 0, history: [] },
        YOGA: { attended: 0, total: 0, history: [] },
        "DIP MATHS": { attended: 0, total: 0, history: [] },
        TUTORIALS: { attended: 0, total: 0, history: [] }
      },
      dailyMarks: {},
      sgpaRows: [
        { subject: "PDS", credits: 4, grade: "A" },
        { subject: "JAVA", credits: 4, grade: "A" },
        { subject: "DDCO", credits: 4, grade: "A" },
        { subject: "OS", credits: 3, grade: "A" },
        { subject: "DS", credits: 3, grade: "A" },
        { subject: "DS Lab", credits: 1, grade: "A+" },
        { subject: "GIT", credits: 1, grade: "A+" },
        { subject: "SOCIETAL PROJECT", credits: 1, grade: "A+" }
      ]
    };
  }

  function buildEmptyState() {
    return {
      settings: { weeklyHolidays: [0], targetPercentage: 75, startDate: "", endDate: "" },
      timetable: {
        Sunday: [],
        Monday: [],
        Tuesday: [],
        Wednesday: [],
        Thursday: [],
        Friday: [],
        Saturday: []
      },
      attendance: {},
      dailyMarks: {},
      sgpaRows: [{ subject: "", credits: 4, grade: "A" }]
    };
  }

  function sanitizeState(rawState) {
    const fallback = buildSampleState();
    if (!rawState || typeof rawState !== "object") return fallback;

    const clean = {
      settings: {
        weeklyHolidays: Array.isArray(rawState.settings?.weeklyHolidays)
          ? [...new Set(rawState.settings.weeklyHolidays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
          : [0],
        targetPercentage: clampNumber(Number(rawState.settings?.targetPercentage ?? 75), 1, 100, 75),
        startDate: typeof rawState.settings?.startDate === "string" ? rawState.settings.startDate : "",
        endDate: typeof rawState.settings?.endDate === "string" ? rawState.settings.endDate : ""
      },
      timetable: {},
      attendance: {},
      dailyMarks: rawState.dailyMarks && typeof rawState.dailyMarks === "object" && !Array.isArray(rawState.dailyMarks)
        ? rawState.dailyMarks
        : {},
      sgpaRows: []
    };

    DAY_NAMES.forEach((day) => {
      const list = rawState.timetable?.[day];
      clean.timetable[day] = Array.isArray(list)
        ? list.map((s) => String(s).trim()).filter(Boolean)
        : [];
    });

    if (rawState.attendance && typeof rawState.attendance === "object" && !Array.isArray(rawState.attendance)) {
      Object.entries(rawState.attendance).forEach(([sub, rec]) => {
        const name = String(sub).trim();
        if (!name || !rec || typeof rec !== "object") return;
        const total = Math.max(0, Math.floor(Number(rec.total) || 0));
        const attended = Math.min(total, Math.max(0, Math.floor(Number(rec.attended) || 0)));
        clean.attendance[name] = {
          attended,
          total,
          history: Array.isArray(rec.history) ? rec.history : [],
          manual: Boolean(rec.manual)
        };
      });
    }

    if (Array.isArray(rawState.sgpaRows) && rawState.sgpaRows.length > 0) {
      clean.sgpaRows = rawState.sgpaRows.map((row) => ({
        subject: typeof row?.subject === "string" ? row.subject : "",
        credits: Math.max(0, Number(row?.credits) || 0),
        grade: Object.prototype.hasOwnProperty.call(GRADE_POINTS, row?.grade) ? row.grade : "A"
      }));
    } else {
      clean.sgpaRows = [{ subject: "", credits: 4, grade: "A" }];
    }

    return clean;
  }

  function clampNumber(val, min, max, fallback) {
    if (!Number.isFinite(val)) return fallback;
    return Math.min(max, Math.max(min, val));
  }

  function isLegacyDefaultDemo(parsed) {
    const tt = parsed?.timetable || {};
    const mon = tt.Monday;
    const tue = tt.Tuesday;
    const fri = tt.Friday;
    return (
      Array.isArray(mon) && mon.join(",") === "Maths,Physics,CS" &&
      Array.isArray(tue) && tue.join(",") === "English,Maths" &&
      Array.isArray(fri) && fri.join(",") === "Physics,CS,Lab"
    );
  }

  /* --- STUDENT PHONE-LOCAL AUTH, DATABASE & MONTHLY FILES --- */
  function normalizeRollNo(rawRoll) {
    return String(rawRoll || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, "");
  }

  function loadUsersRegistry() {
    try {
      const raw = localStorage.getItem(USERS_REGISTRY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveUsersRegistry(registry) {
    try {
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(registry));
    } catch (e) {
      // Ignore storage error
    }
  }

  function getActiveRollNo() {
    try {
      return normalizeRollNo(localStorage.getItem(ACTIVE_ROLL_KEY) || "");
    } catch (e) {
      return "";
    }
  }

  function setActiveRollNo(rollNo) {
    try {
      if (rollNo) localStorage.setItem(ACTIVE_ROLL_KEY, rollNo);
      else localStorage.removeItem(ACTIVE_ROLL_KEY);
    } catch (e) {
      // Ignore storage error
    }
  }

  function getActiveUser() {
    const roll = getActiveRollNo();
    if (!roll) return null;
    const reg = loadUsersRegistry();
    return reg[roll] || null;
  }

  function userDataStorageKey(rollNo) {
    return `${USER_STATE_PREFIX}${rollNo}`;
  }

  function getAutoDownloadEnabled() {
    try {
      return localStorage.getItem(AUTO_DOWNLOAD_PREF_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setAutoDownloadEnabled(enabled) {
    try {
      localStorage.setItem(AUTO_DOWNLOAD_PREF_KEY, enabled ? "1" : "0");
    } catch (e) {
      // Ignore storage error
    }
  }

  function loadState() {
    try {
      const activeRoll = getActiveRollNo();
      if (activeRoll) {
        const userRaw = localStorage.getItem(userDataStorageKey(activeRoll));
        if (userRaw) {
          const parsedUser = JSON.parse(userRaw);
          if (parsedUser && typeof parsedUser === "object" && parsedUser.settings && parsedUser.timetable) {
            return sanitizeState(parsedUser);
          }
        }
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.settings || !parsed.timetable) {
          return buildSampleState();
        }
        return sanitizeState(parsed);
      }

      // Migrate custom user data from prior storage keys, but upgrade any old Maths/Physics/CS demo to the 3rd Sem CSE default timetable
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (!legacyRaw) continue;
        const legacyParsed = JSON.parse(legacyRaw);
        if (legacyParsed && typeof legacyParsed === "object" && legacyParsed.settings && legacyParsed.timetable) {
          if (!isLegacyDefaultDemo(legacyParsed)) {
            const migrated = sanitizeState(legacyParsed);
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
            } catch (e) {
              // Ignore
            }
            return migrated;
          }
          break;
        }
      }

      return buildSampleState();
    } catch (e) {
      return buildSampleState();
    }
  }

  function getAvailableMonthKeys(currentState = state, refDate = new Date()) {
    const months = new Set();
    const currentMonth = isoDate(refDate).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(currentMonth)) months.add(currentMonth);

    Object.keys(currentState?.dailyMarks || {}).forEach((dateKey) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        months.add(dateKey.slice(0, 7));
      }
    });

    return [...months].sort((a, b) => b.localeCompare(a));
  }

  function formatMonthLabel(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return String(monthKey || "");
    const [year, month] = monthKey.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }

  function buildMonthlyAttendanceReport(currentState, monthKey, userRecord = getActiveUser()) {
    const cleanMonth = /^\d{4}-\d{2}$/.test(String(monthKey || "")) ? monthKey : isoDate().slice(0, 7);
    const dailyMarks = currentState?.dailyMarks || {};
    const attendance = currentState?.attendance || {};
    const subjectStats = {};
    const dailyRecords = [];

    Object.keys(attendance).forEach((sub) => {
      subjectStats[sub] = { subject: sub, present: 0, absent: 0, cancelled: 0, held: 0 };
    });

    const monthDates = Object.keys(dailyMarks)
      .filter((dk) => dk.startsWith(`${cleanMonth}-`))
      .sort((a, b) => a.localeCompare(b));

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalCancelled = 0;

    monthDates.forEach((dateKey) => {
      const dayMap = dailyMarks[dateKey] || {};
      const dt = parseLocalDate(dateKey);
      const weekday = DAY_NAMES[dt.getDay()];
      const isHoliday = Boolean(dayMap.isHoliday);
      const entries = [];

      if (!isHoliday) {
        Object.keys(dayMap)
          .filter((k) => k !== "isHoliday" && k.includes("#"))
          .sort((a, b) => Number(a.split("#")[0]) - Number(b.split("#")[0]))
          .forEach((k) => {
            const slotIndex = Number(k.split("#")[0]);
            const subject = k.split("#").slice(1).join("#");
            const status = dayMap[k];
            if (!subjectStats[subject]) {
              subjectStats[subject] = { subject, present: 0, absent: 0, cancelled: 0, held: 0 };
            }
            if (status === "attended") {
              subjectStats[subject].present += 1;
              subjectStats[subject].held += 1;
              totalPresent += 1;
            } else if (status === "bunked") {
              subjectStats[subject].absent += 1;
              subjectStats[subject].held += 1;
              totalAbsent += 1;
            } else if (status === "holiday") {
              subjectStats[subject].cancelled += 1;
              totalCancelled += 1;
            }
            entries.push({ slot: slotIndex + 1, subject, status });
          });
      }

      dailyRecords.push({ dateKey, weekday, isHoliday, entries });
    });

    const subjects = Object.values(subjectStats).map((s) => {
      const cum = attendance[s.subject] || { attended: 0, total: 0 };
      const monthlyPct = s.held > 0 ? Number(((s.present / s.held) * 100).toFixed(2)) : null;
      const cumulativePct = cum.total > 0 ? Number(((cum.attended / cum.total) * 100).toFixed(2)) : null;
      return {
        ...s,
        monthlyPct,
        cumulativeAttended: cum.attended,
        cumulativeTotal: cum.total,
        cumulativePct
      };
    });

    const totalHeld = totalPresent + totalAbsent;
    return {
      monthKey: cleanMonth,
      monthLabel: formatMonthLabel(cleanMonth),
      rollNo: userRecord?.displayRollNo || userRecord?.rollNo || "LOCAL",
      studentName: userRecord?.name || "Student",
      generatedAt: new Date().toISOString(),
      totalDaysMarked: dailyRecords.length,
      overall: {
        present: totalPresent,
        absent: totalAbsent,
        cancelled: totalCancelled,
        held: totalHeld,
        monthlyPct: totalHeld > 0 ? Number(((totalPresent / totalHeld) * 100).toFixed(2)) : null
      },
      subjects,
      dailyRecords
    };
  }

  function pdfAsciiSafe(value) {
    return String(value ?? "")
      .replace(/[•·]/g, "-")
      .replace(/[—–]/g, "-")
      .replace(/[✓✔]/g, "Present")
      .replace(/[✕✖]/g, "Absent")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pdfEscapeString(text) {
    return pdfAsciiSafe(text)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  /**
   * Builds a multi-page PDF 1.4 document from structured drawing commands.
   * Uses standard Type1 Helvetica & Helvetica-Bold fonts so it works 100% offline.
   */
  function buildPdfDocumentBytes(pagesOps) {
    const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
    const toBytes = (str) => {
      if (encoder) return encoder.encode(str);
      const arr = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) arr[i] = str.charCodeAt(i) & 0xff;
      return arr;
    };

    const objects = [];
    // 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold
    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    const pageObjIds = [];
    const firstPageObjId = 5;
    pagesOps.forEach((_, i) => pageObjIds.push(firstPageObjId + i * 2));

    objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIds.length} >>\nendobj\n`);
    objects.push("3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
    objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

    pagesOps.forEach((ops, idx) => {
      const pageId = firstPageObjId + idx * 2;
      const contentId = pageId + 1;
      const streamStr = ops.join("\n");
      const streamLen = toBytes(streamStr).length;

      objects.push(
        `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
      );
      objects.push(
        `${contentId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamStr}\nendstream\nendobj\n`
      );
    });

    const parts = ["%PDF-1.4\n"];
    let offset = toBytes(parts[0]).length;
    const offsets = [0];

    objects.forEach((objStr) => {
      offsets.push(offset);
      parts.push(objStr);
      offset += toBytes(objStr).length;
    });

    const xrefOffset = offset;
    let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(xref, trailer);

    return toBytes(parts.join(""));
  }

  function createPdfLayoutWriter(headerTitle, headerSubtitle) {
    const pages = [];
    let ops = [];
    let y = 795;

    const addHeader = (isContinuation) => {
      ops.push("0.31 0.27 0.90 rg");
      ops.push("36 772 523 44 re f");
      ops.push("1 1 1 rg");
      ops.push("BT /F2 15 Tf 48 798 Td (" + pdfEscapeString(headerTitle) + ") Tj ET");
      const sub = isContinuation ? `${headerSubtitle} (Continued)` : headerSubtitle;
      ops.push("BT /F1 9.5 Tf 48 782 Td (" + pdfEscapeString(sub) + ") Tj ET");
      ops.push("0.06 0.09 0.16 rg");
      y = 750;
    };

    const startNewPage = (isCont = true) => {
      if (ops.length > 0) pages.push(ops);
      ops = [];
      addHeader(isCont);
    };

    const ensureSpace = (needed = 24) => {
      if (y - needed < 48) {
        startNewPage(true);
      }
    };

    const text = (x, size, bold, str, rgb = "0.06 0.09 0.16") => {
      const font = bold ? "/F2" : "/F1";
      ops.push(`${rgb} rg`);
      ops.push(`BT ${font} ${size} Tf ${x} ${y} Td (${pdfEscapeString(str)}) Tj ET`);
    };

    const line = (yPos = y) => {
      ops.push("0.88 0.91 0.94 RG 0.7 w");
      ops.push(`36 ${yPos} m 559 ${yPos} l S`);
    };

    const box = (x, yBottom, w, h, rgb = "0.96 0.97 0.99") => {
      ops.push(`${rgb} rg`);
      ops.push(`${x} ${yBottom} ${w} ${h} re f`);
    };

    startNewPage(false);

    return {
      ensureSpace,
      text,
      line,
      box,
      getY: () => y,
      moveY: (delta) => { y += delta; },
      finish: () => {
        if (ops.length > 0) pages.push(ops);
        return buildPdfDocumentBytes(pages);
      }
    };
  }

  function truncatePdfCol(str, maxLen) {
    const s = pdfAsciiSafe(str);
    return s.length > maxLen ? s.slice(0, maxLen - 2) + ".." : s;
  }

  function buildMonthlyAttendancePdf(report) {
    const w = createPdfLayoutWriter(
      "BunkSmart Pro - Monthly Attendance Report",
      `${report.monthLabel} (${report.monthKey})`
    );

    // Student & summary box
    w.box(36, w.getY() - 42, 523, 50, "0.95 0.96 0.99");
    w.text(46, 10.5, true, `Student: ${report.studentName}   |   Roll No: ${report.rollNo}   |   Generated: ${isoDate()}`);
    w.moveY(-18);
    const ovPct = report.overall.monthlyPct === null ? "N/A" : `${report.overall.monthlyPct}%`;
    w.text(
      46,
      10,
      false,
      `Month Summary -> Present: ${report.overall.present}   |   Absent: ${report.overall.absent}   |   Cancelled: ${report.overall.cancelled}   |   Total Held: ${report.overall.held}   |   Monthly Rate: ${ovPct}`
    );
    w.moveY(-36);

    // Subject Breakdown Table
    w.ensureSpace(50);
    w.text(36, 12, true, "Subject-Wise Attendance Summary", "0.18 0.22 0.35");
    w.moveY(-16);

    w.box(36, w.getY() - 6, 523, 20, "0.90 0.92 0.97");
    w.text(42, 9, true, "Subject");
    w.text(185, 9, true, "Present");
    w.text(240, 9, true, "Absent");
    w.text(292, 9, true, "Held");
    w.text(342, 9, true, "Month %");
    w.text(412, 9, true, "Overall (A/T)");
    w.text(498, 9, true, "Overall %");
    w.moveY(-20);

    (report.subjects || []).forEach((s) => {
      w.ensureSpace(20);
      const mPct = s.monthlyPct === null ? "--" : `${s.monthlyPct}%`;
      const cPct = s.cumulativePct === null ? "--" : `${s.cumulativePct}%`;
      w.text(42, 9.5, true, truncatePdfCol(s.subject, 22));
      w.text(192, 9.5, false, String(s.present), "0.08 0.50 0.24");
      w.text(246, 9.5, false, String(s.absent), s.absent > 0 ? "0.75 0.07 0.24" : "0.06 0.09 0.16");
      w.text(298, 9.5, false, String(s.held));
      w.text(344, 9.5, false, mPct);
      w.text(418, 9.5, false, `${s.cumulativeAttended}/${s.cumulativeTotal}`);
      w.text(500, 9.5, true, cPct);
      w.line(w.getY() - 5);
      w.moveY(-18);
    });

    // Daily Logs Section
    w.moveY(-12);
    w.ensureSpace(50);
    w.text(36, 12, true, "Daily Attendance Log (Date-by-Date)", "0.18 0.22 0.35");
    w.moveY(-16);

    if (!report.dailyRecords || report.dailyRecords.length === 0) {
      w.text(36, 9.5, false, "No daily roll call entries logged in this month yet.", "0.39 0.45 0.55");
    } else {
      w.box(36, w.getY() - 6, 523, 20, "0.90 0.92 0.97");
      w.text(42, 9, true, "Date");
      w.text(122, 9, true, "Day");
      w.text(200, 9, true, "Classes Marked");
      w.moveY(-20);

      report.dailyRecords.forEach((d) => {
        w.ensureSpace(20);
        const markText = d.isHoliday
          ? "HOLIDAY"
          : d.entries.map((e) => `${e.subject}: ${e.status === "attended" ? "Present" : e.status === "bunked" ? "Absent" : "Cancelled"}`).join(", ");
        w.text(42, 9, false, d.dateKey);
        w.text(122, 9, false, d.weekday.slice(0, 3));
        const hasAbs = d.entries.some((e) => e.status === "bunked");
        w.text(200, 9, false, truncatePdfCol(markText, 64), hasAbs ? "0.75 0.07 0.24" : "0.06 0.09 0.16");
        w.line(w.getY() - 5);
        w.moveY(-17);
      });
    }

    return w.finish();
  }

  function buildCompleteAttendancePdf(currentState = state, userRecord = getActiveUser()) {
    const metrics = computeAllMetrics(currentState);
    const studentName = userRecord?.name || "Student";
    const rollNo = userRecord?.displayRollNo || "LOCAL";
    const w = createPdfLayoutWriter(
      "BunkSmart Pro - Complete Attendance Report",
      `Student: ${studentName} (${rollNo})`
    );

    w.box(36, w.getY() - 42, 523, 50, "0.95 0.96 0.99");
    w.text(46, 10.5, true, `Student: ${studentName}   |   Roll No: ${rollNo}   |   Target: ${metrics.targetPct}%   |   Date: ${isoDate()}`);
    w.moveY(-18);
    const ovPct = formatPct(metrics.overall.percentage);
    w.text(
      46,
      10,
      false,
      `Overall: ${metrics.overall.attended}/${metrics.overall.total} (${ovPct})   |   Missed: ${metrics.overall.burned}   |   ${metrics.overall.shortText}`
    );
    w.moveY(-36);

    w.ensureSpace(50);
    w.text(36, 12, true, "All Subjects Attendance Summary", "0.18 0.22 0.35");
    w.moveY(-16);

    w.box(36, w.getY() - 6, 523, 20, "0.90 0.92 0.97");
    w.text(42, 9, true, "Subject");
    w.text(185, 9, true, "Attended");
    w.text(245, 9, true, "Missed");
    w.text(300, 9, true, "Total");
    w.text(355, 9, true, "Rate %");
    w.text(425, 9, true, "Status / Safe Skips");
    w.moveY(-20);

    metrics.subjects.forEach((s) => {
      w.ensureSpace(20);
      w.text(42, 9.5, true, truncatePdfCol(s.subject, 22));
      w.text(192, 9.5, false, String(s.attended), "0.08 0.50 0.24");
      w.text(252, 9.5, false, String(s.burned), s.burned > 0 ? "0.75 0.07 0.24" : "0.06 0.09 0.16");
      w.text(306, 9.5, false, String(s.total));
      w.text(355, 9.5, true, formatPct(s.percentage));
      w.text(425, 9, false, truncatePdfCol(s.shortText, 24));
      w.line(w.getY() - 5);
      w.moveY(-18);
    });

    const months = getAvailableMonthKeys(currentState);
    if (months.length > 0) {
      w.moveY(-12);
      w.ensureSpace(50);
      w.text(36, 12, true, "Monthly Breakdown", "0.18 0.22 0.35");
      w.moveY(-16);
      months.forEach((mk) => {
        w.ensureSpace(20);
        const rep = buildMonthlyAttendanceReport(currentState, mk, userRecord);
        const pctText = rep.overall.monthlyPct === null ? "No marks" : `${rep.overall.monthlyPct}%`;
        w.text(
          42,
          9.5,
          false,
          `${rep.monthLabel} (${mk}): Present ${rep.overall.present}, Absent ${rep.overall.absent}, Held ${rep.overall.held}, Rate ${pctText}`
        );
        w.moveY(-16);
      });
    }

    return w.finish();
  }

  function buildCompletePhoneDatabasePayload(currentState = state, userRecord = getActiveUser()) {
    const rollKey = userRecord?.rollNo || "LOCAL";
    const months = getAvailableMonthKeys(currentState);
    const monthlyArchives = {};
    months.forEach((m) => {
      monthlyArchives[m] = buildMonthlyAttendanceReport(currentState, m, userRecord);
    });

    const dailyLogs = {};
    Object.keys(currentState?.dailyMarks || {})
      .sort()
      .forEach((dateKey) => {
        dailyLogs[dateKey] = {
          dateKey,
          monthKey: dateKey.slice(0, 7),
          weekday: DAY_NAMES[parseLocalDate(dateKey).getDay()],
          ...currentState.dailyMarks[dateKey]
        };
      });

    return {
      schema: "bunksmart-phone-db-v1",
      savedAt: new Date().toISOString(),
      user: userRecord || { rollNo: rollKey, displayRollNo: rollKey, name: "Student" },
      usersOnPhone: Object.values(loadUsersRegistry()),
      state: currentState,
      dailyLogs,
      monthlyArchives
    };
  }

  function openPhoneIndexedDB() {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    if (phoneDbInstance) return Promise.resolve(phoneDbInstance);

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(PHONE_DB_NAME, PHONE_DB_VERSION);
        req.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains("users")) {
            db.createObjectStore("users", { keyPath: "rollNo" });
          }
          if (!db.objectStoreNames.contains("profiles")) {
            db.createObjectStore("profiles", { keyPath: "rollNo" });
          }
          if (!db.objectStoreNames.contains("daily_logs")) {
            const ds = db.createObjectStore("daily_logs", { keyPath: "id" });
            ds.createIndex("by_roll", "rollNo", { unique: false });
            ds.createIndex("by_month", "monthKey", { unique: false });
          }
          if (!db.objectStoreNames.contains("monthly_archives")) {
            const ms = db.createObjectStore("monthly_archives", { keyPath: "id" });
            ms.createIndex("by_roll", "rollNo", { unique: false });
            ms.createIndex("by_month", "monthKey", { unique: false });
          }
          if (!db.objectStoreNames.contains("file_handles")) {
            db.createObjectStore("file_handles", { keyPath: "id" });
          }
        };
        req.onsuccess = (event) => {
          phoneDbInstance = event.target.result;
          resolve(phoneDbInstance);
        };
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function idbPut(db, storeName, value) {
    if (!db) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function idbGet(db, storeName, key) {
    if (!db) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function writeTextToDirFile(dirHandle, subdirs, filename, content) {
    let targetDir = dirHandle;
    for (const sub of subdirs) {
      targetDir = await targetDir.getDirectoryHandle(sub, { create: true });
    }
    const fileHandle = await targetDir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async function writeDatabaseFilesToPhoneFolder(currentState, userRecord, changedDateKey = null) {
    if (!phoneDirectoryHandle) return false;
    try {
      const perm = await phoneDirectoryHandle.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        lastFileSyncStatus = "Phone folder needs permission tap";
        return false;
      }

      const rollSlug = userRecord?.rollNo || "LOCAL";
      const rootFolder = `BunkSmart_${rollSlug}`;
      const dbPayload = buildCompletePhoneDatabasePayload(currentState, userRecord);
      await writeTextToDirFile(phoneDirectoryHandle, [rootFolder], "database.json", JSON.stringify(dbPayload, null, 2));

      const monthsToWrite = new Set(getAvailableMonthKeys(currentState));
      if (changedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(changedDateKey)) {
        monthsToWrite.add(changedDateKey.slice(0, 7));
        const dayRecord = {
          rollNo: userRecord?.displayRollNo || rollSlug,
          studentName: userRecord?.name || "Student",
          dateKey: changedDateKey,
          weekday: DAY_NAMES[parseLocalDate(changedDateKey).getDay()],
          marks: currentState.dailyMarks?.[changedDateKey] || {},
          savedAt: new Date().toISOString()
        };
        await writeTextToDirFile(phoneDirectoryHandle, [rootFolder, "daily"], `${changedDateKey}.json`, JSON.stringify(dayRecord, null, 2));
      }

      for (const mk of monthsToWrite) {
        const report = dbPayload.monthlyArchives[mk] || buildMonthlyAttendanceReport(currentState, mk, userRecord);
        await writeTextToDirFile(phoneDirectoryHandle, [rootFolder, "monthly"], `${mk}.json`, JSON.stringify(report, null, 2));
        await writeTextToDirFile(phoneDirectoryHandle, [rootFolder, "monthly"], `${mk}.pdf`, buildMonthlyAttendancePdf(report));
      }

      lastFileSyncAt = new Date().toISOString();
      lastFileSyncStatus = `Auto-saved files in "${phoneDirectoryHandle.name}/${rootFolder}"`;
      return true;
    } catch (e) {
      lastFileSyncStatus = "Folder write paused — re-link folder";
      return false;
    }
  }

  async function syncToPhoneDatabase(currentState, userRecord, changedDateKey = null) {
    const db = await openPhoneIndexedDB();
    const activeUser = userRecord || { rollNo: "LOCAL", displayRollNo: "LOCAL", name: "Student", lastLoginAt: new Date().toISOString() };
    const now = new Date().toISOString();

    if (db) {
      await idbPut(db, "users", activeUser);
      await idbPut(db, "profiles", {
        rollNo: activeUser.rollNo,
        displayRollNo: activeUser.displayRollNo,
        name: activeUser.name,
        state: currentState,
        updatedAt: now
      });

      const dateKeys = changedDateKey ? [changedDateKey] : Object.keys(currentState?.dailyMarks || {});
      for (const dk of dateKeys) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) continue;
        const marks = currentState?.dailyMarks?.[dk] || {};
        await idbPut(db, "daily_logs", {
          id: `${activeUser.rollNo}|${dk}`,
          rollNo: activeUser.rollNo,
          dateKey: dk,
          monthKey: dk.slice(0, 7),
          weekday: DAY_NAMES[parseLocalDate(dk).getDay()],
          isHoliday: Boolean(marks.isHoliday),
          marks,
          updatedAt: now
        });
      }

      const monthKeys = new Set(getAvailableMonthKeys(currentState));
      if (changedDateKey && /^\d{4}-\d{2}-\d{2}$/.test(changedDateKey)) {
        monthKeys.add(changedDateKey.slice(0, 7));
      }
      for (const mk of monthKeys) {
        const report = buildMonthlyAttendanceReport(currentState, mk, activeUser);
        await idbPut(db, "monthly_archives", {
          id: `${activeUser.rollNo}|${mk}`,
          ...report
        });
      }
    }

    const wroteFolder = await writeDatabaseFilesToPhoneFolder(currentState, activeUser, changedDateKey);
    if (!wroteFolder) {
      lastFileSyncAt = now;
      lastFileSyncStatus = db ? "Saved in Phone DB (IndexedDB + LocalStorage)" : "Saved in LocalStorage";
    }
    if (typeof document !== "undefined" && getEl("phone-storage-panel")) {
      renderPhoneStoragePanel();
    }
  }

  function downloadTextFile(filename, content, mimeType = "application/json") {
    if (typeof document === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") return;
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function saveState(s, changedDateKey = null) {
    const activeUser = getActiveUser();
    try {
      const serialized = JSON.stringify(s);
      localStorage.setItem(STORAGE_KEY, serialized);
      if (activeUser) {
        localStorage.setItem(userDataStorageKey(activeUser.rollNo), serialized);
      }
    } catch (e) {
      showToast("Could not save changes to phone storage.", "error");
    }

    if (typeof indexedDB !== "undefined") {
      syncToPhoneDatabase(s, activeUser, changedDateKey);
    }

    if (changedDateKey && getAutoDownloadEnabled() && !phoneDirectoryHandle) {
      const monthKey = changedDateKey.slice(0, 7);
      const report = buildMonthlyAttendanceReport(s, monthKey, activeUser);
      const rollSlug = (activeUser?.rollNo || "student").toLowerCase();
      downloadTextFile(`bunksmart-${rollSlug}-month-${monthKey}.pdf`, buildMonthlyAttendancePdf(report), "application/pdf");
    }
  }

  function loginOrRegisterUser(rawName, rawRoll) {
    const cleanName = String(rawName || "").trim();
    const displayRollNo = String(rawRoll || "").trim();
    const rollNo = normalizeRollNo(displayRollNo);
    if (!cleanName || !rollNo) {
      return { error: "Please enter both your Name and Roll Number." };
    }

    const registry = loadUsersRegistry();
    const now = new Date().toISOString();
    const existing = registry[rollNo];
    let loadedState = null;
    let isNew = false;

    if (existing) {
      const updatedUser = {
        ...existing,
        name: cleanName || existing.name,
        displayRollNo: displayRollNo || existing.displayRollNo,
        lastLoginAt: now
      };
      registry[rollNo] = updatedUser;
      saveUsersRegistry(registry);
      setActiveRollNo(rollNo);

      try {
        const rawUserState = localStorage.getItem(userDataStorageKey(rollNo));
        if (rawUserState) {
          loadedState = sanitizeState(JSON.parse(rawUserState));
        }
      } catch (e) {
        loadedState = null;
      }

      if (!loadedState) {
        loadedState = buildSampleState();
      }
      state = loadedState;
      saveState(state);
      return { isNew: false, user: updatedUser };
    }

    isNew = true;
    const newUser = {
      rollNo,
      displayRollNo,
      name: cleanName,
      createdAt: now,
      lastLoginAt: now
    };
    registry[rollNo] = newUser;
    saveUsersRegistry(registry);
    setActiveRollNo(rollNo);

    // If user had already customized data before first login, carry it once; otherwise load default 3rd Sem CSE timetable
    let initialState = buildSampleState();
    try {
      const preRaw = localStorage.getItem(STORAGE_KEY);
      if (preRaw && Object.keys(registry).length === 1) {
        const preParsed = JSON.parse(preRaw);
        if (preParsed && typeof preParsed === "object" && preParsed.settings && preParsed.timetable && !isLegacyDefaultDemo(preParsed)) {
          initialState = sanitizeState(preParsed);
        }
      }
    } catch (e) {
      initialState = buildSampleState();
    }

    state = initialState;
    saveState(state);
    return { isNew, user: newUser };
  }

  let state = loadState();

  /* --- THEME --- */
  function applyThemeIcons(isDark) {
    const lightIcon = getEl("theme-icon-light");
    const darkIcon = getEl("theme-icon-dark");
    const toggleBtn = getEl("theme-toggle");

    if (isDark) {
      document.documentElement.classList.add("dark");
      if (lightIcon) lightIcon.classList.remove("hidden");
      if (darkIcon) darkIcon.classList.add("hidden");
    } else {
      document.documentElement.classList.remove("dark");
      if (darkIcon) darkIcon.classList.remove("hidden");
      if (lightIcon) lightIcon.classList.add("hidden");
    }

    if (toggleBtn) {
      toggleBtn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      toggleBtn.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  function initTheme() {
    let savedTheme = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
    } catch (e) {
      savedTheme = null;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
    applyThemeIcons(isDark);

    const toggleBtn = getEl("theme-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        const nextDark = !document.documentElement.classList.contains("dark");
        applyThemeIcons(nextDark);
        try {
          localStorage.setItem(THEME_KEY, nextDark ? "dark" : "light");
        } catch (e) {
          // Ignore storage error for theme preference
        }
      });
    }
  }

  /* --- NAVIGATION & SIDEBAR --- */
  function initNav() {
    const sidebar = getEl("sidebar");
    const overlay = getEl("sidebar-overlay");
    const toggleBtn = getEl("menu-toggle");
    const closeBtn = getEl("sidebar-close");

    function openSidebar() {
      if (!sidebar || !overlay) return;
      sidebar.classList.remove("-translate-x-full");
      overlay.classList.remove("hidden");
      setTimeout(() => overlay.classList.remove("opacity-0"), 10);
    }

    function closeSidebar() {
      if (!sidebar || !overlay) return;
      sidebar.classList.add("-translate-x-full");
      overlay.classList.add("opacity-0");
      setTimeout(() => overlay.classList.add("hidden"), 250);
    }

    if (toggleBtn) toggleBtn.addEventListener("click", openSidebar);
    if (closeBtn) closeBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    window.switchView = function (viewId) {
      const targetView = getEl("view-" + viewId);
      if (!targetView) return;

      document.querySelectorAll(".view-section").forEach((el) => el.classList.remove("active"));
      targetView.classList.add("active");

      document.querySelectorAll("[data-view]").forEach((el) => {
        el.classList.toggle("active", el.getAttribute("data-view") === viewId);
      });

      closeSidebar();
      window.scrollTo(0, 0);
    };
  }

  /* --- ATTENDANCE MATH, SEMESTER HORIZON & BUNK ANALYSIS --- */
  function getPercentage(attended, total) {
    if (!total || total <= 0) return null;
    return (attended / total) * 100;
  }

  /**
   * Computes exact safe skips ("bunks"), classes burned, and recovery classes needed for targetPct.
   *
   * Mathematical form (A = attended, T = total, B = T - A = burned, t = targetPct in (0, 100]):
   *   P = (A / T) * 100
   *   If P >= t:  canBunk = floor((100*A - t*T) / t)
   *   If P <  t:  mustAttend = ceil((t*T - 100*A) / (100 - t))   (Infinity if t == 100 and A < T)
   */
  function getBunkAnalysis(attended, total, targetPct) {
    const safeAttended = Math.max(0, Math.floor(Number(attended) || 0));
    const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
    const burned = Math.max(0, safeTotal - safeAttended);

    if (!safeTotal || safeTotal <= 0) {
      return {
        status: "neutral",
        attended: 0,
        burned: 0,
        total: 0,
        percentage: null,
        canBunk: 0,
        mustAttend: 0,
        shortText: "No classes yet",
        detailText: "Mark attendance in Daily Roll Call or edit counts below."
      };
    }

    const pct = (safeAttended / safeTotal) * 100;
    const t = clampNumber(targetPct, 1, 100, 75);

    if (t === 100) {
      if (safeAttended === safeTotal) {
        return {
          status: "safe",
          attended: safeAttended,
          burned: 0,
          total: safeTotal,
          percentage: pct,
          canBunk: 0,
          mustAttend: 0,
          shortText: "On track (0 skips)",
          detailText: "100% target means you cannot miss any class."
        };
      }
      return {
        status: "danger",
        attended: safeAttended,
        burned,
        total: safeTotal,
        percentage: pct,
        canBunk: 0,
        mustAttend: Infinity,
        shortText: "100% unreachable",
        detailText: `Burned ${burned} ${burned === 1 ? "class" : "classes"}. Lower your target below 100% to see recovery steps.`
      };
    }

    if (pct >= t) {
      const canBunk = Math.max(0, Math.floor((safeAttended * 100 - t * safeTotal) / t));
      if (canBunk === 0) {
        return {
          status: "warning",
          attended: safeAttended,
          burned,
          total: safeTotal,
          percentage: pct,
          canBunk: 0,
          mustAttend: 0,
          shortText: "Right on target",
          detailText: `You're at ${pct.toFixed(1)}% (burned ${burned}). Attend the next class to build a buffer.`
        };
      }
      return {
        status: "safe",
        attended: safeAttended,
        burned,
        total: safeTotal,
        percentage: pct,
        canBunk,
        mustAttend: 0,
        shortText: `Safe to skip ${canBunk}`,
        detailText: `You can skip up to ${canBunk} upcoming ${canBunk === 1 ? "class" : "classes"} and still stay >= ${t}%.`
      };
    }

    const mustAttend = Math.max(1, Math.ceil((t * safeTotal - safeAttended * 100) / (100 - t)));
    return {
      status: "danger",
      attended: safeAttended,
      burned,
      total: safeTotal,
      percentage: pct,
      canBunk: 0,
      mustAttend,
      shortText: `Attend next ${mustAttend}`,
      detailText: `Attend the next ${mustAttend} ${mustAttend === 1 ? "class" : "classes"} in a row to reach ${t}%.`
    };
  }

  /**
   * Simulates attending deltaAttend and bunking deltaBunk future classes.
   */
  function simulateWhatIf(attended, total, deltaAttend, deltaBunk, targetPct) {
    const dA = Math.max(0, Math.floor(Number(deltaAttend) || 0));
    const dB = Math.max(0, Math.floor(Number(deltaBunk) || 0));
    const nextAttended = Math.max(0, Math.floor(Number(attended) || 0)) + dA;
    const nextTotal = Math.max(0, Math.floor(Number(total) || 0)) + dA + dB;
    return {
      deltaAttend: dA,
      deltaBunk: dB,
      ...getBunkAnalysis(nextAttended, nextTotal, targetPct)
    };
  }

  /**
   * Counts remaining scheduled classes per subject from tomorrow (or startDate if in future)
   * through settings.endDate, skipping weeklyHolidays and dailyMarks holiday flags.
   */
  function countRemainingClassesBySubject(currentState, refDate = new Date()) {
    const endDateStr = currentState?.settings?.endDate;
    const startDateStr = currentState?.settings?.startDate;
    if (!endDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
      return { enabled: false, counts: {}, totalRemaining: 0 };
    }

    const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    let cursor = tomorrow;
    if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      const start = parseLocalDate(startDateStr);
      if (start > cursor) cursor = start;
    }
    const end = parseLocalDate(endDateStr);
    if (cursor > end) {
      return { enabled: true, counts: {}, totalRemaining: 0 };
    }

    const holidays = new Set(currentState.settings?.weeklyHolidays || []);
    const dailyMarks = currentState.dailyMarks || {};
    const timetable = currentState.timetable || {};
    const counts = {};
    let totalRemaining = 0;

    // Guard against absurd multi-year date ranges in user settings (cap at 730 days)
    let guard = 0;
    while (cursor <= end && guard < 730) {
      const key = isoDate(cursor);
      const dayIdx = cursor.getDay();
      if (!holidays.has(dayIdx) && !dailyMarks[key]?.isHoliday) {
        const list = timetable[DAY_NAMES[dayIdx]] || [];
        list.forEach((sub) => {
          counts[sub] = (counts[sub] || 0) + 1;
          totalRemaining += 1;
        });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      guard += 1;
    }

    return { enabled: true, counts, totalRemaining };
  }

  /**
   * Computes full subject-level and overall attendance metrics from state.
   */
  function computeAllMetrics(currentState = state, refDate = new Date()) {
    const targetPct = clampNumber(Number(currentState?.settings?.targetPercentage ?? 75), 1, 100, 75);
    const horizon = countRemainingClassesBySubject(currentState, refDate);
    const attendanceMap = currentState?.attendance || {};
    const subjectNames = Object.keys(attendanceMap);

    let totalAttended = 0;
    let totalHeld = 0;

    const subjects = subjectNames.map((name) => {
      const rec = attendanceMap[name] || { attended: 0, total: 0 };
      const attended = Math.max(0, Math.floor(Number(rec.attended) || 0));
      const total = Math.max(attended, Math.floor(Number(rec.total) || 0));
      totalAttended += attended;
      totalHeld += total;

      const base = getBunkAnalysis(attended, total, targetPct);
      const future = horizon.enabled ? (horizon.counts[name] || 0) : null;
      let semesterBudget = null;
      let semesterMargin = null;
      let maxAchievablePct = null;

      if (horizon.enabled) {
        const finalTotal = total + future;
        const minRequiredTotal = Math.ceil((targetPct * finalTotal) / 100);
        semesterBudget = Math.max(0, finalTotal - minRequiredTotal);
        semesterMargin = semesterBudget - base.burned;
        maxAchievablePct = finalTotal > 0 ? ((attended + future) / finalTotal) * 100 : null;
      }

      return {
        subject: name,
        ...base,
        futureClasses: future,
        semesterBudget,
        semesterMargin,
        maxAchievablePct
      };
    });

    const overallBase = getBunkAnalysis(totalAttended, totalHeld, targetPct);
    let overallHorizon = null;
    if (horizon.enabled) {
      const finalTotal = totalHeld + horizon.totalRemaining;
      const minRequiredTotal = Math.ceil((targetPct * finalTotal) / 100);
      const semesterBudget = Math.max(0, finalTotal - minRequiredTotal);
      overallHorizon = {
        futureClasses: horizon.totalRemaining,
        semesterBudget,
        semesterMargin: semesterBudget - overallBase.burned,
        maxAchievablePct: finalTotal > 0 ? ((totalAttended + horizon.totalRemaining) / finalTotal) * 100 : null
      };
    }

    return {
      targetPct,
      subjects,
      overall: {
        ...overallBase,
        horizon: overallHorizon
      },
      horizonEnabled: horizon.enabled,
      sumSubjectBurned: subjects.reduce((acc, s) => acc + s.burned, 0),
      sumSubjectCanBunk: subjects.reduce((acc, s) => acc + s.canBunk, 0),
      sumSubjectMustAttend: subjects.reduce((acc, s) => acc + (Number.isFinite(s.mustAttend) ? s.mustAttend : 0), 0)
    };
  }

  /* --- SUBJECT MANAGEMENT (ADD / EDIT / DELETE) --- */
  function ensureSubject(name) {
    const clean = String(name || "").trim();
    if (!clean) return null;
    if (!state.attendance[clean]) {
      state.attendance[clean] = { attended: 0, total: 0, history: [] };
    }
    return clean;
  }

  if (typeof window !== "undefined") {
    window.openEditSubject = function (encodedSub) {
      const sub = decodeURIComponent(encodedSub);
      if (!state.attendance[sub]) return;
      editingSubject = editingSubject === sub ? null : sub;
      if (editingSubject) graphSubject = null;
      renderHome();
    };

    window.openSubjectGraph = function (encodedSub) {
      const sub = decodeURIComponent(encodedSub);
      if (!state.attendance[sub]) return;
      if (graphSubject === sub) {
        graphSubject = null;
      } else {
        graphSubject = sub;
        graphSelectedIndex = null;
        editingSubject = null;
      }
      renderHome();
    };

    window.setSubjectGraphMode = function (mode) {
      graphSubjectMode = mode === "daily" ? "daily" : "cumulative";
      renderHome();
    };

    window.selectSubjectGraphDay = function (idx) {
      graphSelectedIndex = Number(idx);
      renderHome();
    };

    window.cancelEditSubject = function () {
      editingSubject = null;
      renderHome();
    };

    window.saveEditSubject = function (encodedSub) {
      const sub = decodeURIComponent(encodedSub);
      if (!state.attendance[sub]) return;
      const attIn = getEl("edit-sub-attended");
      const totIn = getEl("edit-sub-total");

      const nextAttended = Math.floor(Number(attIn?.value));
      const nextTotal = Math.floor(Number(totIn?.value));

      if (!Number.isFinite(nextAttended) || !Number.isFinite(nextTotal) || nextAttended < 0 || nextTotal < 0) {
        showToast("Please enter valid non-negative numbers.", "error");
        return;
      }
      if (nextAttended > nextTotal) {
        showToast("Attended classes cannot exceed total held classes.", "error");
        return;
      }

      state.attendance[sub].attended = nextAttended;
      state.attendance[sub].total = nextTotal;
      editingSubject = null;
      saveState(state);
      renderHome();
      showToast(`Updated ${sub} to ${nextAttended}/${nextTotal}.`, "success");
    };

    window.deleteSubject = function (encodedSub) {
      const sub = decodeURIComponent(encodedSub);
      if (!state.attendance[sub]) return;
      if (!confirm(`Remove "${sub}" from your attendance tracker?`)) return;

      delete state.attendance[sub];
      saveState(state);
      renderHome();
      renderRollCallWidget();
      showToast(`Removed "${sub}".`, "info");
    };
  }

  /* --- PER-SUBJECT DAY-BY-NUMBER GRAPH --- */
  function formatShortMonthDay(d) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  }

  function buildSubjectDaySeries(subject, currentState = state, refDate = new Date()) {
    const rec = currentState?.attendance?.[subject] || { attended: 0, total: 0 };
    const dailyMarks = currentState?.dailyMarks || {};
    const loggedDays = [];
    let loggedAttended = 0;
    let loggedBunked = 0;

    Object.keys(dailyMarks)
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort()
      .forEach((dateKey) => {
        const dayObj = dailyMarks[dateKey];
        if (!dayObj || dayObj.isHoliday) return;
        let dayAtt = 0;
        let dayBunk = 0;
        Object.entries(dayObj).forEach(([k, status]) => {
          if (k === "isHoliday" || !k.includes("#")) return;
          const kSub = k.split("#").slice(1).join("#");
          if (kSub !== subject) return;
          if (status === "attended") dayAtt += 1;
          else if (status === "bunked") dayBunk += 1;
        });
        if (dayAtt + dayBunk > 0) {
          const dt = parseLocalDate(dateKey);
          loggedAttended += dayAtt;
          loggedBunked += dayBunk;
          loggedDays.push({
            dateKey,
            weekday: DAY_SHORT[dt.getDay()],
            shortDate: formatShortMonthDay(dt),
            attended: dayAtt,
            bunked: dayBunk,
            total: dayAtt + dayBunk,
            isEstimated: false
          });
        }
      });

    // Reconstruct prior scheduled days if total exceeds logged dailyMarks (e.g. demo/edited baseline)
    const targetAtt = Math.max(0, Math.floor(Number(rec.attended) || 0));
    const targetTot = Math.max(targetAtt, Math.floor(Number(rec.total) || 0));
    const missingAtt = Math.max(0, targetAtt - loggedAttended);
    const missingBunk = Math.max(0, targetTot - targetAtt - loggedBunked);
    const missingTotal = missingAtt + missingBunk;
    const priorDays = [];

    if (missingTotal > 0) {
      const holidays = new Set(currentState?.settings?.weeklyHolidays || []);
      const timetable = currentState?.timetable || {};
      const scheduledWeekdays = new Set();
      DAY_NAMES.forEach((dayName, idx) => {
        if ((timetable[dayName] || []).includes(subject)) scheduledWeekdays.add(idx);
      });

      const slots = [];
      const startFrom =
        loggedDays.length > 0
          ? parseLocalDate(loggedDays[0].dateKey)
          : new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
      let cursor = new Date(startFrom.getFullYear(), startFrom.getMonth(), startFrom.getDate() - 1);
      let guard = 0;

      while (slots.length < missingTotal && guard < 180) {
        const key = isoDate(cursor);
        const dayIdx = cursor.getDay();
        const isHoliday = holidays.has(dayIdx) || dailyMarks[key]?.isHoliday;
        if (!isHoliday) {
          let countOnDay = 0;
          if (scheduledWeekdays.size > 0) {
            countOnDay = (timetable[DAY_NAMES[dayIdx]] || []).filter((s) => s === subject).length;
          } else {
            countOnDay = 1;
          }
          for (let c = 0; c < countOnDay && slots.length < missingTotal; c++) {
            slots.push({ dateKey: key, dt: new Date(cursor.getTime()) });
          }
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
        guard += 1;
      }

      // Oldest first
      slots.reverse();
      // Deterministic even spacing for missed slots
      const bunkSet = new Set();
      if (missingBunk > 0 && slots.length > 0) {
        for (let b = 0; b < missingBunk; b++) {
          const idx = Math.min(slots.length - 1, Math.floor(((b + 0.5) * slots.length) / missingBunk));
          bunkSet.add(idx);
        }
      }

      const grouped = new Map();
      slots.forEach((slot, i) => {
        if (!grouped.has(slot.dateKey)) {
          grouped.set(slot.dateKey, {
            dateKey: slot.dateKey,
            weekday: DAY_SHORT[slot.dt.getDay()],
            shortDate: formatShortMonthDay(slot.dt),
            attended: 0,
            bunked: 0,
            total: 0,
            isEstimated: true
          });
        }
        const entry = grouped.get(slot.dateKey);
        if (bunkSet.has(i)) entry.bunked += 1;
        else entry.attended += 1;
        entry.total += 1;
      });
      priorDays.push(...grouped.values());
    }

    const combined = [...priorDays, ...loggedDays].sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    let cumAtt = 0;
    let cumTot = 0;
    let daysPresent = 0;
    const points = combined.map((pt, index) => {
      cumAtt += pt.attended;
      cumTot += pt.total;
      if (pt.attended > 0) daysPresent += 1;
      return {
        ...pt,
        index,
        cumAttended: cumAtt,
        cumTotal: cumTot,
        cumPct: cumTot > 0 ? (cumAtt / cumTot) * 100 : 0
      };
    });

    return {
      points,
      hasEstimated: priorDays.length > 0,
      daysPresent,
      totalDays: points.length,
      totalAttended: cumAtt,
      totalHeld: cumTot,
      totalMissed: Math.max(0, cumTot - cumAtt)
    };
  }

  function renderSubjectGraphPanel(subject) {
    const series = buildSubjectDaySeries(subject, state);
    const enc = encodeURIComponent(subject);

    if (series.points.length === 0) {
      return `
        <div class="subject-graph-panel">
          <div class="subject-graph-head">
            <span class="subject-graph-title">📊 ${escapeHtml(subject)} — Attendance Graph</span>
            <button type="button" class="icon-mini-btn" onclick="openSubjectGraph('${enc}')" aria-label="Close graph">✕</button>
          </div>
          <p class="helper-text">No classes recorded yet for ${escapeHtml(subject)}. Mark attendance in Daily Roll Call or edit counts to see your day-by-day graph.</p>
        </div>
      `;
    }

    const pts = series.points;
    const selectedIdx =
      graphSelectedIndex !== null && graphSelectedIndex >= 0 && graphSelectedIndex < pts.length
        ? graphSelectedIndex
        : pts.length - 1;
    const sel = pts[selectedIdx];

    const isDaily = graphSubjectMode === "daily";
    const maxY = Math.max(
      2,
      isDaily
        ? Math.max(...pts.map((p) => p.total))
        : Math.max(...pts.map((p) => p.cumTotal))
    );

    const padLeft = 40;
    const padRight = 16;
    const padTop = 18;
    const padBottom = 46;
    const colWidth = pts.length <= 8 ? 44 : pts.length <= 14 ? 36 : 30;
    const plotW = Math.max(240, pts.length * colWidth);
    const svgW = padLeft + plotW + padRight;
    const plotH = 148;
    const svgH = padTop + plotH + padBottom;

    // Y-axis ticks (integer steps)
    const tickStep = maxY <= 5 ? 1 : maxY <= 12 ? 2 : Math.ceil(maxY / 5);
    const yTicks = [];
    for (let v = 0; v <= maxY; v += tickStep) {
      yTicks.push(v);
    }
    if (yTicks[yTicks.length - 1] !== maxY) yTicks.push(maxY);

    const gridSvg = yTicks
      .map((val) => {
        const y = padTop + plotH - (val / maxY) * plotH;
        return `
          <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${svgW - padRight}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.12" />
          <text x="${padLeft - 6}" y="${(y + 4).toFixed(1)}" font-size="10.5" fill="currentColor" opacity="0.7" text-anchor="end">${val}</text>
        `;
      })
      .join("");

    let dataSvg = "";
    if (isDaily) {
      dataSvg = pts
        .map((p, i) => {
          const cx = padLeft + (i + 0.5) * (plotW / pts.length);
          const barW = Math.min(20, (plotW / pts.length) * 0.6);
          const hAtt = (p.attended / maxY) * plotH;
          const hBunk = (p.bunked / maxY) * plotH;
          const yAtt = padTop + plotH - hAtt;
          const yBunk = yAtt - hBunk;
          const isSel = i === selectedIdx;

          return `
            <g onclick="selectSubjectGraphDay(${i})" style="cursor:pointer;">
              ${isSel ? `<rect x="${(cx - barW * 0.85).toFixed(1)}" y="${padTop}" width="${(barW * 1.7).toFixed(1)}" height="${plotH}" rx="4" fill="#6366f1" fill-opacity="0.12" />` : ""}
              ${p.attended > 0 ? `<rect x="${(cx - barW / 2).toFixed(1)}" y="${yAtt.toFixed(1)}" width="${barW.toFixed(1)}" height="${hAtt.toFixed(1)}" rx="4" fill="#10b981"><title>${escapeHtml(p.weekday)} ${escapeHtml(p.shortDate)}: Present ${p.attended}</title></rect>` : ""}
              ${p.bunked > 0 ? `<rect x="${(cx - barW / 2).toFixed(1)}" y="${yBunk.toFixed(1)}" width="${barW.toFixed(1)}" height="${hBunk.toFixed(1)}" rx="4" fill="#ef4444"><title>${escapeHtml(p.weekday)} ${escapeHtml(p.shortDate)}: Absent ${p.bunked}</title></rect>` : ""}
              <text x="${cx.toFixed(1)}" y="${padTop + plotH + 15}" font-size="10" fill="currentColor" font-weight="${isSel ? "800" : "600"}" text-anchor="middle">${escapeHtml(p.shortDate)}</text>
              <text x="${cx.toFixed(1)}" y="${padTop + plotH + 27}" font-size="9" fill="currentColor" opacity="0.65" text-anchor="middle">${escapeHtml(p.weekday)}</text>
            </g>
          `;
        })
        .join("");
    } else {
      // Cumulative Attended vs Total Held (Number on Y-axis, Day on X-axis)
      const lineCoords = pts
        .map((p, i) => {
          const cx = padLeft + (i + 0.5) * (plotW / pts.length);
          const cy = padTop + plotH - (p.cumAttended / maxY) * plotH;
          return `${cx.toFixed(1)},${cy.toFixed(1)}`;
        })
        .join(" ");

      const barsAndDots = pts
        .map((p, i) => {
          const cx = padLeft + (i + 0.5) * (plotW / pts.length);
          const barW = Math.min(20, (plotW / pts.length) * 0.58);
          const hTot = (p.cumTotal / maxY) * plotH;
          const hAtt = (p.cumAttended / maxY) * plotH;
          const yTot = padTop + plotH - hTot;
          const yAtt = padTop + plotH - hAtt;
          const isSel = i === selectedIdx;
          const hasBunk = p.bunked > 0;
          const dotColor = hasBunk && p.attended === 0 ? "#ef4444" : "#10b981";
          const missH = Math.max(0, ((p.cumTotal - p.cumAttended) / maxY) * plotH);

          return `
            <g onclick="selectSubjectGraphDay(${i})" style="cursor:pointer;">
              ${isSel ? `<rect x="${(cx - barW * 0.85).toFixed(1)}" y="${padTop}" width="${(barW * 1.7).toFixed(1)}" height="${plotH}" rx="4" fill="#6366f1" fill-opacity="0.12" />` : ""}
              <rect x="${(cx - barW / 2).toFixed(1)}" y="${yTot.toFixed(1)}" width="${barW.toFixed(1)}" height="${hTot.toFixed(1)}" rx="4" fill="currentColor" fill-opacity="0.12" />
              <rect x="${(cx - barW / 2).toFixed(1)}" y="${yAtt.toFixed(1)}" width="${barW.toFixed(1)}" height="${hAtt.toFixed(1)}" rx="4" fill="#10b981" fill-opacity="0.72" />
              ${hasBunk ? `<rect x="${(cx - barW / 2).toFixed(1)}" y="${yTot.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(4, missH).toFixed(1)}" rx="4" fill="#ef4444" fill-opacity="0.82" />` : ""}
              <circle cx="${cx.toFixed(1)}" cy="${yAtt.toFixed(1)}" r="${isSel ? 5 : 3.8}" fill="${dotColor}" stroke="#ffffff" stroke-width="1.5" />
              <text x="${cx.toFixed(1)}" y="${padTop + plotH + 15}" font-size="10" fill="${hasBunk ? "#ef4444" : "currentColor"}" font-weight="${isSel || hasBunk ? "800" : "600"}" text-anchor="middle">${escapeHtml(p.shortDate)}</text>
              <text x="${cx.toFixed(1)}" y="${padTop + plotH + 27}" font-size="9" fill="${hasBunk ? "#ef4444" : "currentColor"}" opacity="${hasBunk ? "0.9" : "0.65"}" text-anchor="middle">${escapeHtml(p.weekday)}</text>
            </g>
          `;
        })
        .join("");

      dataSvg = `
        ${barsAndDots}
        <polyline points="${lineCoords}" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />
      `;
    }

    const rateStr = series.totalHeld > 0 ? ((series.totalAttended / series.totalHeld) * 100).toFixed(1) + "%" : "--%";
    const dayStatusLabel =
      sel.attended > 0 && sel.bunked === 0
        ? `Present (${sel.attended}/${sel.total})`
        : sel.bunked > 0 && sel.attended === 0
          ? `Absent (${sel.bunked} missed)`
          : `Present ${sel.attended}, Absent ${sel.bunked}`;

    return `
      <div class="subject-graph-panel">
        <div class="subject-graph-head">
          <span class="subject-graph-title">📊 ${escapeHtml(subject)} — Day &amp; Attendance Graph</span>
          <div class="subject-graph-controls">
            <button type="button" class="ai-tab-btn ${!isDaily ? "active" : ""}" onclick="setSubjectGraphMode('cumulative')">Total Attended</button>
            <button type="button" class="ai-tab-btn ${isDaily ? "active" : ""}" onclick="setSubjectGraphMode('daily')">Per Day</button>
            <button type="button" class="ai-tab-btn" onclick="openFullGraphModal('${enc}')" title="Open full monthly graph">⛶ View Full</button>
            <button type="button" class="icon-mini-btn" onclick="openSubjectGraph('${enc}')" aria-label="Close graph" title="Close graph">✕</button>
          </div>
        </div>

        <div class="subject-graph-kpis">
          <div class="sub-kpi-mini"><span>Days Present</span><strong>${series.daysPresent} / ${series.totalDays}</strong></div>
          <div class="sub-kpi-mini"><span>Attended</span><strong>${series.totalAttended}</strong></div>
          <div class="sub-kpi-mini"><span>Missed</span><strong>${series.totalMissed}</strong></div>
          <div class="sub-kpi-mini"><span>Rate</span><strong>${rateStr}</strong></div>
        </div>

        <div class="subject-graph-svg-wrap">
          <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" style="min-width:${Math.min(svgW, 340)}px;max-width:${svgW}px;display:block;" role="img" aria-label="${escapeHtml(subject)} attendance by day">
            <text x="12" y="${padTop + plotH / 2}" font-size="10" font-weight="700" fill="currentColor" opacity="0.65" transform="rotate(-90 12 ${padTop + plotH / 2})" text-anchor="middle">Classes (No.)</text>
            ${gridSvg}
            <line x1="${padLeft}" y1="${padTop + plotH}" x2="${svgW - padRight}" y2="${padTop + plotH}" stroke="currentColor" stroke-opacity="0.28" />
            ${dataSvg}
            <text x="${padLeft + plotW / 2}" y="${svgH - 4}" font-size="10" font-weight="700" fill="currentColor" opacity="0.65" text-anchor="middle">Day / Date (tap a day to inspect)</text>
          </svg>
          <div class="subject-graph-legend">
            <span><i class="legend-dot" style="background:#10b981;"></i>Attended</span>
            <span><i class="legend-dot" style="background:#ef4444;"></i>Absent / Missed</span>
            ${!isDaily ? `<span><i class="legend-dot" style="background:rgba(148,163,184,0.45);"></i>Total Held</span>` : ""}
          </div>
        </div>

        <div class="subject-graph-detail">
          ${escapeHtml(sel.weekday)}, ${escapeHtml(sel.shortDate)}: ${escapeHtml(dayStatusLabel)} • Cumulative: ${sel.cumAttended}/${sel.cumTotal} (${sel.cumPct.toFixed(1)}%)
        </div>
        ${
          series.hasEstimated
            ? `<div class="subject-graph-note">Prior baseline classes (${series.totalAttended}/${series.totalHeld}) are mapped onto recent scheduled timetable days; new Daily Roll Call entries appear on their exact date.</div>`
            : ""
        }
      </div>
    `;
  }

  /* --- FULL-VIEW MONTHLY SUBJECT GRAPH MODAL --- */
  function getAvailableMonthsForSubject(series) {
    const now = new Date();
    const curIdx = now.getFullYear() * 12 + now.getMonth();
    let minIdx = curIdx - 3; // Default 4-month span (Month 1 .. Month 4)
    let maxIdx = curIdx;

    const considerDate = (dateStr) => {
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
      const d = parseLocalDate(dateStr);
      const idx = d.getFullYear() * 12 + d.getMonth();
      if (idx < minIdx) minIdx = idx;
      if (idx > maxIdx) maxIdx = idx;
    };

    considerDate(state.settings?.startDate);
    considerDate(state.settings?.endDate);
    series.points.forEach((p) => considerDate(p.dateKey));

    // Cap to a reasonable 12-month window if user enters distant dates
    if (maxIdx - minIdx > 11) {
      minIdx = maxIdx - 11;
    }

    const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const months = [];
    for (let idx = minIdx, num = 1; idx <= maxIdx; idx++, num++) {
      const y = Math.floor(idx / 12);
      const m = idx % 12;
      months.push({
        year: y,
        month: m,
        monthNumber: num,
        tabLabel: `Month ${num} • ${monthShort[m]}`,
        fullLabel: `${monthFull[m]} ${y}`
      });
    }
    return months;
  }

  function buildMonthlyCalendarDays(subject, year, month) {
    const series = buildSubjectDaySeries(subject, state);
    const pointMap = new Map(series.points.map((p) => [p.dateKey, p]));
    const holidays = new Set(state.settings?.weeklyHolidays || []);
    const dailyMarks = state.dailyMarks || {};
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();

    const days = [];
    let monthAttended = 0;
    let monthAbsent = 0;
    let monthDaysPresent = 0;
    let monthDaysAbsent = 0;
    let prevCumAtt = 0;
    let prevCumTot = 0;

    // Seed cumulative baseline from points strictly before this month
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    series.points.forEach((p) => {
      if (p.dateKey < monthPrefix) {
        prevCumAtt = p.cumAttended;
        prevCumTot = p.cumTotal;
      }
    });

    let runningAtt = prevCumAtt;
    let runningTot = prevCumTot;

    for (let day = 1; day <= daysInMonth; day++) {
      const dt = new Date(year, month, day);
      const dateKey = isoDate(dt);
      const weekdayIdx = dt.getDay();
      const pt = pointMap.get(dateKey);
      const isHoliday = holidays.has(weekdayIdx) || Boolean(dailyMarks[dateKey]?.isHoliday);

      let status = "none";
      let attended = 0;
      let bunked = 0;
      if (pt) {
        attended = pt.attended;
        bunked = pt.bunked;
        monthAttended += attended;
        monthAbsent += bunked;
        runningAtt += attended;
        runningTot += attended + bunked;

        if (bunked > 0 && attended === 0) {
          status = "absent";
          monthDaysAbsent += 1;
        } else if (attended > 0 && bunked === 0) {
          status = "present";
          monthDaysPresent += 1;
        } else if (attended > 0 && bunked > 0) {
          status = "mixed";
          monthDaysPresent += 1;
          monthDaysAbsent += 1;
        }
      } else if (isHoliday) {
        status = "holiday";
      }

      days.push({
        day,
        dateKey,
        weekday: DAY_SHORT[weekdayIdx],
        shortDate: formatShortMonthDay(dt),
        status,
        attended,
        bunked,
        total: attended + bunked,
        cumAttended: runningAtt,
        cumTotal: runningTot,
        isEstimated: Boolean(pt?.isEstimated)
      });
    }

    return {
      series,
      daysInMonth,
      firstWeekday,
      days,
      monthAttended,
      monthAbsent,
      monthTotal: monthAttended + monthAbsent,
      monthDaysPresent,
      monthDaysAbsent
    };
  }

  function renderFullGraphModal() {
    const content = getEl("full-graph-content");
    if (!content || !fullGraphOpen || !fullGraphSubject) return;

    const subject = fullGraphSubject;
    const subjectsList = Object.keys(state.attendance);
    const calData = buildMonthlyCalendarDays(subject, fullGraphYear, fullGraphMonth);
    const months = getAvailableMonthsForSubject(calData.series);

    let activeMonthIdx = months.findIndex((m) => m.year === fullGraphYear && m.month === fullGraphMonth);
    if (activeMonthIdx === -1 && months.length > 0) {
      activeMonthIdx = months.length - 1;
      fullGraphYear = months[activeMonthIdx].year;
      fullGraphMonth = months[activeMonthIdx].month;
    }
    const activeMonthObj = months[activeMonthIdx] || { fullLabel: `${fullGraphYear}-${fullGraphMonth + 1}`, monthNumber: 1 };

    const days = calData.days;
    // Default selected date: explicit selection in this month, or latest class day in month, or day 1
    let selDay = days.find((d) => d.dateKey === fullGraphSelectedDate);
    if (!selDay) {
      const activeDays = days.filter((d) => d.total > 0);
      selDay = activeDays.length > 0 ? activeDays[activeDays.length - 1] : days[0];
      fullGraphSelectedDate = selDay ? selDay.dateKey : null;
    }

    // Build Full Monthly SVG Chart covering ALL dates (1..daysInMonth)
    const isDaily = fullGraphMode === "daily";
    const maxY = Math.max(
      2,
      isDaily
        ? Math.max(1, ...days.map((d) => d.total))
        : Math.max(1, ...days.map((d) => d.cumTotal))
    );

    const padLeft = 44;
    const padRight = 16;
    const padTop = 20;
    const padBottom = 42;
    const colW = 24;
    const plotW = days.length * colW;
    const svgW = padLeft + plotW + padRight;
    const plotH = 190;
    const svgH = padTop + plotH + padBottom;

    const tickStep = maxY <= 5 ? 1 : maxY <= 14 ? 2 : Math.ceil(maxY / 6);
    const yTicks = [];
    for (let v = 0; v <= maxY; v += tickStep) yTicks.push(v);
    if (yTicks[yTicks.length - 1] !== maxY) yTicks.push(maxY);

    const gridSvg = yTicks
      .map((val) => {
        const y = padTop + plotH - (val / maxY) * plotH;
        return `
          <line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${svgW - padRight}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.12" />
          <text x="${padLeft - 8}" y="${(y + 4).toFixed(1)}" font-size="11" fill="currentColor" opacity="0.72" text-anchor="end">${val}</text>
        `;
      })
      .join("");

    let barsSvg = "";
    if (isDaily) {
      barsSvg = days
        .map((d, i) => {
          const cx = padLeft + (i + 0.5) * colW;
          const bw = 15;
          const isSel = selDay && d.dateKey === selDay.dateKey;
          const hAtt = (d.attended / maxY) * plotH;
          const hBunk = (d.bunked / maxY) * plotH;
          const yAtt = padTop + plotH - hAtt;
          const yBunk = yAtt - hBunk;
          const isAbs = d.status === "absent" || d.status === "mixed";
          const lblColor = isAbs ? "#ef4444" : d.status === "present" ? "#10b981" : "currentColor";

          return `
            <g onclick="selectFullGraphDate('${d.dateKey}')" style="cursor:pointer;">
              ${isSel ? `<rect x="${(cx - colW / 2 + 1).toFixed(1)}" y="${padTop}" width="${colW - 2}" height="${plotH}" rx="4" fill="#6366f1" fill-opacity="0.16" />` : ""}
              ${d.total === 0 ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${padTop + plotH - 4}" width="${bw}" height="4" rx="2" fill="currentColor" fill-opacity="${d.status === "holiday" ? "0.1" : "0.18"}" />` : ""}
              ${d.attended > 0 ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yAtt.toFixed(1)}" width="${bw}" height="${hAtt.toFixed(1)}" rx="4" fill="#10b981"><title>${d.weekday}, ${d.shortDate}: Present (${d.attended})</title></rect>` : ""}
              ${d.bunked > 0 ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yBunk.toFixed(1)}" width="${bw}" height="${hBunk.toFixed(1)}" rx="4" fill="#ef4444"><title>${d.weekday}, ${d.shortDate}: Absent (${d.bunked})</title></rect>` : ""}
              <text x="${cx.toFixed(1)}" y="${padTop + plotH + 15}" font-size="10.5" fill="${lblColor}" font-weight="${isAbs || isSel ? "800" : "600"}" opacity="${d.total === 0 ? "0.55" : "1"}" text-anchor="middle">${d.day}</text>
              <text x="${cx.toFixed(1)}" y="${padTop + plotH + 27}" font-size="8.5" fill="${isAbs ? "#ef4444" : "currentColor"}" opacity="${isAbs ? "0.95" : "0.55"}" text-anchor="middle">${d.weekday.slice(0, 2)}</text>
            </g>
          `;
        })
        .join("");
    } else {
      const lineCoords = days
        .map((d, i) => {
          const cx = padLeft + (i + 0.5) * colW;
          const cy = padTop + plotH - (d.cumAttended / maxY) * plotH;
          return `${cx.toFixed(1)},${cy.toFixed(1)}`;
        })
        .join(" ");

      barsSvg =
        days
          .map((d, i) => {
            const cx = padLeft + (i + 0.5) * colW;
            const bw = 15;
            const isSel = selDay && d.dateKey === selDay.dateKey;
            const hTot = (d.cumTotal / maxY) * plotH;
            const hAtt = (d.cumAttended / maxY) * plotH;
            const yTot = padTop + plotH - hTot;
            const yAtt = padTop + plotH - hAtt;
            const missH = Math.max(0, hTot - hAtt);
            const isAbs = d.status === "absent" || d.status === "mixed";

            return `
              <g onclick="selectFullGraphDate('${d.dateKey}')" style="cursor:pointer;">
                ${isSel ? `<rect x="${(cx - colW / 2 + 1).toFixed(1)}" y="${padTop}" width="${colW - 2}" height="${plotH}" rx="4" fill="#6366f1" fill-opacity="0.16" />` : ""}
                <rect x="${(cx - bw / 2).toFixed(1)}" y="${yTot.toFixed(1)}" width="${bw}" height="${hTot.toFixed(1)}" rx="3" fill="currentColor" fill-opacity="0.1" />
                <rect x="${(cx - bw / 2).toFixed(1)}" y="${yAtt.toFixed(1)}" width="${bw}" height="${hAtt.toFixed(1)}" rx="3" fill="#10b981" fill-opacity="0.72" />
                ${isAbs ? `<rect x="${(cx - bw / 2).toFixed(1)}" y="${yTot.toFixed(1)}" width="${bw}" height="${Math.max(4, missH).toFixed(1)}" rx="3" fill="#ef4444" fill-opacity="0.88" />` : ""}
                ${d.total > 0 ? `<circle cx="${cx.toFixed(1)}" cy="${yAtt.toFixed(1)}" r="${isSel ? 5 : 3.5}" fill="${isAbs ? "#ef4444" : "#10b981"}" stroke="#fff" stroke-width="1.5" />` : ""}
                <text x="${cx.toFixed(1)}" y="${padTop + plotH + 15}" font-size="10.5" fill="${isAbs ? "#ef4444" : "currentColor"}" font-weight="${isAbs || isSel ? "800" : "600"}" opacity="${d.total === 0 ? "0.55" : "1"}" text-anchor="middle">${d.day}</text>
              </g>
            `;
          })
          .join("") +
        `<polyline points="${lineCoords}" fill="none" stroke="#10b981" stroke-width="2" pointer-events="none" />`;
    }

    const monthRate = calData.monthTotal > 0 ? ((calData.monthAttended / calData.monthTotal) * 100).toFixed(1) + "%" : "--%";
    const leadBlanks = Array.from({ length: calData.firstWeekday }, () => `<div class="cal-day-cell empty"></div>`).join("");
    const calCells = days
      .map((d) => {
        const isSel = selDay && d.dateKey === selDay.dateKey;
        const tag =
          d.status === "present"
            ? `✓ ${d.attended}`
            : d.status === "absent"
              ? `✕ ${d.bunked}`
              : d.status === "mixed"
                ? `${d.attended}/${d.total}`
                : d.status === "holiday"
                  ? "Hol"
                  : "·";
        return `
          <button type="button" onclick="selectFullGraphDate('${d.dateKey}')" class="cal-day-cell ${d.status} ${isSel ? "selected" : ""}">
            <span class="cal-day-num">${d.day}</span>
            <span class="cal-day-tag">${tag}</span>
          </button>
        `;
      })
      .join("");

    const selStatusText = !selDay
      ? "Tap any date to inspect"
      : selDay.status === "present"
        ? `Present (${selDay.attended}/${selDay.total})`
        : selDay.status === "absent"
          ? `Absent (${selDay.bunked} missed)`
          : selDay.status === "mixed"
            ? `Present ${selDay.attended}, Absent ${selDay.bunked}`
            : selDay.status === "holiday"
              ? "Holiday / No classes"
              : "No class logged";

    content.innerHTML = `
      <div class="full-graph-header">
        <div class="full-graph-title-group">
          <h2 id="full-graph-title">📊 Full Monthly Graph</h2>
          <select id="full-graph-subject-select" class="form-input full-graph-sub-select" onchange="switchFullGraphSubject(this.value)" aria-label="Select subject">
            ${subjectsList.map((s) => `<option value="${escapeHtml(s)}" ${s === subject ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
          </select>
        </div>
        <div class="subject-graph-controls">
          <button type="button" class="ai-tab-btn ${isDaily ? "active" : ""}" onclick="setFullGraphMode('daily')">All Dates (Per Day)</button>
          <button type="button" class="ai-tab-btn ${!isDaily ? "active" : ""}" onclick="setFullGraphMode('cumulative')">Cumulative</button>
          <button type="button" class="icon-mini-btn" onclick="closeFullGraphModal()" aria-label="Close full view" title="Close">✕</button>
        </div>
      </div>

      <div class="full-graph-body">
        <div class="month-nav-bar">
          <div style="display:flex;align-items:center;gap:6px;max-width:100%;">
            <button type="button" class="month-arrow-btn" onclick="stepFullGraphMonth(-1)" ${activeMonthIdx <= 0 ? "disabled" : ""} aria-label="Previous month">‹</button>
            <div class="month-tabs-scroll">
              ${months
                .map(
                  (m, idx) =>
                    `<button type="button" class="month-pill ${idx === activeMonthIdx ? "active" : ""}" onclick="selectFullGraphMonth(${m.year}, ${m.month})">${escapeHtml(m.tabLabel)}</button>`
                )
                .join("")}
            </div>
            <button type="button" class="month-arrow-btn" onclick="stepFullGraphMonth(1)" ${activeMonthIdx >= months.length - 1 ? "disabled" : ""} aria-label="Next month">›</button>
          </div>
          <span class="pill-muted">${escapeHtml(activeMonthObj.fullLabel)}</span>
        </div>

        <div class="subject-graph-kpis">
          <div class="sub-kpi-mini"><span>Month Attended</span><strong style="color:var(--success);">${calData.monthAttended}</strong></div>
          <div class="sub-kpi-mini"><span>Month Absent</span><strong style="color:var(--danger);">${calData.monthAbsent}</strong></div>
          <div class="sub-kpi-mini"><span>Month Rate</span><strong>${monthRate}</strong></div>
          <div class="sub-kpi-mini"><span>Overall (${escapeHtml(subject)})</span><strong>${calData.series.totalAttended}/${calData.series.totalHeld}</strong></div>
        </div>

        <div class="full-graph-svg-card">
          <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" style="min-width:680px;max-width:${svgW}px;display:block;" role="img" aria-label="${escapeHtml(subject)} ${escapeHtml(activeMonthObj.fullLabel)} attendance chart">
            <text x="14" y="${padTop + plotH / 2}" font-size="11" font-weight="700" fill="currentColor" opacity="0.65" transform="rotate(-90 14 ${padTop + plotH / 2})" text-anchor="middle">Classes (No.)</text>
            ${gridSvg}
            <line x1="${padLeft}" y1="${padTop + plotH}" x2="${svgW - padRight}" y2="${padTop + plotH}" stroke="currentColor" stroke-opacity="0.28" />
            ${barsSvg}
            <text x="${padLeft + plotW / 2}" y="${svgH - 4}" font-size="11" font-weight="700" fill="currentColor" opacity="0.65" text-anchor="middle">${escapeHtml(activeMonthObj.fullLabel)} — Dates (1 to ${calData.daysInMonth})</text>
          </svg>
          <div class="subject-graph-legend">
            <span><i class="legend-dot" style="background:#10b981;"></i>Present Day</span>
            <span><i class="legend-dot" style="background:#ef4444;"></i>Absent Day (Red)</span>
            <span><i class="legend-dot" style="background:rgba(148,163,184,0.35);"></i>No Class / Holiday</span>
          </div>
        </div>

        ${
          selDay
            ? `<div class="subject-graph-detail" style="margin-bottom:12px;${selDay.status === "absent" ? "background:var(--danger-bg);color:var(--danger);" : ""}">
                ${escapeHtml(selDay.weekday)}, ${escapeHtml(selDay.shortDate)} (${escapeHtml(selDay.dateKey)}): ${escapeHtml(selStatusText)} • Running Total: ${selDay.cumAttended}/${selDay.cumTotal}
              </div>`
            : ""
        }

        <div class="cal-grid-card">
          <div class="cal-grid-head">
            <h3>All Dates in ${escapeHtml(activeMonthObj.fullLabel)}</h3>
            <span class="hint">Green = Present • Red = Absent</span>
          </div>
          <div class="cal-weekdays">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>
          <div class="cal-days">
            ${leadBlanks}${calCells}
          </div>
        </div>
      </div>
    `;
  }

  if (typeof window !== "undefined") {
    window.openFullGraphModal = function (encodedSub) {
      const sub = decodeURIComponent(encodedSub);
      if (!state.attendance[sub]) return;
      fullGraphSubject = sub;
      fullGraphOpen = true;
      fullGraphSelectedDate = null;

      const series = buildSubjectDaySeries(sub, state);
      if (series.points.length > 0) {
        const latest = parseLocalDate(series.points[series.points.length - 1].dateKey);
        fullGraphYear = latest.getFullYear();
        fullGraphMonth = latest.getMonth();
      } else {
        const now = new Date();
        fullGraphYear = now.getFullYear();
        fullGraphMonth = now.getMonth();
      }

      const modal = getEl("full-graph-modal");
      const backdrop = getEl("full-graph-backdrop");
      if (modal) modal.classList.remove("hidden");
      if (backdrop) backdrop.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      renderFullGraphModal();
    };

    window.closeFullGraphModal = function () {
      fullGraphOpen = false;
      const modal = getEl("full-graph-modal");
      const backdrop = getEl("full-graph-backdrop");
      if (modal) modal.classList.add("hidden");
      if (backdrop) backdrop.classList.add("hidden");
      if (!chatDrawerOpen) document.body.style.overflow = "";
    };

    window.switchFullGraphSubject = function (sub) {
      if (!state.attendance[sub]) return;
      fullGraphSubject = sub;
      fullGraphSelectedDate = null;
      renderFullGraphModal();
    };

    window.selectFullGraphMonth = function (year, month) {
      fullGraphYear = Number(year);
      fullGraphMonth = Number(month);
      fullGraphSelectedDate = null;
      renderFullGraphModal();
    };

    window.stepFullGraphMonth = function (delta) {
      if (!fullGraphSubject) return;
      const series = buildSubjectDaySeries(fullGraphSubject, state);
      const months = getAvailableMonthsForSubject(series);
      const curIdx = months.findIndex((m) => m.year === fullGraphYear && m.month === fullGraphMonth);
      const nextIdx = curIdx + delta;
      if (nextIdx >= 0 && nextIdx < months.length) {
        fullGraphYear = months[nextIdx].year;
        fullGraphMonth = months[nextIdx].month;
        fullGraphSelectedDate = null;
        renderFullGraphModal();
      }
    };

    window.setFullGraphMode = function (mode) {
      fullGraphMode = mode === "cumulative" ? "cumulative" : "daily";
      renderFullGraphModal();
    };

    window.selectFullGraphDate = function (dateKey) {
      fullGraphSelectedDate = dateKey;
      renderFullGraphModal();
    };
  }

  /* --- RENDER HOME DASHBOARD --- */
  function renderHome() {
    const tbBody = getEl("timetable-display-body");
    const overallBadge = getEl("overall-percentage");
    const summaryEl = getEl("subject-grid-summary");
    const overallBanner = getEl("overall-insight");
    const targetBadge = getEl("home-target-badge");

    if (targetBadge) {
      targetBadge.textContent = `Target: ${state.settings.targetPercentage}%`;
    }

    // 1. Weekly Timetable Overview
    if (tbBody) {
      const todayIndex = new Date().getDay();
      const rows = DISPLAY_DAY_ORDER.map((dayIdx) => {
        const dayName = DAY_NAMES[dayIdx];
        const subjects = state.timetable[dayName] || [];
        const isToday = dayIdx === todayIndex;
        const isHoliday = state.settings.weeklyHolidays.includes(dayIdx);

        let subjectHTML = "";
        if (isHoliday) {
          subjectHTML = `<span class="tag tag-holiday">Weekly Holiday</span>`;
        } else if (subjects.length === 0) {
          subjectHTML = `<span class="muted-italic">No classes scheduled</span>`;
        } else {
          subjectHTML = subjects
            .map((s) => `<span class="tag tag-subject">${escapeHtml(s)}</span>`)
            .join("");
        }

        return `
          <tr class="${isToday ? "today-row" : ""}">
            <td class="day-cell">
              <span class="day-name">${dayName.slice(0, 3)}</span>
              ${isToday ? '<span class="today-pill">Today</span>' : ""}
            </td>
            <td class="subjects-cell">${subjectHTML}</td>
          </tr>
        `;
      }).join("");

      tbBody.innerHTML = rows;
    }

    // 2. Overall & Subject-wise Attendance Summary
    let totalAttended = 0;
    let totalHeld = 0;
    const subjectsList = Object.keys(state.attendance);
    const targetPct = state.settings.targetPercentage;

    if (summaryEl) {
      if (subjectsList.length === 0) {
        summaryEl.innerHTML = `
          <div class="empty-state">
            <p>No subjects added yet.</p>
            <p class="hint">Add a subject below or set up your weekly timetable in <strong>Setup &amp; Timetable</strong>.</p>
          </div>
        `;
      } else {
        summaryEl.innerHTML = subjectsList
          .map((sub) => {
            const d = state.attendance[sub];
            totalAttended += d.attended;
            totalHeld += d.total;

            const p = getPercentage(d.attended, d.total);
            const pStr = p === null ? "--%" : Math.round(p) + "%";
            const fillWidth = p === null ? 0 : Math.min(100, Math.max(0, p));
            const analysis = getBunkAnalysis(d.attended, d.total, targetPct);
            const enc = encodeURIComponent(sub);
            const isEditing = editingSubject === sub;
            const isGraphOpen = graphSubject === sub;

            return `
              <div class="subject-row">
                <div class="subject-main">
                  <div class="subject-title-row">
                    <span class="subject-name">${escapeHtml(sub)}</span>
                    <span class="subject-counts">${d.attended} / ${d.total} classes</span>
                  </div>
                  <div class="subject-advice advice-${analysis.status}" title="${escapeHtml(analysis.detailText)}">
                    ${escapeHtml(analysis.shortText)}
                  </div>
                  <div class="subject-progress-track" aria-hidden="true">
                    <div class="subject-progress-fill fill-${analysis.status}" style="width: ${fillWidth.toFixed(1)}%"></div>
                  </div>
                </div>
                <div class="subject-actions">
                  <span class="pct-pill status-${analysis.status}">${pStr}</span>
                  <button type="button" class="icon-mini-btn ${isGraphOpen ? "active-graph" : ""}" onclick="openSubjectGraph('${enc}')" title="View day-by-day attendance graph" aria-label="View graph for ${escapeHtml(sub)}">📊</button>
                  <button type="button" class="icon-mini-btn" onclick="openEditSubject('${enc}')" title="Edit attended / total counts" aria-label="Edit ${escapeHtml(sub)}">✎</button>
                  <button type="button" class="icon-mini-btn danger" onclick="deleteSubject('${enc}')" title="Remove subject" aria-label="Remove ${escapeHtml(sub)}">✕</button>
                </div>
                ${
                  isEditing
                    ? `
                  <div class="subject-edit-panel">
                    <div class="subject-edit-field">
                      <label for="edit-sub-attended">Attended</label>
                      <input type="number" id="edit-sub-attended" class="form-input" min="0" value="${d.attended}">
                    </div>
                    <div class="subject-edit-field">
                      <label for="edit-sub-total">Total Held</label>
                      <input type="number" id="edit-sub-total" class="form-input" min="0" value="${d.total}">
                    </div>
                    <button type="button" class="btn-primary" onclick="saveEditSubject('${enc}')">Save</button>
                    <button type="button" class="btn-secondary" onclick="cancelEditSubject()">Cancel</button>
                  </div>
                `
                    : ""
                }
                ${isGraphOpen ? renderSubjectGraphPanel(sub) : ""}
              </div>
            `;
          })
          .join("");
      }
    } else {
      subjectsList.forEach((sub) => {
        totalAttended += state.attendance[sub].attended;
        totalHeld += state.attendance[sub].total;
      });
    }

    const overallP = getPercentage(totalAttended, totalHeld);
    const overallAnalysis = getBunkAnalysis(totalAttended, totalHeld, targetPct);

    if (overallBadge) {
      overallBadge.textContent = overallP === null ? "--%" : overallP.toFixed(1) + "%";
      overallBadge.className = `overall-badge status-${overallAnalysis.status}`;
    }

    if (overallBanner) {
      overallBanner.className = `insight-box status-${overallAnalysis.status}`;
      overallBanner.innerHTML =
        totalHeld === 0
          ? `<strong>Getting started:</strong> Mark classes in <em>Daily Roll Call</em> to see how many classes you can safely skip.`
          : `<strong>Overall (${totalAttended}/${totalHeld}, burned ${overallAnalysis.burned}):</strong> ${escapeHtml(overallAnalysis.detailText)}`;
    }
  }

  function initQuickAddSubject() {
    const form = getEl("quick-add-subject-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameIn = getEl("new-sub-name");
      const attIn = getEl("new-sub-attended");
      const totIn = getEl("new-sub-total");

      const name = String(nameIn?.value || "").trim();
      const attended = Math.floor(Number(attIn?.value || 0));
      const total = Math.floor(Number(totIn?.value || 0));

      if (!name) {
        showToast("Please enter a subject name.", "warning");
        return;
      }
      if (!Number.isFinite(attended) || !Number.isFinite(total) || attended < 0 || total < 0) {
        showToast("Counts must be 0 or higher.", "error");
        return;
      }
      if (attended > total) {
        showToast("Attended classes cannot be greater than total classes.", "error");
        return;
      }
      if (state.attendance[name]) {
        showToast(`"${name}" already exists. Use the edit button (✎) to update it.`, "warning");
        return;
      }

      state.attendance[name] = { attended, total, history: [], manual: true };
      saveState(state);
      form.reset();
      renderHome();
      renderRollCallWidget();
      showToast(`Added "${name}" (${attended}/${total}).`, "success");
    });
  }

  /* --- DAILY ROLL CALL (MANUAL ATTENDANCE) --- */
  function revertSlotMark(dateKey, key) {
    if (!state.dailyMarks[dateKey] || key === "isHoliday") return;
    const oldSubject = key.split("#").slice(1).join("#");
    const oldStatus = state.dailyMarks[dateKey][key];

    if (state.attendance[oldSubject]) {
      if (oldStatus === "attended") {
        state.attendance[oldSubject].attended = Math.max(0, state.attendance[oldSubject].attended - 1);
        state.attendance[oldSubject].total = Math.max(0, state.attendance[oldSubject].total - 1);
      } else if (oldStatus === "bunked") {
        state.attendance[oldSubject].total = Math.max(0, state.attendance[oldSubject].total - 1);
      }
    }
    delete state.dailyMarks[dateKey][key];
  }

  function isFutureDateKey(dateKey) {
    return Boolean(dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey) && dateKey > isoDate());
  }

  function markClass(dateKey, classIndex, newSubject, status) {
    if (isFutureDateKey(dateKey)) {
      showToast("You can only mark or edit today and previous days, not future dates.", "warning");
      return;
    }

    const cleanSubject = String(newSubject || "").trim();
    if (!cleanSubject) {
      showToast("Please enter a subject name first.", "warning");
      return;
    }

    state.dailyMarks[dateKey] = state.dailyMarks[dateKey] || {};
    const oldKey = Object.keys(state.dailyMarks[dateKey]).find(
      (k) => k.startsWith(classIndex + "#") && k !== "isHoliday"
    );

    // Clicking the already active status for the same subject toggles/clears it
    if (oldKey) {
      const oldSubject = oldKey.split("#").slice(1).join("#");
      const oldStatus = state.dailyMarks[dateKey][oldKey];
      revertSlotMark(dateKey, oldKey);
      if (oldSubject === cleanSubject && oldStatus === status) {
        saveState(state, dateKey);
        renderRollCallWidget();
        renderHome();
        showToast(`Cleared mark for ${cleanSubject}.`, "info");
        return;
      }
    }

    ensureSubject(cleanSubject);
    const rec = state.attendance[cleanSubject];

    if (status === "attended") {
      rec.attended += 1;
      rec.total += 1;
    } else if (status === "bunked") {
      rec.total += 1;
    }

    state.dailyMarks[dateKey][`${classIndex}#${cleanSubject}`] = status;
    saveState(state, dateKey);
    renderRollCallWidget();
    renderHome();

    const labels = { attended: "Present", bunked: "Absent", holiday: "Cancelled" };
    showToast(`Marked ${cleanSubject} as ${labels[status] || status}.`, "success");
  }

  if (typeof window !== "undefined") {
    window.toggleDayHoliday = function (dateKeyParam) {
      const dateKey = dateKeyParam || selectedRollCallDate || isoDate();
      if (isFutureDateKey(dateKey)) {
        showToast("You can only mark holidays for today or previous days, not future dates.", "warning");
        return;
      }
      state.dailyMarks[dateKey] = state.dailyMarks[dateKey] || {};

      if (!state.dailyMarks[dateKey].isHoliday) {
        Object.keys(state.dailyMarks[dateKey]).forEach((k) => {
          if (k !== "isHoliday") revertSlotMark(dateKey, k);
        });
        state.dailyMarks[dateKey].isHoliday = true;
        showToast(`Marked ${dateKey} as a holiday.`, "info");
      } else {
        state.dailyMarks[dateKey].isHoliday = false;
        showToast(`Holiday removed for ${dateKey}.`, "info");
      }

      saveState(state, dateKey);
      renderRollCallWidget();
      renderHome();
    };

    window.setRollCallDate = function (nextDate) {
      if (!nextDate) return;
      const todayKey = isoDate();
      if (nextDate > todayKey) {
        selectedRollCallDate = todayKey;
        rcCalendarOpen = false;
        renderRollCallWidget();
        showToast("Next day / future attendance cannot be edited. Showing Today.", "warning");
        return;
      }
      selectedRollCallDate = nextDate;
      const picked = parseLocalDate(nextDate);
      rcCalendarYear = picked.getFullYear();
      rcCalendarMonth = picked.getMonth();
      rcCalendarOpen = false;
      renderRollCallWidget();
    };

    window.stepRollCallDate = function (deltaDays) {
      const current = parseLocalDate(selectedRollCallDate || isoDate());
      const next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + deltaDays);
      window.setRollCallDate(isoDate(next));
    };

    window.toggleRollCallCalendar = function () {
      rcCalendarOpen = !rcCalendarOpen;
      if (rcCalendarOpen) {
        const cur = parseLocalDate(selectedRollCallDate || isoDate());
        rcCalendarYear = cur.getFullYear();
        rcCalendarMonth = cur.getMonth();
      }
      renderRollCallWidget();
    };

    window.stepRollCallCalMonth = function (delta) {
      const now = new Date();
      const maxMonthIdx = now.getFullYear() * 12 + now.getMonth();
      const targetIdx = rcCalendarYear * 12 + rcCalendarMonth + delta;
      if (targetIdx > maxMonthIdx) return;
      rcCalendarYear = Math.floor(targetIdx / 12);
      rcCalendarMonth = targetIdx % 12;
      renderRollCallWidget();
    };
  }

  function renderRollCallCalendarPanel(selectedDateKey, todayKey) {
    if (!rcCalendarOpen) return "";

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const now = new Date();
    const isCurrentMonthOrLater = rcCalendarYear * 12 + rcCalendarMonth >= now.getFullYear() * 12 + now.getMonth();
    const daysInMonth = new Date(rcCalendarYear, rcCalendarMonth + 1, 0).getDate();
    const firstWeekday = new Date(rcCalendarYear, rcCalendarMonth, 1).getDay();

    const blanks = Array.from({ length: firstWeekday }, () => `<div class="rc-cal-cell empty"></div>`).join("");
    const dayBtns = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(rcCalendarYear, rcCalendarMonth, d);
      const dk = isoDate(dt);
      const isFuture = dk > todayKey;
      const isSel = dk === selectedDateKey;
      const isTod = dk === todayKey;
      const marks = state.dailyMarks[dk];
      const hasMarks = Boolean(marks && Object.keys(marks).some((k) => k === "isHoliday" ? marks[k] : k.includes("#")));

      dayBtns.push(`
        <button type="button"
          class="rc-cal-cell ${isSel ? "selected" : ""} ${isTod ? "today" : ""} ${isFuture ? "future-locked" : ""}"
          ${isFuture ? "disabled aria-disabled=\"true\" title=\"Future dates cannot be edited\"" : `onclick="setRollCallDate('${dk}')"`}>
          <span>${d}</span>
          ${hasMarks ? `<span class="rc-cal-dot" aria-hidden="true"></span>` : ""}
        </button>
      `);
    }

    return `
      <div id="rc-calendar-panel" class="rc-cal-panel" role="region" aria-label="Pick a past date or today">
        <div class="rc-cal-head">
          <button type="button" class="rc-step-btn" onclick="stepRollCallCalMonth(-1)" aria-label="Previous calendar month">‹</button>
          <span class="rc-cal-title">${monthNames[rcCalendarMonth]} ${rcCalendarYear}</span>
          <button type="button" class="rc-step-btn" onclick="stepRollCallCalMonth(1)" ${isCurrentMonthOrLater ? "disabled" : ""} aria-label="Next calendar month">›</button>
        </div>
        <div class="cal-weekdays">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div class="rc-cal-grid">
          ${blanks}${dayBtns.join("")}
        </div>
        <p class="helper-text">Tap Today or any previous date to edit attendance. Future dates are locked.</p>
      </div>
    `;
  }

  function renderRollCallWidget() {
    const host = getEl("rollcall-widget");
    if (!host) return;

    const todayKey = isoDate();
    if (!selectedRollCallDate || isFutureDateKey(selectedRollCallDate)) {
      selectedRollCallDate = todayKey;
    }
    const dateKey = selectedRollCallDate;
    const localDate = parseLocalDate(dateKey);
    const dayIndex = localDate.getDay();
    const dayName = DAY_NAMES[dayIndex];
    const isToday = dateKey === todayKey;

    const calendarPanelHtml = renderRollCallCalendarPanel(dateKey, todayKey);

    const dateBar = `
      <div class="rc-toolbar">
        <div class="rc-date-group">
          <button type="button" class="rc-step-btn" onclick="stepRollCallDate(-1)" title="Edit previous day" aria-label="Previous day">‹ Prev</button>
          <label for="rc-date-picker" class="sr-only">Select date</label>
          <input type="date" id="rc-date-picker" class="form-input rc-date-input" max="${todayKey}" value="${escapeHtml(dateKey)}" onchange="setRollCallDate(this.value)">
          <button type="button" class="rc-step-btn" onclick="stepRollCallDate(1)" ${isToday ? "disabled" : ""} title="${isToday ? "Cannot edit future days" : "Next day"}" aria-label="Next day">Next ›</button>
          <button type="button" id="rc-cal-toggle-btn" class="rc-step-btn ${rcCalendarOpen ? "active" : ""}" onclick="toggleRollCallCalendar()" aria-expanded="${rcCalendarOpen}">📅 Calendar</button>
          <span class="rc-day-label">${dayName}${isToday ? " (Today)" : " (Past Day)"}</span>
          ${!isToday ? `<button type="button" class="btn-link" onclick="setRollCallDate('${todayKey}')">Jump to Today</button>` : ""}
        </div>
        ${
          state.settings.weeklyHolidays.includes(dayIndex)
            ? ""
            : `<button type="button" onclick="toggleDayHoliday('${escapeHtml(dateKey)}')" class="btn-soft-danger">
                ${state.dailyMarks[dateKey]?.isHoliday ? "Undo Holiday" : "Mark Day as Holiday"}
              </button>`
        }
      </div>
      ${calendarPanelHtml}
    `;

    if (state.settings.weeklyHolidays.includes(dayIndex)) {
      host.innerHTML = `
        ${dateBar}
        <div class="empty-state big">
          <div class="emoji-icon">🎉</div>
          <h3>${dayName} is a Weekly Holiday</h3>
          <p class="hint">Need classes on ${dayName}? Update your weekly holidays in <strong>Setup &amp; Timetable</strong>.</p>
        </div>
      `;
      return;
    }

    const marksToday = state.dailyMarks[dateKey] || {};
    if (marksToday.isHoliday) {
      host.innerHTML = `
        ${dateBar}
        <div class="empty-state big">
          <div class="emoji-icon">🌴</div>
          <h3>${escapeHtml(dateKey)} is marked as a Holiday</h3>
          <p class="hint">No classes counted for this day.</p>
          <button type="button" onclick="toggleDayHoliday('${escapeHtml(dateKey)}')" class="btn-secondary">Undo Holiday</button>
        </div>
      `;
      return;
    }

    const scheduledClasses = state.timetable[dayName] || [];
    // Include any extra slots already marked beyond scheduled timetable length
    const extraIndices = Object.keys(marksToday)
      .filter((k) => k !== "isHoliday" && k.includes("#"))
      .map((k) => Number(k.split("#")[0]))
      .filter((n) => Number.isInteger(n) && n >= scheduledClasses.length);
    const maxSlot = Math.max(scheduledClasses.length - 1, ...extraIndices, -1);

    window.handleMarkDirect = function (idx, stat) {
      const input = getEl(`rc-sub-${idx}`);
      const subj = input ? input.value : "";
      markClass(dateKey, idx, subj, stat);
    };

    window.handleAddExtraClass = function (stat) {
      const input = getEl("rc-extra-sub");
      const subj = input ? input.value.trim() : "";
      if (!subj) {
        showToast("Enter the extra class subject name first.", "warning");
        return;
      }
      const nextIdx = maxSlot + 1;
      markClass(dateKey, nextIdx, subj, stat);
    };

    const allSubjects = Object.keys(state.attendance);
    const datalist = `<datalist id="all-subjects">${allSubjects
      .map((s) => `<option value="${escapeHtml(s)}">`)
      .join("")}</datalist>`;

    let slotsHtml = "";
    if (maxSlot < 0) {
      slotsHtml = `
        <div class="empty-state">
          <h3>No regular classes scheduled on ${dayName}</h3>
          <p class="hint">You can add an extra/makeup class below, or configure your timetable in <strong>Setup &amp; Timetable</strong>.</p>
        </div>
      `;
    } else {
      const slots = [];
      for (let idx = 0; idx <= maxSlot; idx++) {
        const defaultSubject = scheduledClasses[idx] || "";
        const existingKey = Object.keys(marksToday).find(
          (k) => k.startsWith(idx + "#") && k !== "isHoliday"
        );
        const currentSubject = existingKey ? existingKey.split("#").slice(1).join("#") : defaultSubject;
        const chosen = existingKey ? marksToday[existingKey] : null;
        const isExtra = idx >= scheduledClasses.length;

        const btn = (status, cls, label) => `
          <button type="button" onclick="handleMarkDirect(${idx}, '${status}')"
            aria-pressed="${chosen === status}"
            class="rc-btn ${cls} ${chosen === status ? "active-choice" : ""}">
            ${label}
          </button>
        `;

        slots.push(`
          <div class="rc-slot">
            <div class="rc-slot-head">
              <span class="rc-slot-label">${isExtra ? `Extra Class ${idx - scheduledClasses.length + 1}` : `Class ${idx + 1}`}</span>
              <span class="rc-slot-status">${chosen ? `Marked: ${chosen === "attended" ? "Present" : chosen === "bunked" ? "Absent" : "Cancelled"} (click again to clear)` : "Not marked yet"}</span>
            </div>
            <input type="text" id="rc-sub-${idx}" list="all-subjects" class="form-input rc-sub-input" value="${escapeHtml(currentSubject)}" placeholder="Subject name">
            <div class="rc-btn-row">
              ${btn("attended", "rc-present", "✓ Present")}
              ${btn("bunked", "rc-absent", "✕ Absent")}
              ${btn("holiday", "rc-cancel", "⊘ Cancelled")}
            </div>
          </div>
        `);
      }
      slotsHtml = slots.join("");
    }

    const extraBox = `
      <div class="rc-extra-box">
        <div class="rc-slot-head">
          <span class="rc-slot-label">+ Log an Extra / Makeup Class</span>
        </div>
        <div class="rc-extra-row">
          <input type="text" id="rc-extra-sub" list="all-subjects" class="form-input" placeholder="e.g. DS Lab">
          <button type="button" class="rc-btn rc-present" onclick="handleAddExtraClass('attended')">✓ Present</button>
          <button type="button" class="rc-btn rc-absent" onclick="handleAddExtraClass('bunked')">✕ Absent</button>
        </div>
      </div>
    `;

    host.innerHTML = `${dateBar}${datalist}${slotsHtml}${extraBox}`;
  }

  /* --- SETTINGS & TIMETABLE --- */
  function updateSemesterSummary() {
    const summaryEl = getEl("semester-summary");
    if (!summaryEl) return;
    const { startDate, endDate } = state.settings;

    if (!startDate || !endDate) {
      summaryEl.textContent = "Optional: Set start and end dates to keep track of your semester timeline.";
      summaryEl.className = "helper-text";
      return;
    }

    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 0) {
      summaryEl.textContent = "Warning: End date should be after the start date.";
      summaryEl.className = "helper-text text-danger";
      return;
    }

    const weeks = (diffDays / 7).toFixed(1);
    summaryEl.textContent = `Semester span: ${diffDays} days (~${weeks} weeks).`;
    summaryEl.className = "helper-text text-success";
  }

  function renderSettings() {
    // 1. Target Attendance Slider
    const slider = getEl("target-slider");
    const val = getEl("target-val");
    if (slider && val) {
      slider.value = state.settings.targetPercentage;
      val.textContent = slider.value + "%";

      slider.oninput = () => {
        val.textContent = slider.value + "%";
        state.settings.targetPercentage = clampNumber(Number(slider.value), 1, 100, 75);
        renderHome();
      };
      slider.onchange = () => {
        state.settings.targetPercentage = clampNumber(Number(slider.value), 1, 100, 75);
        saveState(state);
        renderHome();
        showToast(`Target attendance set to ${state.settings.targetPercentage}%.`, "success");
      };
    }

    // 2. Weekly Holidays Picker
    const dp = getEl("day-picker");
    window.toggleHoliday = function (idx) {
      const pos = state.settings.weeklyHolidays.indexOf(idx);
      if (pos >= 0) state.settings.weeklyHolidays.splice(pos, 1);
      else state.settings.weeklyHolidays.push(idx);

      saveState(state);
      renderSettings();
      renderHome();
      renderRollCallWidget();
    };

    if (dp) {
      dp.innerHTML = DAY_SHORT.map((label, idx) => {
        const selected = state.settings.weeklyHolidays.includes(idx);
        return `<button type="button" onclick="toggleHoliday(${idx})" aria-pressed="${selected}" title="${DAY_NAMES[idx]}" class="day-chip ${selected ? "selected" : ""}">${label}</button>`;
      }).join("");
    }

    // 3. Semester Dates
    const startIn = getEl("start-date");
    const endIn = getEl("end-date");
    if (startIn && endIn) {
      startIn.value = state.settings.startDate || "";
      endIn.value = state.settings.endDate || "";
      startIn.onchange = () => {
        state.settings.startDate = startIn.value;
        saveState(state);
        updateSemesterSummary();
      };
      endIn.onchange = () => {
        state.settings.endDate = endIn.value;
        saveState(state);
        updateSemesterSummary();
      };
      updateSemesterSummary();
    }

    // 4. Timetable Editor
    const tm = getEl("timetable-matrix");
    if (tm) {
      tm.innerHTML = DISPLAY_DAY_ORDER.map((idx) => {
        const day = DAY_NAMES[idx];
        const isHoliday = state.settings.weeklyHolidays.includes(idx);
        return `
          <div class="tt-edit-row">
            <label for="tt-in-${day}" class="tt-day-lbl">${day.slice(0, 3)}</label>
            <input type="text" id="tt-in-${day}" class="form-input" value="${escapeHtml((state.timetable[day] || []).join(", "))}" placeholder="${isHoliday ? "Weekly holiday" : "e.g. OS, DS, JAVA, PDS"}">
          </div>
        `;
      }).join("");
    }

    const saveTtBtn = getEl("save-timetable");
    if (saveTtBtn) {
      saveTtBtn.onclick = () => {
        const oldSubjects = new Set();
        DAY_NAMES.forEach((day) => {
          (state.timetable[day] || []).forEach((s) => oldSubjects.add(s));
        });

        const newSubjects = new Set();
        DAY_NAMES.forEach((day) => {
          const input = getEl(`tt-in-${day}`);
          if (!input) return;
          const subs = input.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          state.timetable[day] = subs;
          subs.forEach((s) => newSubjects.add(s));
        });

        const added = [];
        newSubjects.forEach((s) => {
          if (!state.attendance[s]) added.push(s);
          ensureSubject(s);
        });

        const removed = [];
        Object.keys(state.attendance).forEach((sub) => {
          if (newSubjects.has(sub)) return;
          const rec = state.attendance[sub];
          const wasInOldTimetable = oldSubjects.has(sub);
          const isOrphanedZero = !rec?.manual && rec?.attended === 0 && rec?.total === 0;
          if (wasInOldTimetable || isOrphanedZero) {
            delete state.attendance[sub];
            removed.push(sub);
          }
        });

        if (editingSubject && !state.attendance[editingSubject]) editingSubject = null;
        if (graphSubject && !state.attendance[graphSubject]) graphSubject = null;
        if (fullGraphSubject && !state.attendance[fullGraphSubject]) {
          fullGraphSubject = null;
          if (typeof window !== "undefined" && window.closeFullGraphModal) {
            window.closeFullGraphModal();
          }
        }

        saveState(state);
        renderAll();

        const parts = [];
        if (added.length > 0) parts.push(`Added: ${added.join(", ")}`);
        if (removed.length > 0) parts.push(`Removed: ${removed.join(", ")}`);
        showToast(
          parts.length > 0 ? `Timetable saved! ${parts.join(" | ")}` : "Timetable saved successfully!",
          "success"
        );
      };
    }

    // 5. Data Management (Export, Import, Sample Reset, Clear All)
    const exportBtn = getEl("export-data-btn");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bunksmart-backup-${isoDate()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("Backup downloaded!", "success");
      };
    }

    const importBtn = getEl("import-data-btn");
    const importInput = getEl("import-data-file");
    if (importBtn && importInput) {
      importBtn.onclick = () => importInput.click();
      importInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result || ""));
            const targetState = parsed?.schema === "bunksmart-phone-db-v1" && parsed?.state ? parsed.state : parsed;
            state = sanitizeState(targetState);
            saveState(state);
            renderAll();
            showToast("Backup restored successfully!", "success");
          } catch (err) {
            showToast("Invalid backup file.", "error");
          } finally {
            importInput.value = "";
          }
        };
        reader.readAsText(file);
      };
    }

    const sampleBtn = getEl("reset-sample-btn");
    if (sampleBtn) {
      sampleBtn.onclick = () => {
        if (confirm("Replace your current data with the default 3rd Sem CSE timetable?")) {
          state = buildSampleState();
          saveState(state);
          renderAll();
          showToast("Default 3rd Sem CSE timetable loaded.", "info");
        }
      };
    }

    const wipeBtn = getEl("wipe-data-btn");
    if (wipeBtn) {
      wipeBtn.onclick = () => {
        if (confirm("Clear all classes, attendance, and grades to start completely fresh?")) {
          state = buildEmptyState();
          saveState(state);
          renderAll();
          showToast("All data cleared. Ready for your own timetable!", "info");
        }
      };
    }

    renderPhoneStoragePanel();
  }

  /* --- GRADE PREDICTOR (SGPA + FINAL EXAM SCORE) --- */
  function renderPredictor() {
    const sgpaContainer = getEl("sgpa-rows");

    window.updateSgpa = function () {
      let cSum = 0;
      let ptSum = 0;

      state.sgpaRows.forEach((_, i) => {
        const sIn = getEl(`sg-s-${i}`);
        const cIn = getEl(`sg-c-${i}`);
        const gIn = getEl(`sg-g-${i}`);
        if (!sIn || !cIn || !gIn) return;

        const rawCredits = Number(cIn.value);
        const c = Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 0;
        const g = Object.prototype.hasOwnProperty.call(GRADE_POINTS, gIn.value) ? gIn.value : "A";

        state.sgpaRows[i] = { subject: sIn.value, credits: c, grade: g };
        cSum += c;
        ptSum += c * (GRADE_POINTS[g] || 0);
      });

      saveState(state);
      const resultEl = getEl("sgpa-result");
      const creditsEl = getEl("sgpa-credits");
      if (resultEl) resultEl.textContent = cSum === 0 ? "0.00" : (ptSum / cSum).toFixed(2);
      if (creditsEl) creditsEl.textContent = `Total Credits: ${cSum}`;
    };

    window.removeSgpaRow = function (idx) {
      state.sgpaRows.splice(idx, 1);
      if (state.sgpaRows.length === 0) {
        state.sgpaRows.push({ subject: "", credits: 4, grade: "A" });
      }
      saveState(state);
      renderPredictorUI();
      window.updateSgpa();
    };

    function renderPredictorUI() {
      if (!sgpaContainer) return;
      sgpaContainer.innerHTML = state.sgpaRows
        .map(
          (r, i) => `
          <div class="sgpa-row">
            <input type="text" id="sg-s-${i}" class="form-input sgpa-sub" placeholder="Subject name" value="${escapeHtml(r.subject)}" oninput="updateSgpa()">
            <input type="number" id="sg-c-${i}" class="form-input sgpa-cred" min="0" step="0.5" value="${escapeHtml(r.credits)}" oninput="updateSgpa()" aria-label="Credits">
            <select id="sg-g-${i}" class="form-input sgpa-grade" onchange="updateSgpa()" aria-label="Expected Grade">
              ${Object.entries(GRADE_POINTS)
                .map(([g, pts]) => `<option value="${g}" ${g === r.grade ? "selected" : ""}>${g} (${pts})</option>`)
                .join("")}
            </select>
            <button type="button" onclick="removeSgpaRow(${i})" class="icon-mini-btn danger" title="Remove row" aria-label="Remove row">✕</button>
          </div>
        `
        )
        .join("");
    }

    const addRowBtn = getEl("sgpa-add-row");
    if (addRowBtn) {
      addRowBtn.onclick = () => {
        state.sgpaRows.push({ subject: "", credits: 4, grade: "A" });
        saveState(state);
        renderPredictorUI();
        window.updateSgpa();
      };
    }

    renderPredictorUI();
    window.updateSgpa();

    // Final Exam (SEE) Score Predictor
    const calcBtn = getEl("pred-calc-btn");
    const iaInput = getEl("pred-ia");
    const maxInput = getEl("pred-ia-max");
    const targetInput = getEl("pred-grade");

    function calculateRequiredSEE() {
      const res = getEl("pred-result");
      if (!iaInput || !maxInput || !targetInput || !res) return;

      const rawIa = iaInput.value.trim();
      const ia = Number(rawIa);
      const max = Number(maxInput.value);
      const target = Number(targetInput.value);

      res.className = "pred-result";

      if (rawIa === "" || !Number.isFinite(ia)) {
        res.classList.add("warn");
        res.textContent = "Enter your internal marks (IA) to calculate the final exam score needed.";
        return;
      }
      if (!Number.isFinite(max) || max <= 0) {
        res.classList.add("danger");
        res.textContent = "Max internal marks must be greater than 0.";
        return;
      }
      if (ia < 0 || ia > max) {
        res.classList.add("danger");
        res.textContent = `Internal marks must be between 0 and ${max}.`;
        return;
      }
      if (!Number.isFinite(target) || target < 0 || target > 100) {
        res.classList.add("danger");
        res.textContent = "Please choose a valid target total score.";
        return;
      }

      // Scale internal marks to 50, then compute required final exam (SEE) score out of 100
      const scaledIA = (ia / max) * 50;
      const reqSEE = (target - scaledIA) * 2;

      if (reqSEE > 100) {
        res.classList.add("danger");
        res.innerHTML = `Not reachable this time — you would need <strong>${reqSEE.toFixed(1)}/100</strong> in the final exam (SEE) with ${scaledIA.toFixed(1)}/50 internal.`;
      } else if (reqSEE <= 0) {
        res.classList.add("success");
        res.innerHTML = `Your internal marks (<strong>${scaledIA.toFixed(1)}/50</strong>) already cover the ${target}% target! Just meet your university's minimum passing score in SEE.`;
      } else {
        res.classList.add("success");
        res.innerHTML = `You need at least <strong>${Math.ceil(reqSEE)}/100</strong> in your Final Exam (SEE) (your internal contributes <strong>${scaledIA.toFixed(1)}/50</strong>).`;
      }
    }

    if (calcBtn) calcBtn.onclick = calculateRequiredSEE;
    if (iaInput) iaInput.addEventListener("keydown", (e) => { if (e.key === "Enter") calculateRequiredSEE(); });
  }

  /* --- ALGORITHMIC AI CHART & QUERY BOARD (100% DETERMINISTIC, ZERO EXTERNAL API) --- */
  let aiBoardChartMode = "percentage"; // "percentage" | "counts"
  const aiBoardMessages = [];

  function normalizeQueryText(str) {
    return String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9%+\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function levenshteinDistance(a, b) {
    const s = String(a || "");
    const t = String(b || "");
    const m = s.length;
    const n = t.length;
    if (m === 0) return n;
    if (n === 0) return m;

    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;

    for (let i = 1; i <= m; i++) {
      let prev = i - 1;
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const temp = dp[j];
        const cost = s[i - 1] === t[j - 1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
        prev = temp;
      }
    }
    return dp[n];
  }

  const QUERY_STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do",
    "for", "go", "have", "helo", "hello", "hey", "hi", "how", "i", "if",
    "in", "is", "it", "many", "may", "me", "much", "my", "no", "of", "on",
    "or", "our", "so", "the", "to", "up", "us", "we", "what", "will", "you"
  ]);

  function matchSubjectsInQuery(query, subjectNames) {
    const normQuery = normalizeQueryText(query);
    if (!normQuery || !Array.isArray(subjectNames) || subjectNames.length === 0) return [];
    const tokens = normQuery.split(" ").filter((t) => t && !QUERY_STOP_WORDS.has(t));
    const scored = [];

    subjectNames.forEach((name) => {
      const normSub = normalizeQueryText(name);
      if (!normSub) return;

      let bestScore = 0;
      const escapedSub = normSub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escapedSub}\\b`).test(normQuery)) {
        bestScore = 1.0;
      } else if (normSub.length >= 4 && normQuery.includes(normSub)) {
        bestScore = 0.9;
      } else {
        const subTokens = normSub.split(" ").filter(Boolean);
        for (let i = 0; i < tokens.length; i++) {
          const tok = tokens[i];
          if (tok.length < 3) continue;

          if (normSub.startsWith(tok) || subTokens.some((st) => st.startsWith(tok))) {
            bestScore = Math.max(bestScore, 0.85);
          }

          if (normSub.length >= 3) {
            const maxLen = Math.max(tok.length, normSub.length);
            const sim = 1 - levenshteinDistance(tok, normSub) / maxLen;
            if (sim >= 0.72) {
              bestScore = Math.max(bestScore, sim);
            }
          }

          if (i + 1 < tokens.length && normSub.length >= 4) {
            const bigram = `${tok} ${tokens[i + 1]}`;
            const bgSim = 1 - levenshteinDistance(bigram, normSub) / Math.max(bigram.length, normSub.length);
            if (bgSim >= 0.72) {
              bestScore = Math.max(bestScore, bgSim);
            }
          }
        }
      }

      if (bestScore >= 0.72) {
        scored.push({ name, score: bestScore });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.name);
  }

  function extractQueryParameters(query, refDate = new Date()) {
    const norm = normalizeQueryText(query);
    const actionMatch = norm.match(/\b(bunk|skip|miss|attend|go)\s+(\d+)\b/);
    const reverseMatch = norm.match(/\b(\d+)\s+(?:more\s+)?(?:classes?|lectures?)?\s*(?:of|in|for)?\s*(bunk|skip|miss|attend)\b/);
    const anyNum = norm.match(/\b(\d+)\b/);

    let count = null;
    let whatIfAction = null;
    if (actionMatch) {
      whatIfAction = actionMatch[1] === "attend" || actionMatch[1] === "go" ? "attend" : "bunk";
      count = parseInt(actionMatch[2], 10);
    } else if (reverseMatch) {
      whatIfAction = reverseMatch[2] === "attend" ? "attend" : "bunk";
      count = parseInt(reverseMatch[1], 10);
    } else if (anyNum && /\b(what if|suppose|if i)\b/.test(norm)) {
      count = parseInt(anyNum[1], 10);
      whatIfAction = /\battend\b/.test(norm) ? "attend" : "bunk";
    }

    let dayIndex = null;
    if (/\btoday\b/.test(norm)) {
      dayIndex = refDate.getDay();
    } else if (/\btomorrow\b/.test(norm)) {
      dayIndex = (refDate.getDay() + 1) % 7;
    } else {
      const dayTokens = [
        ["sunday", "sun"],
        ["monday", "mon"],
        ["tuesday", "tue", "tues"],
        ["wednesday", "wed"],
        ["thursday", "thu", "thurs"],
        ["friday", "fri"],
        ["saturday", "sat"]
      ];
      dayTokens.forEach((aliases, idx) => {
        if (aliases.some((a) => new RegExp(`\\b${a}\\b`).test(norm))) {
          dayIndex = idx;
        }
      });
    }

    const perSubjectExplicit = /\b(each subject|every subject|per subject|subject wise|subjectwise|all subjects|by subject|in each)\b/.test(norm);
    return { count, whatIfAction, dayIndex, perSubjectExplicit };
  }

  function classifyQueryIntents(query, params, matchedSubjects = []) {
    const norm = normalizeQueryText(query);
    const rules = {
      GREETING: [
        [/^(hi+|hey+|heyy+|hii+|hello+|helo|hlo|hola|namaste|yo+|sup|greetings|good\s*(morning|afternoon|evening|night)|how\s*(are|r)\s*(you|u)|what\s*can\s*(you|u)\s*do|who\s*are\s*you|help(\s*me)?)$/, 6],
        [/\b(hi|hey|hello|helo|hlo|hola|namaste|good\s*(morning|afternoon|evening)|how\s*(are|r)\s*(you|u)|what\s*can\s*(you|u)\s*do)\b/, 4]
      ],
      BURNED: [
        [/\b(burn|burned|burnt|bunked|missed|skipped|absent)\b/, 4],
        [/\bhow\s+many\b.*\b(burn|burned|burnt|bunked|missed|skipped)\b/, 5]
      ],
      CAN_BUNK: [
        [/\b(can|could|may)\s+(i|we)\s+(bunk|skip|miss|leave)\b/, 5],
        [/\bhow\s+many\b.*\b(bunk|skip|miss|leave)\b/, 5],
        [/\b(safe\s+to\s+bunk|safe\s+to\s+skip|bunkable|left\s+to\s+bunk|bunks?\s+left|skips?\s+left|buffer|allowance)\b/, 4],
        [/\b(bunk|skip)\s+(in|for)\b/, 4]
      ],
      MUST_ATTEND: [
        [/\b(must\s+attend|need\s+to\s+attend|have\s+to\s+attend|classes\s+needed|recover|recovery|shortage|deficit|required)\b/, 4],
        [/\bhow\s+many\b.*\b(have\s+to|need\s+to|must)\s+(attend|cover|go)\b/, 5]
      ],
      PERCENTAGE: [
        [/\b(percent|percentage|pct|ratio|attendance\s+rate)\b/, 5],
        [/\b(what|how\s+much|check|show|tell|give)\b.*\battendance\b/, 5],
        [/\battendance\b/, 4]
      ],
      WHAT_IF: [
        [/\b(what\s+if|suppose|simulate|if\s+i)\b/, 5]
      ],
      TIMETABLE_DAY: [
        [/\b(today|tomorrow|schedule|timetable)\b/, 4]
      ],
      SEMESTER_HORIZON: [
        [/\b(semester|end\s+date|horizon|total\s+budget|final\s+percentage|max\s+achievable)\b/, 4]
      ],
      SUMMARY: [
        [/\b(summary|overview|report|all\s+subjects|everything|overall\s+status|full\s+status)\b/, 4]
      ]
    };

    const scores = {};
    Object.entries(rules).forEach(([intent, patterns]) => {
      let s = 0;
      patterns.forEach(([regex, weight]) => {
        if (regex.test(norm)) s += weight;
      });
      scores[intent] = s;
    });

    if (params.count !== null && params.whatIfAction && scores.WHAT_IF > 0) {
      scores.WHAT_IF += 3;
    }
    if (params.dayIndex !== null) {
      scores.TIMETABLE_DAY += 4;
    }

    const domainIntents = [
      "BURNED",
      "CAN_BUNK",
      "MUST_ATTEND",
      "PERCENTAGE",
      "WHAT_IF",
      "TIMETABLE_DAY",
      "SEMESTER_HORIZON",
      "SUMMARY"
    ];

    const activeDomain = domainIntents.filter((k) => scores[k] >= 3);

    let active = [];
    if (activeDomain.length > 0) {
      // User asked an actual attendance question (even if prefixed with "Hi, ...")
      active = activeDomain;
    } else if (matchedSubjects.length > 0) {
      // User named a subject directly (e.g. "English" or "check Maths")
      active = ["SUBJECT_OVERVIEW"];
    } else if (scores.GREETING >= 4) {
      active = ["GREETING"];
    } else {
      active = ["UNKNOWN"];
    }

    active.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));
    return { active, scores };
  }

  function formatPct(pct) {
    return pct === null || !Number.isFinite(pct) ? "--%" : `${pct.toFixed(1)}%`;
  }

  function formatSubjectActionText(subMetric) {
    if (subMetric.total === 0) return "No classes held yet";
    if (subMetric.canBunk > 0) {
      return `Can bunk ${subMetric.canBunk}`;
    }
    if (subMetric.mustAttend === Infinity) {
      return "100% unreachable";
    }
    if (subMetric.mustAttend > 0) {
      return `Must attend ${subMetric.mustAttend} (0 bunks left)`;
    }
    return "0 bunks left (right on target)";
  }

  function buildSuggestedQuestions(subjectNames, focusSubject) {
    const sub1 = focusSubject || subjectNames[0] || "OS";
    const sub2 = subjectNames.find((s) => s !== sub1) || sub1;
    if (focusSubject) {
      return [
        `What is my attendance in ${sub1}?`,
        `How many classes can I bunk in ${sub1}?`,
        `What if I bunk 2 in ${sub1}?`,
        "Show overall summary"
      ];
    }
    return [
      `What is my attendance in ${sub1}?`,
      `How many classes can I bunk in ${sub2}?`,
      "How many classes have I burned?",
      "Can I bunk today?",
      "Show overall summary"
    ];
  }

  /**
   * Pure algorithmic query solver for the BunkSmart Assistant.
   * Pattern-matches greetings, subject-specific questions, percentages, safe bunks, missed classes, what-ifs, and schedules.
   */
  function runAlgorithmicBoardQuery(query, currentState = state, refDate = new Date()) {
    const metrics = computeAllMetrics(currentState, refDate);
    const subjectNames = metrics.subjects.map((s) => s.subject);
    const matchedNames = matchSubjectsInQuery(query, subjectNames);
    const params = extractQueryParameters(query, refDate);
    const { active: intents, scores } = classifyQueryIntents(query, params, matchedNames);

    const blocks = [];
    const ov = metrics.overall;
    const targetSubjects =
      matchedNames.length > 0
        ? metrics.subjects.filter((s) => matchedNames.includes(s.subject))
        : metrics.subjects;

    const isSingleSubject = matchedNames.length === 1 && !params.perSubjectExplicit;
    const focus = isSingleSubject ? targetSubjects[0] : ov;
    const focusLabel = isSingleSubject ? focus.subject : "Overall";

    // Handle Greeting or Unrecognized Input gracefully (ask what they want + offer questions!)
    if (intents.includes("GREETING")) {
      blocks.push({
        title: "Assistant",
        highlight: "Hi! What would you like to check?",
        detail: "Ask me about a specific subject or pick one of these questions:"
      });
      return {
        query,
        intents,
        intentScores: scores,
        matchedSubjects: matchedNames,
        metrics,
        blocks,
        perSubjectRows: [],
        quickReplies: buildSuggestedQuestions(subjectNames)
      };
    }

    if (intents.includes("UNKNOWN")) {
      blocks.push({
        title: "Need a clearer question",
        highlight: "What would you like to know?",
        detail:
          subjectNames.length > 0
            ? `Try mentioning a subject (like ${subjectNames.slice(0, 3).join(", ")}) and whether you want attendance %, safe bunks, or missed classes — or pick a question below:`
            : "Add some subjects first, or pick one of the questions below:"
      });
      return {
        query,
        intents,
        intentScores: scores,
        matchedSubjects: matchedNames,
        metrics,
        blocks,
        perSubjectRows: [],
        quickReplies: buildSuggestedQuestions(subjectNames)
      };
    }

    // Subject Overview (when user simply types a subject name like "English")
    if (intents.includes("SUBJECT_OVERVIEW") && isSingleSubject) {
      const pctText = formatPct(focus.percentage);
      const statusNote =
        focus.total === 0
          ? `No classes recorded for ${focus.subject} yet.`
          : focus.canBunk > 0
            ? `You attended ${focus.attended}/${focus.total} (missed ${focus.burned}) and can safely bunk ${focus.canBunk} more ${focus.canBunk === 1 ? "class" : "classes"}.`
            : focus.mustAttend > 0 && Number.isFinite(focus.mustAttend)
              ? `You attended ${focus.attended}/${focus.total} (missed ${focus.burned}). You have 0 bunks left — attend the next ${focus.mustAttend} in a row to reach ${metrics.targetPct}%.`
              : `You attended ${focus.attended}/${focus.total} (missed ${focus.burned}), right on your ${metrics.targetPct}% target.`;
      blocks.push({
        title: `${focus.subject} Attendance Overview`,
        highlight: pctText,
        detail: statusNote
      });
      return {
        query,
        intents,
        intentScores: scores,
        matchedSubjects: matchedNames,
        metrics,
        blocks,
        perSubjectRows: [],
        quickReplies: buildSuggestedQuestions(subjectNames, focus.subject)
      };
    }

    // 1. Attendance Percentage Block
    if (intents.includes("PERCENTAGE") || intents.includes("SUMMARY")) {
      const diffLabel =
        focus.total === 0
          ? `No classes recorded for ${focusLabel} yet.`
          : focus.percentage >= metrics.targetPct
            ? `You have attended ${focus.attended} out of ${focus.total} classes in ${focusLabel} — above your ${metrics.targetPct}% target.`
            : `You have attended ${focus.attended} out of ${focus.total} classes in ${focusLabel} — below your ${metrics.targetPct}% target.`;
      blocks.push({
        title: `${focusLabel} Attendance`,
        highlight: formatPct(focus.percentage),
        detail: diffLabel
      });
    }

    // 2. Burned (Missed) Classes Block
    if (intents.includes("BURNED") || intents.includes("SUMMARY")) {
      blocks.push({
        title: `${focusLabel} Classes Missed`,
        highlight: `${focus.burned} ${focus.burned === 1 ? "class" : "classes"}`,
        detail:
          focus.total === 0
            ? `No classes held in ${focusLabel} yet.`
            : `Out of ${focus.total} held classes in ${focusLabel}, you attended ${focus.attended} and missed ${focus.burned}.`
      });
    }

    // 3. Safe Classes You Can Bunk Block
    if (intents.includes("CAN_BUNK") || intents.includes("SUMMARY")) {
      if (focus.total === 0) {
        blocks.push({
          title: `${focusLabel} Safe Bunks`,
          highlight: "0 classes",
          detail: `No classes recorded for ${focusLabel} yet.`
        });
      } else if (focus.canBunk > 0) {
        const afterPct = ((focus.attended / (focus.total + focus.canBunk)) * 100).toFixed(1);
        blocks.push({
          title: `${focusLabel} Safe Bunks`,
          highlight: `You can bunk ${focus.canBunk} ${focus.canBunk === 1 ? "class" : "classes"}`,
          detail: `In ${focusLabel}, you are at ${formatPct(focus.percentage)} (${focus.attended}/${focus.total}). Skipping ${focus.canBunk} keeps you at ${afterPct}% (target ${metrics.targetPct}%).`
        });
      } else {
        const recText =
          focus.mustAttend === Infinity
            ? `100% target cannot be reached after missing a class in ${focusLabel}.`
            : focus.mustAttend > 0
              ? `In ${focusLabel}, you are at ${formatPct(focus.percentage)} (${focus.attended}/${focus.total}) with 0 safe bunks left. Attend the next ${focus.mustAttend} in a row to reach ${metrics.targetPct}%.`
              : `In ${focusLabel}, you are right at ${formatPct(focus.percentage)} (${metrics.targetPct}% target) — attend the next class to build a buffer.`;
        blocks.push({
          title: `${focusLabel} Safe Bunks`,
          highlight: "0 bunks left",
          detail: recText
        });
      }
    }

    // 4. Recovery / Must Attend Block
    if (intents.includes("MUST_ATTEND") && !intents.includes("CAN_BUNK") && !intents.includes("SUMMARY")) {
      if (focus.mustAttend === Infinity) {
        blocks.push({
          title: `${focusLabel} Recovery`,
          highlight: "Unreachable at 100%",
          detail: `Since ${focus.burned} class(es) were missed in ${focusLabel}, 100% is unreachable.`
        });
      } else if (focus.mustAttend > 0) {
        blocks.push({
          title: `${focusLabel} Classes Needed for ${metrics.targetPct}%`,
          highlight: `Attend next ${focus.mustAttend}`,
          detail: `In ${focusLabel} (${focus.attended}/${focus.total} = ${formatPct(focus.percentage)}), attending ${focus.mustAttend} consecutive classes brings you to ${metrics.targetPct}%.`
        });
      } else {
        blocks.push({
          title: `${focusLabel} Recovery`,
          highlight: "Already on target",
          detail: `${focusLabel} is already at ${formatPct(focus.percentage)} (>= ${metrics.targetPct}%).`
        });
      }
    }

    // 5. What-If Simulation Block
    if (intents.includes("WHAT_IF") && params.count !== null) {
      const dA = params.whatIfAction === "attend" ? params.count : 0;
      const dB = params.whatIfAction === "bunk" ? params.count : 0;
      const sim = simulateWhatIf(focus.attended, focus.total, dA, dB, metrics.targetPct);
      blocks.push({
        title: `What-If: ${dB > 0 ? `Bunk ${dB}` : `Attend ${dA}`} in ${focusLabel}`,
        highlight: `${formatPct(sim.percentage)} (${sim.attended}/${sim.total})`,
        detail: sim.detailText
      });
    }

    // 6. Timetable Day Analysis Block
    if (intents.includes("TIMETABLE_DAY") && params.dayIndex !== null) {
      const dayName = DAY_NAMES[params.dayIndex];
      const isHoliday = (currentState?.settings?.weeklyHolidays || []).includes(params.dayIndex);
      const daySubjects = currentState?.timetable?.[dayName] || [];
      if (isHoliday) {
        blocks.push({
          title: `${dayName} Schedule`,
          highlight: "Weekly Holiday",
          detail: `${dayName} is set as a weekly holiday — no classes scheduled.`
        });
      } else if (daySubjects.length === 0) {
        blocks.push({
          title: `${dayName} Schedule`,
          highlight: "No classes scheduled",
          detail: `Your timetable has no classes listed on ${dayName}.`
        });
      } else {
        const dayCounts = {};
        daySubjects.forEach((s) => { dayCounts[s] = (dayCounts[s] || 0) + 1; });
        const lines = Object.entries(dayCounts).map(([sub, cnt]) => {
          const m = metrics.subjects.find((x) => x.subject === sub);
          if (!m || m.total === 0) return `${sub} (${cnt}x): no data yet`;
          const sim = simulateWhatIf(m.attended, m.total, 0, cnt, metrics.targetPct);
          const safe = sim.percentage >= metrics.targetPct;
          return `${sub} (${cnt}x): ${safe ? "SAFE to skip" : "DO NOT SKIP"} -> ${formatPct(sim.percentage)}`;
        });
        blocks.push({
          title: `${dayName} Bunk Check (${daySubjects.length} classes)`,
          highlight: lines.every((l) => l.includes("SAFE to skip")) ? "All classes safe to bunk" : "Some subjects need attendance",
          detail: lines.join(" • ")
        });
      }
    }

    // 7. Semester Horizon Block
    if (intents.includes("SEMESTER_HORIZON")) {
      if (!metrics.horizonEnabled) {
        blocks.push({
          title: "Semester Forecast",
          highlight: "End date not set",
          detail: "Set a Semester End Date in Setup & Timetable to see remaining scheduled classes."
        });
      } else {
        const h = focus === ov ? ov.horizon : focus;
        const margin = focus === ov ? h.semesterMargin : focus.semesterMargin;
        const budget = focus === ov ? h.semesterBudget : focus.semesterBudget;
        const future = focus === ov ? h.futureClasses : focus.futureClasses;
        const maxPct = focus === ov ? h.maxAchievablePct : focus.maxAchievablePct;
        blocks.push({
          title: `${focusLabel} Semester Forecast`,
          highlight: margin >= 0 ? `${margin} semester bunks left` : `${Math.abs(margin)} short of target`,
          detail: `${future} upcoming classes scheduled. Full-semester bunk budget is ${budget} (missed ${focus.burned}). Max achievable = ${formatPct(maxPct)}.`
        });
      }
    }

    // Only include per-subject breakdown when user asked broadly (no single subject) or explicitly asked per-subject
    const includeBreakdown = !isSingleSubject || params.perSubjectExplicit || intents.includes("SUMMARY");

    const perSubjectRows = includeBreakdown
      ? targetSubjects.map((s) => ({
          subject: s.subject,
          attended: s.attended,
          burned: s.burned,
          total: s.total,
          percentage: s.percentage,
          canBunk: s.canBunk,
          mustAttend: s.mustAttend,
          status: s.status,
          actionText: formatSubjectActionText(s)
        }))
      : [];

    const quickReplies = isSingleSubject
      ? buildSuggestedQuestions(subjectNames, focus.subject)
      : [];

    return {
      query,
      intents,
      intentScores: scores,
      matchedSubjects: matchedNames,
      metrics,
      blocks,
      perSubjectRows,
      quickReplies
    };
  }

  function buildAiChartSvg(metrics, mode) {
    const rows = [
      ...metrics.subjects,
      {
        subject: "Overall",
        attended: metrics.overall.attended,
        burned: metrics.overall.burned,
        total: metrics.overall.total,
        percentage: metrics.overall.percentage,
        canBunk: metrics.overall.canBunk,
        mustAttend: metrics.overall.mustAttend,
        status: metrics.overall.status
      }
    ];

    if (metrics.subjects.length === 0) {
      return `<p class="hint">Add subjects or mark attendance to render the algorithmic chart board.</p>`;
    }

    const rowHeight = 34;
    const labelWidth = 115;
    const barMaxWidth = 340;
    const rightPad = 95;
    const topPad = 24;
    const width = labelWidth + barMaxWidth + rightPad;
    const height = topPad + rows.length * rowHeight + 24;
    const colorMap = {
      safe: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
      neutral: "#94a3b8"
    };

    if (mode === "counts") {
      const maxVal = Math.max(
        1,
        ...rows.map((r) => r.attended + r.burned + (r.canBunk > 0 ? r.canBunk : 0))
      );

      const bars = rows
        .map((r, idx) => {
          const y = topPad + idx * rowHeight;
          const wAtt = (r.attended / maxVal) * barMaxWidth;
          const wBurn = (r.burned / maxVal) * barMaxWidth;
          const wSafe = (r.canBunk / maxVal) * barMaxWidth;
          const label = r.subject.length > 13 ? r.subject.slice(0, 12) + "…" : r.subject;
          const summary = `A:${r.attended} B:${r.burned} +${r.canBunk}`;

          return `
            <g>
              <text x="4" y="${y + 16}" font-size="12" fill="currentColor" font-weight="${r.subject === "Overall" ? "700" : "500"}">${escapeHtml(label)}</text>
              <rect x="${labelWidth}" y="${y + 4}" width="${wAtt.toFixed(1)}" height="16" rx="3" fill="#10b981"><title>Attended: ${r.attended}</title></rect>
              <rect x="${(labelWidth + wAtt).toFixed(1)}" y="${y + 4}" width="${wBurn.toFixed(1)}" height="16" rx="3" fill="#ef4444"><title>Burned: ${r.burned}</title></rect>
              ${wSafe > 0 ? `<rect x="${(labelWidth + wAtt + wBurn).toFixed(1)}" y="${y + 4}" width="${wSafe.toFixed(1)}" height="16" rx="3" fill="#6366f1" opacity="0.75"><title>Safe to bunk: ${r.canBunk}</title></rect>` : ""}
              <text x="${labelWidth + barMaxWidth + 8}" y="${y + 16}" font-size="11" fill="currentColor">${escapeHtml(summary)}</text>
            </g>
          `;
        })
        .join("");

      return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;" role="img" aria-label="Attended, Burned, and Safe Bunk Counts Chart">
          <text x="${labelWidth}" y="14" font-size="11" fill="#10b981">■ Attended</text>
          <text x="${labelWidth + 75}" y="14" font-size="11" fill="#ef4444">■ Burned</text>
          <text x="${labelWidth + 140}" y="14" font-size="11" fill="#6366f1">■ Safe to Bunk</text>
          ${bars}
        </svg>
      `;
    }

    // Percentage vs Target mode
    const targetX = labelWidth + (metrics.targetPct / 100) * barMaxWidth;
    const bars = rows
      .map((r, idx) => {
        const y = topPad + idx * rowHeight;
        const pct = r.percentage === null ? 0 : r.percentage;
        const w = (pct / 100) * barMaxWidth;
        const fill = colorMap[r.status] || "#94a3b8";
        const label = r.subject.length > 13 ? r.subject.slice(0, 12) + "…" : r.subject;
        const rightText =
          r.percentage === null
            ? "--%"
            : `${pct.toFixed(1)}% (${r.canBunk > 0 ? `+${r.canBunk}` : r.mustAttend > 0 && Number.isFinite(r.mustAttend) ? `-${r.mustAttend}` : "0"})`;

        return `
          <g>
            <text x="4" y="${y + 16}" font-size="12" fill="currentColor" font-weight="${r.subject === "Overall" ? "700" : "500"}">${escapeHtml(label)}</text>
            <rect x="${labelWidth}" y="${y + 4}" width="${barMaxWidth}" height="16" rx="4" fill="rgba(148,163,184,0.18)" />
            <rect x="${labelWidth}" y="${y + 4}" width="${w.toFixed(1)}" height="16" rx="4" fill="${fill}"><title>${escapeHtml(r.subject)}: ${formatPct(r.percentage)}</title></rect>
            <text x="${labelWidth + barMaxWidth + 8}" y="${y + 16}" font-size="11" fill="currentColor">${escapeHtml(rightText)}</text>
          </g>
        `;
      })
      .join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px;display:block;" role="img" aria-label="Subject Attendance Percentage vs Target Chart">
        <text x="${targetX}" y="13" font-size="11" font-weight="700" fill="#6366f1" text-anchor="middle">Target ${metrics.targetPct}%</text>
        ${bars}
        <line x1="${targetX.toFixed(1)}" y1="${topPad}" x2="${targetX.toFixed(1)}" y2="${height - 14}" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 3" />
      </svg>
    `;
  }

  /* --- CHATGPT-STYLE SIDE ASSISTANT DRAWER --- */
  let chatDrawerOpen = false;
  let chatMode = "chat"; // "chat" | "charts"

  function openChatDrawer(initialMode) {
    const drawer = getEl("chat-drawer");
    const backdrop = getEl("chat-backdrop");
    if (!drawer || !backdrop) return;

    if (initialMode === "charts" || initialMode === "chat") {
      chatMode = initialMode;
    }

    chatDrawerOpen = true;
    drawer.classList.remove("hidden");
    backdrop.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Close mobile sidebar if open
    const sidebar = getEl("sidebar");
    const overlay = getEl("sidebar-overlay");
    if (sidebar) sidebar.classList.add("-translate-x-full");
    if (overlay) overlay.classList.add("hidden", "opacity-0");

    renderChatDrawer();
    if (chatMode === "chat") {
      setTimeout(() => {
        const inp = getEl("chat-input");
        if (inp) inp.focus();
      }, 60);
    }
  }

  function closeChatDrawer() {
    const drawer = getEl("chat-drawer");
    const backdrop = getEl("chat-backdrop");
    if (!drawer || !backdrop) return;
    chatDrawerOpen = false;
    drawer.classList.add("hidden");
    backdrop.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function setChatMode(mode) {
    chatMode = mode === "charts" ? "charts" : "chat";
    renderChatDrawer();
  }

  function renderChatMessages() {
    const container = getEl("chat-messages");
    if (!container) return;

    const metrics = computeAllMetrics(state);
    const firstSub = metrics.subjects[0]?.subject || "OS";
    const starterPrompts = [
      "How many classes can I bunk?",
      "How many classes have I burned?",
      "Can I bunk today?",
      `What if I bunk 2 in ${firstSub}?`
    ];

    if (aiBoardMessages.length === 0) {
      container.innerHTML = `
        <div class="chat-welcome">
          <div class="chat-welcome-icon" aria-hidden="true">✦</div>
          <h3>Ask anything about your attendance</h3>
          <p>Tap a question below or type your own to get instant answers from your schedule.</p>
          <div class="chat-starter-grid">
            ${starterPrompts
              .map(
                (p) =>
                  `<button type="button" class="chat-starter-btn" onclick="askChatAssistant('${escapeHtml(p).replace(/'/g, "\\'")}')">${escapeHtml(p)}</button>`
              )
              .join("")}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = aiBoardMessages
      .map((msg) => {
        const blocksHtml = msg.blocks
          .map(
            (b) => `
            <div class="chat-answer-block">
              <div class="chat-answer-title">${escapeHtml(b.title)}</div>
              <div class="chat-answer-highlight">${escapeHtml(b.highlight)}</div>
              <div class="chat-answer-detail">${escapeHtml(b.detail)}</div>
            </div>
          `
          )
          .join("");

        const breakdownHtml =
          msg.perSubjectRows && msg.perSubjectRows.length > 0
            ? `
            <div class="chat-mini-list">
              ${msg.perSubjectRows
                .map(
                  (r) => `
                  <div class="chat-mini-item">
                    <span><strong>${escapeHtml(r.subject)}</strong> (${formatPct(r.percentage)})</span>
                    <span class="pill-muted">${escapeHtml(r.actionText)}</span>
                  </div>
                `
                )
                .join("")}
            </div>
          `
            : "";

        const quickRepliesHtml =
          msg.quickReplies && msg.quickReplies.length > 0
            ? `
            <div class="chat-quick-replies">
              ${msg.quickReplies
                .map(
                  (qr) =>
                    `<button type="button" class="chat-reply-chip" onclick="askChatAssistant('${escapeHtml(qr).replace(/'/g, "\\'")}')">${escapeHtml(qr)}</button>`
                )
                .join("")}
            </div>
          `
            : "";

        return `
          <div class="chat-msg-row">
            <div class="chat-bubble-user">${escapeHtml(msg.query)}</div>
            <div class="chat-bubble-bot">
              ${blocksHtml}
              ${breakdownHtml}
            </div>
            ${quickRepliesHtml}
          </div>
        `;
      })
      .join("");

    container.scrollTop = container.scrollHeight;
  }

  function renderChatCharts() {
    const host = getEl("chat-charts-body");
    if (!host) return;

    const metrics = computeAllMetrics(state);
    const ov = metrics.overall;

    const tableRowsHtml =
      metrics.subjects.length === 0
        ? `<tr><td colspan="5">No subjects added yet.</td></tr>`
        : metrics.subjects
            .map(
              (s) => `
          <tr>
            <td><strong>${escapeHtml(s.subject)}</strong></td>
            <td>${s.attended}/${s.total}</td>
            <td>${s.burned}</td>
            <td>${formatPct(s.percentage)}</td>
            <td><span class="pct-pill status-${s.status}" style="font-size:11px;padding:3px 8px;">${escapeHtml(formatSubjectActionText(s))}</span></td>
          </tr>
        `
            )
            .join("");

    host.innerHTML = `
      <div class="chat-kpi-grid">
        <div class="chat-kpi-card">
          <div class="chat-kpi-lbl">Overall</div>
          <div class="chat-kpi-val">${formatPct(ov.percentage)}</div>
          <div class="chat-kpi-sub">${ov.attended} / ${ov.total} (Target ${metrics.targetPct}%)</div>
        </div>
        <div class="chat-kpi-card">
          <div class="chat-kpi-lbl">Safe Skips</div>
          <div class="chat-kpi-val">${ov.canBunk}</div>
          <div class="chat-kpi-sub">${ov.mustAttend > 0 && Number.isFinite(ov.mustAttend) ? `Need next ${ov.mustAttend}` : `Burned ${ov.burned} total`}</div>
        </div>
      </div>

      <div class="chat-chart-toggle">
        <button type="button" class="ai-tab-btn ${aiBoardChartMode === "percentage" ? "active" : ""}" onclick="setChatChartMode('percentage')">% vs Target</button>
        <button type="button" class="ai-tab-btn ${aiBoardChartMode === "counts" ? "active" : ""}" onclick="setChatChartMode('counts')">Attended / Burned</button>
      </div>

      <div class="chat-chart-box">${buildAiChartSvg(metrics, aiBoardChartMode)}</div>

      <div class="chat-table-wrap">
        <table class="chat-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Att/Tot</th>
              <th>Missed</th>
              <th>%</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function renderChatDrawer() {
    const tabChat = getEl("chat-tab-chat");
    const tabCharts = getEl("chat-tab-charts");
    const panelChat = getEl("chat-panel-chat");
    const panelCharts = getEl("chat-panel-charts");

    if (tabChat) {
      tabChat.classList.toggle("active", chatMode === "chat");
      tabChat.setAttribute("aria-selected", String(chatMode === "chat"));
    }
    if (tabCharts) {
      tabCharts.classList.toggle("active", chatMode === "charts");
      tabCharts.setAttribute("aria-selected", String(chatMode === "charts"));
    }
    if (panelChat) panelChat.classList.toggle("active", chatMode === "chat");
    if (panelCharts) panelCharts.classList.toggle("active", chatMode === "charts");

    if (chatMode === "chat") {
      renderChatMessages();
    } else {
      renderChatCharts();
    }
  }

  function initChatAssistant() {
    const openBtn = getEl("chat-open-btn");
    const sidebarBtn = getEl("sidebar-chat-btn");
    const closeBtn = getEl("chat-close-btn");
    const clearBtn = getEl("chat-clear-btn");
    const backdrop = getEl("chat-backdrop");
    const tabChat = getEl("chat-tab-chat");
    const tabCharts = getEl("chat-tab-charts");
    const form = getEl("chat-form");
    const input = getEl("chat-input");

    window.openChatAssistant = openChatDrawer;
    window.closeChatAssistant = closeChatDrawer;
    window.setChatChartMode = function (mode) {
      aiBoardChartMode = mode === "counts" ? "counts" : "percentage";
      renderChatCharts();
    };
    window.askChatAssistant = function (promptText) {
      const q = String(promptText || "").trim();
      if (!q) return;
      const result = runAlgorithmicBoardQuery(q, state);
      aiBoardMessages.push(result);
      chatMode = "chat";
      renderChatDrawer();
    };

    if (openBtn) openBtn.addEventListener("click", () => openChatDrawer("chat"));
    if (sidebarBtn) sidebarBtn.addEventListener("click", () => openChatDrawer("chat"));
    if (closeBtn) closeBtn.addEventListener("click", closeChatDrawer);
    if (backdrop) backdrop.addEventListener("click", closeChatDrawer);
    if (tabChat) tabChat.addEventListener("click", () => setChatMode("chat"));
    if (tabCharts) tabCharts.addEventListener("click", () => setChatMode("charts"));

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        aiBoardMessages.length = 0;
        chatMode = "chat";
        renderChatDrawer();
        showToast("Started a fresh chat.", "info");
      });
    }

    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        input.value = "";
        window.askChatAssistant(q);
      });
    }

    const fgBackdrop = getEl("full-graph-backdrop");
    if (fgBackdrop) fgBackdrop.addEventListener("click", () => {
      if (typeof window !== "undefined" && window.closeFullGraphModal) window.closeFullGraphModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (fullGraphOpen && typeof window !== "undefined" && window.closeFullGraphModal) {
          window.closeFullGraphModal();
        } else if (chatDrawerOpen) {
          closeChatDrawer();
        }
      }
    });
  }

  function initGuideBanner() {
    const banner = getEl("guide-banner");
    const btn = getEl("guide-toggle-btn");
    const chevron = getEl("guide-chevron");
    if (!banner || !btn) return;

    // Collapse by default on narrow mobile screens so dashboard cards appear immediately
    const startCollapsed = typeof window !== "undefined" && window.innerWidth < 640;
    if (startCollapsed) {
      banner.classList.add("collapsed");
      btn.setAttribute("aria-expanded", "false");
      if (chevron) chevron.textContent = "▸";
    }

    btn.addEventListener("click", () => {
      const collapsed = banner.classList.toggle("collapsed");
      btn.setAttribute("aria-expanded", String(!collapsed));
      if (chevron) chevron.textContent = collapsed ? "▸" : "▾";
    });
  }

  /* --- PHONE LOGIN MODAL, PERSISTENCE & MONTHLY FILES UI --- */
  function renderUserPill() {
    const label = getEl("user-pill-label");
    if (!label) return;
    const user = getActiveUser();
    label.textContent = user ? `${user.name.split(" ")[0]} · ${user.displayRollNo}` : "Login";
  }

  function renderSavedUsersList() {
    const section = getEl("saved-users-section");
    const listEl = getEl("saved-users-list");
    if (!section || !listEl) return;

    const users = Object.values(loadUsersRegistry()).sort((a, b) =>
      String(b.lastLoginAt || "").localeCompare(String(a.lastLoginAt || ""))
    );
    if (users.length === 0) {
      section.classList.add("hidden");
      listEl.innerHTML = "";
      return;
    }

    const activeRoll = getActiveRollNo();
    section.classList.remove("hidden");
    listEl.innerHTML = users
      .map(
        (u) => `
      <button type="button" class="saved-user-chip ${u.rollNo === activeRoll ? "active" : ""}" onclick="selectSavedPhoneUser('${escapeHtml(u.rollNo)}')">
        <div>
          <strong>${escapeHtml(u.name)}</strong>
          <div class="saved-user-meta">Roll No: ${escapeHtml(u.displayRollNo)}</div>
        </div>
        <span class="pill-muted">${u.rollNo === activeRoll ? "Active" : "Switch"}</span>
      </button>
    `
      )
      .join("");
  }

  function openLoginModal(allowClose = Boolean(getActiveUser())) {
    const backdrop = getEl("login-backdrop");
    const modal = getEl("login-modal");
    const closeBtn = getEl("login-close-btn");
    const nameIn = getEl("login-name");
    const rollIn = getEl("login-roll");
    const hint = getEl("login-match-hint");
    if (!backdrop || !modal) return;

    const activeUser = getActiveUser();
    if (closeBtn) {
      closeBtn.classList.toggle("hidden", !allowClose);
    }
    if (nameIn && activeUser && !nameIn.value) {
      nameIn.value = activeUser.name || "";
    }
    if (rollIn && activeUser && !rollIn.value) {
      rollIn.value = activeUser.displayRollNo || "";
    }
    if (hint) {
      hint.textContent = activeUser
        ? `Currently signed in as ${activeUser.name} (${activeUser.displayRollNo}). Enter another Roll No to add/switch profile.`
        : "Your Name and Roll Number create an offline profile saved directly in this phone's storage.";
    }

    renderSavedUsersList();
    backdrop.classList.remove("hidden");
    modal.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    if (nameIn && typeof nameIn.focus === "function") setTimeout(() => nameIn.focus(), 30);
  }

  function closeLoginModal() {
    const backdrop = getEl("login-backdrop");
    const modal = getEl("login-modal");
    if (!backdrop || !modal) return;
    backdrop.classList.add("hidden");
    modal.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
  }

  async function restorePhoneFolderHandle() {
    const db = await openPhoneIndexedDB();
    if (!db) return;
    const activeRoll = getActiveRollNo() || "LOCAL";
    const rec = (await idbGet(db, "file_handles", `phone_folder_${activeRoll}`)) || (await idbGet(db, "file_handles", "phone_folder_global"));
    if (rec && rec.handle) {
      phoneDirectoryHandle = rec.handle;
      lastFileSyncStatus = `Folder linked: "${rec.handle.name}"`;
      renderPhoneStoragePanel();
    }
  }

  async function requestPersistentPhoneStorage() {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
      try {
        phonePersistGranted = await navigator.storage.persist();
      } catch (e) {
        phonePersistGranted = false;
      }
    }
  }

  async function linkPhoneFolderForAutoSave() {
    if (typeof window === "undefined" || typeof window.showDirectoryPicker !== "function") {
      showToast("Direct folder auto-save is not supported by this browser. Use Save PDF / JSON buttons below.", "info");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      phoneDirectoryHandle = handle;
      const db = await openPhoneIndexedDB();
      const activeRoll = getActiveRollNo() || "LOCAL";
      if (db) {
        await idbPut(db, "file_handles", { id: `phone_folder_${activeRoll}`, handle, savedAt: new Date().toISOString() });
        await idbPut(db, "file_handles", { id: "phone_folder_global", handle, savedAt: new Date().toISOString() });
      }
      await syncToPhoneDatabase(state, getActiveUser(), isoDate());
      showToast(`Linked folder "${handle.name}" — all attendance & monthly files will auto-save there.`, "success");
    } catch (e) {
      if (e && e.name !== "AbortError") {
        showToast("Could not link phone folder.", "error");
      }
    }
  }

  function renderPhoneStoragePanel() {
    const panel = getEl("phone-storage-panel");
    const badge = getEl("phone-db-badge");
    if (!panel) return;

    const user = getActiveUser();
    const months = getAvailableMonthKeys(state);
    const dailyCount = Object.keys(state.dailyMarks || {}).length;
    const autoDownloadOn = getAutoDownloadEnabled();
    const supportsDirPicker = typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

    if (badge) {
      badge.textContent = phoneDirectoryHandle ? `Folder: ${phoneDirectoryHandle.name}` : "Phone DB Active";
    }

    const monthlyRowsHtml = months
      .map((mk) => {
        const rep = buildMonthlyAttendanceReport(state, mk, user);
        const pctText = rep.overall.monthlyPct === null ? "No marks yet" : `${rep.overall.monthlyPct}% (${rep.overall.present}/${rep.overall.held})`;
        return `
          <div class="monthly-file-row">
            <div>
              <strong>${escapeHtml(rep.monthLabel)} (${escapeHtml(mk)})</strong>
              <div class="saved-user-meta">${rep.totalDaysMarked} day(s) logged • ${escapeHtml(pctText)}</div>
            </div>
            <div class="monthly-file-actions">
              <button type="button" class="btn-mini" onclick="downloadMonthFile('${escapeHtml(mk)}', 'pdf')">📄 Month PDF</button>
              <button type="button" class="btn-mini" onclick="downloadMonthFile('${escapeHtml(mk)}', 'json')">⬇ Month JSON</button>
            </div>
          </div>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="phone-db-grid">
        <div class="phone-db-stat">
          <div class="phone-db-stat-lbl">Logged Student</div>
          <div class="phone-db-stat-val">${user ? `${escapeHtml(user.name)} (${escapeHtml(user.displayRollNo)})` : "Not signed in"}</div>
        </div>
        <div class="phone-db-stat">
          <div class="phone-db-stat-lbl">Phone Database Set</div>
          <div class="phone-db-stat-val">${dailyCount} Daily Logs · ${months.length} Monthly Archives</div>
        </div>
        <div class="phone-db-stat">
          <div class="phone-db-stat-lbl">Sync Status</div>
          <div class="phone-db-stat-val">${escapeHtml(lastFileSyncStatus)}${phonePersistGranted ? " (Persistent)" : ""}</div>
        </div>
      </div>

      <div class="data-actions" style="margin-bottom: 12px;">
        ${
          supportsDirPicker
            ? `<button type="button" id="link-phone-folder-btn" class="btn-primary">📁 ${phoneDirectoryHandle ? "Change Linked Phone Folder" : "Link Phone Folder (Auto-Save Files)"}</button>`
            : ""
        }
        <button type="button" id="download-full-pdf-btn" class="btn-primary">📄 Download Full Report (PDF)</button>
        <button type="button" id="download-full-db-btn" class="btn-secondary">💾 Save Complete Backup (JSON)</button>
        <button type="button" id="switch-user-btn" class="btn-secondary">👤 Switch / Add Student</button>
      </div>

      <label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;cursor:pointer;">
        <input type="checkbox" id="auto-download-monthly-chk" ${autoDownloadOn ? "checked" : ""}>
        <span>Also download updated Monthly Attendance PDF automatically whenever I mark daily roll call</span>
      </label>

      <div>
        <span class="setting-label">Monthly Attendance Files (Auto-Generated Per Month)</span>
        <div class="monthly-files-list">${monthlyRowsHtml}</div>
      </div>
    `;

    const linkBtn = getEl("link-phone-folder-btn");
    if (linkBtn) linkBtn.onclick = linkPhoneFolderForAutoSave;

    const fullPdfBtn = getEl("download-full-pdf-btn");
    if (fullPdfBtn) {
      fullPdfBtn.onclick = () => {
        const activeUser = getActiveUser();
        const pdfBytes = buildCompleteAttendancePdf(state, activeUser);
        const rollSlug = (activeUser?.rollNo || "student").toLowerCase();
        downloadTextFile(`bunksmart-${rollSlug}-attendance-${isoDate()}.pdf`, pdfBytes, "application/pdf");
        showToast("Full attendance PDF downloaded!", "success");
      };
    }

    const fullDbBtn = getEl("download-full-db-btn");
    if (fullDbBtn) {
      fullDbBtn.onclick = () => {
        const payload = buildCompletePhoneDatabasePayload(state, getActiveUser());
        const rollSlug = (getActiveUser()?.rollNo || "student").toLowerCase();
        downloadTextFile(`bunksmart-${rollSlug}-database-${isoDate()}.json`, JSON.stringify(payload, null, 2), "application/json");
        showToast("Complete phone database file saved!", "success");
      };
    }

    const switchBtn = getEl("switch-user-btn");
    if (switchBtn) switchBtn.onclick = () => openLoginModal(true);

    const autoChk = getEl("auto-download-monthly-chk");
    if (autoChk) {
      autoChk.onchange = () => {
        setAutoDownloadEnabled(autoChk.checked);
        showToast(
          autoChk.checked ? "Auto-download on daily save enabled." : "Auto-download on daily save disabled.",
          "info"
        );
      };
    }
  }

  function initStudentLogin() {
    const profileBtn = getEl("user-profile-btn");
    const closeBtn = getEl("login-close-btn");
    const backdrop = getEl("login-backdrop");
    const form = getEl("login-form");
    const nameIn = getEl("login-name");
    const rollIn = getEl("login-roll");
    const hint = getEl("login-match-hint");

    if (profileBtn) profileBtn.addEventListener("click", () => openLoginModal(Boolean(getActiveUser())));
    if (closeBtn) closeBtn.addEventListener("click", closeLoginModal);
    if (backdrop) backdrop.addEventListener("click", () => {
      if (getActiveUser()) closeLoginModal();
    });

    if (rollIn && hint) {
      rollIn.addEventListener("input", () => {
        const rn = normalizeRollNo(rollIn.value);
        const existing = rn ? loadUsersRegistry()[rn] : null;
        if (existing) {
          hint.textContent = `Existing profile found on this phone: ${existing.name} (${existing.displayRollNo}) — will load your saved data.`;
          if (nameIn && !nameIn.value.trim()) nameIn.value = existing.name;
        } else if (rn) {
          hint.textContent = "New profile — will be created & saved in your phone storage.";
        } else {
          hint.textContent = "";
        }
      });
    }

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const res = loginOrRegisterUser(nameIn ? nameIn.value : "", rollIn ? rollIn.value : "");
        if (res.error) {
          showToast(res.error, "warning");
          return;
        }
        closeLoginModal();
        renderAll();
        restorePhoneFolderHandle();
        showToast(
          res.isNew
            ? `Profile saved on phone for ${res.user.name} (${res.user.displayRollNo}).`
            : `Welcome back, ${res.user.name} (${res.user.displayRollNo})!`,
          "success"
        );
      });
    }

    if (typeof window !== "undefined") {
      window.selectSavedPhoneUser = function (rollNo) {
        const reg = loadUsersRegistry();
        const target = reg[normalizeRollNo(rollNo)];
        if (!target) return;
        const res = loginOrRegisterUser(target.name, target.displayRollNo);
        if (!res.error) {
          closeLoginModal();
          renderAll();
          restorePhoneFolderHandle();
          showToast(`Switched to ${res.user.name} (${res.user.displayRollNo}).`, "success");
        }
      };

      window.downloadFullAttendancePdf = function () {
        const activeUser = getActiveUser();
        const pdfBytes = buildCompleteAttendancePdf(state, activeUser);
        const rollSlug = (activeUser?.rollNo || "student").toLowerCase();
        downloadTextFile(`bunksmart-${rollSlug}-attendance-${isoDate()}.pdf`, pdfBytes, "application/pdf");
        showToast("Attendance PDF downloaded!", "success");
      };

      window.downloadMonthFile = function (monthKey, format) {
        const activeUser = getActiveUser();
        const report = buildMonthlyAttendanceReport(state, monthKey, activeUser);
        const rollSlug = (activeUser?.rollNo || "student").toLowerCase();
        if (format === "json") {
          downloadTextFile(`bunksmart-${rollSlug}-month-${monthKey}.json`, JSON.stringify(report, null, 2), "application/json");
          showToast(`Saved ${monthKey} attendance (JSON) to phone files.`, "success");
        } else {
          downloadTextFile(`bunksmart-${rollSlug}-month-${monthKey}.pdf`, buildMonthlyAttendancePdf(report), "application/pdf");
          showToast(`Saved ${monthKey} attendance report (PDF) to phone files.`, "success");
        }
      };
    }
  }

  const publicApi = {
    getPercentage,
    getBunkAnalysis,
    simulateWhatIf,
    countRemainingClassesBySubject,
    computeAllMetrics,
    levenshteinDistance,
    matchSubjectsInQuery,
    extractQueryParameters,
    classifyQueryIntents,
    runAlgorithmicBoardQuery,
    normalizeRollNo,
    loginOrRegisterUser,
    getActiveUser,
    getAvailableMonthKeys,
    buildMonthlyAttendanceReport,
    buildMonthlyAttendancePdf,
    buildCompleteAttendancePdf,
    buildCompletePhoneDatabasePayload
  };

  if (typeof window !== "undefined") {
    window.BunkSmartAlgorithms = publicApi;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }

  function renderAll() {
    renderUserPill();
    renderHome();
    renderRollCallWidget();
    renderSettings();
    renderPredictor();
    if (chatDrawerOpen) {
      renderChatDrawer();
    }
    if (fullGraphOpen) {
      renderFullGraphModal();
    }
  }

  function initSupportSection() {
    const copyBtn = getEl("copy-support-email-btn");
    if (!copyBtn) return;

    const supportEmail = "ajayyadavtom@zohomail.in";
    copyBtn.addEventListener("click", async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(supportEmail);
        } else {
          const temp = document.createElement("textarea");
          temp.value = supportEmail;
          temp.setAttribute("readonly", "");
          temp.style.position = "absolute";
          temp.style.left = "-9999px";
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          document.body.removeChild(temp);
        }
        showToast(`Copied ${supportEmail}!`, "success");
      } catch (e) {
        showToast(`Support email: ${supportEmail}`, "info");
      }
    });
  }

  /* --- INIT --- */
  function init() {
    initTheme();
    initNav();
    initGuideBanner();
    initQuickAddSubject();
    initChatAssistant();
    initSupportSection();
    initStudentLogin();
    requestPersistentPhoneStorage();
    renderAll();

    const activeUser = getActiveUser();
    if (!activeUser) {
      openLoginModal(false);
    } else {
      restorePhoneFolderHandle();
      syncToPhoneDatabase(state, activeUser);
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
