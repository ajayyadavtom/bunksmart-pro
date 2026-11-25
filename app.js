(function () {
  "use strict";

  const STORAGE_KEY = "bunksmart_pro_state_v2";
  const THEME_KEY = "bunksmart_theme";
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DISPLAY_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const GRADE_POINTS = { O: 10, "A+": 9, A: 8, "B+": 7, B: 6, C: 5, P: 4, F: 0 };

  let toastTimer = null;
  let selectedRollCallDate = null; // Initialized after local date helper is ready
  let editingSubject = null;

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
        Monday: ["Maths", "Physics", "CS"],
        Tuesday: ["English", "Maths"],
        Wednesday: ["CS", "Physics"],
        Thursday: ["Maths", "English"],
        Friday: ["Physics", "CS", "Lab"],
        Saturday: []
      },
      attendance: {
        Maths: { attended: 10, total: 12, history: [] },
        Physics: { attended: 8, total: 10, history: [] },
        CS: { attended: 11, total: 12, history: [] },
        English: { attended: 5, total: 8, history: [] },
        Lab: { attended: 2, total: 2, history: [] }
      },
      dailyMarks: {},
      sgpaRows: [
        { subject: "Maths", credits: 4, grade: "A" },
        { subject: "CS", credits: 4, grade: "A+" }
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
          history: Array.isArray(rec.history) ? rec.history : []
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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildSampleState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.settings || !parsed.timetable) {
        return buildSampleState();
      }
      return sanitizeState(parsed);
    } catch (e) {
      return buildSampleState();
    }
  }

  function saveState(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch (e) {
      showToast("Could not save changes to browser storage.", "error");
    }
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

  window.openEditSubject = function (encodedSub) {
    const sub = decodeURIComponent(encodedSub);
    if (!state.attendance[sub]) return;
    editingSubject = editingSubject === sub ? null : sub;
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
            const analysis = getBunkAnalysis(d.attended, d.total, targetPct);
            const enc = encodeURIComponent(sub);
            const isEditing = editingSubject === sub;

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
                </div>
                <div class="subject-actions">
                  <span class="pct-pill status-${analysis.status}">${pStr}</span>
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

    renderAiBoard();
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

      state.attendance[name] = { attended, total, history: [] };
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

  function markClass(dateKey, classIndex, newSubject, status) {
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
        saveState(state);
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
    saveState(state);
    renderRollCallWidget();
    renderHome();

    const labels = { attended: "Present", bunked: "Absent", holiday: "Cancelled" };
    showToast(`Marked ${cleanSubject} as ${labels[status] || status}.`, "success");
  }

  window.toggleDayHoliday = function (dateKeyParam) {
    const dateKey = dateKeyParam || selectedRollCallDate || isoDate();
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

    saveState(state);
    renderRollCallWidget();
    renderHome();
  };

  window.setRollCallDate = function (nextDate) {
    if (!nextDate) return;
    selectedRollCallDate = nextDate;
    renderRollCallWidget();
  };

  function renderRollCallWidget() {
    const host = getEl("rollcall-widget");
    if (!host) return;

    const dateKey = selectedRollCallDate || isoDate();
    const todayKey = isoDate();
    const localDate = parseLocalDate(dateKey);
    const dayIndex = localDate.getDay();
    const dayName = DAY_NAMES[dayIndex];
    const isToday = dateKey === todayKey;

    const dateBar = `
      <div class="rc-toolbar">
        <div class="rc-date-group">
          <label for="rc-date-picker" class="sr-only">Select date</label>
          <input type="date" id="rc-date-picker" class="form-input rc-date-input" value="${escapeHtml(dateKey)}" onchange="setRollCallDate(this.value)">
          <span class="rc-day-label">${dayName}${isToday ? " (Today)" : ""}</span>
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
          <input type="text" id="rc-extra-sub" list="all-subjects" class="form-input" placeholder="e.g. Maths Lab">
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
            <input type="text" id="tt-in-${day}" class="form-input" value="${escapeHtml((state.timetable[day] || []).join(", "))}" placeholder="${isHoliday ? "Weekly holiday" : "e.g. Maths, Physics, CS"}">
          </div>
        `;
      }).join("");
    }

    const saveTtBtn = getEl("save-timetable");
    if (saveTtBtn) {
      saveTtBtn.onclick = () => {
        DAY_NAMES.forEach((day) => {
          const input = getEl(`tt-in-${day}`);
          if (!input) return;
          const subs = input.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          state.timetable[day] = subs;
          subs.forEach((s) => ensureSubject(s));
        });
        saveState(state);
        renderHome();
        renderRollCallWidget();
        showToast("Timetable saved successfully!", "success");
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
            state = sanitizeState(parsed);
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
        if (confirm("Replace your current data with demo sample classes?")) {
          state = buildSampleState();
          saveState(state);
          renderAll();
          showToast("Demo sample data loaded.", "info");
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

  function matchSubjectsInQuery(query, subjectNames) {
    const normQuery = normalizeQueryText(query);
    if (!normQuery || !Array.isArray(subjectNames) || subjectNames.length === 0) return [];
    const tokens = normQuery.split(" ").filter(Boolean);
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
            if (sim >= 0.65) {
              bestScore = Math.max(bestScore, sim);
            }
          }

          if (i + 1 < tokens.length && normSub.length >= 4) {
            const bigram = `${tok} ${tokens[i + 1]}`;
            const bgSim = 1 - levenshteinDistance(bigram, normSub) / Math.max(bigram.length, normSub.length);
            if (bgSim >= 0.7) {
              bestScore = Math.max(bestScore, bgSim);
            }
          }
        }
      }

      if (bestScore >= 0.65) {
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

  function classifyQueryIntents(query, params) {
    const norm = normalizeQueryText(query);
    const rules = {
      BURNED: [
        [/\b(burn|burned|burnt|bunked|missed|skipped|absent)\b/, 3],
        [/\bhow many\b.*\b(burn|burned|burnt|bunked|missed|skipped)\b/, 4]
      ],
      CAN_BUNK: [
        [/\b(can i bunk|can i skip|can i miss|safe to bunk|safe to skip|bunkable|left to bunk|buffer|allowance)\b/, 4],
        [/\bhow many\b.*\b(can i|could i|may i|able to)\s+(bunk|skip|miss)\b/, 5],
        [/\bhow many\b.*\b(have to bunk|to bunk)\b/, 4]
      ],
      MUST_ATTEND: [
        [/\b(must attend|need to attend|have to attend|recover|recovery|shortage|deficit|required)\b/, 4],
        [/\bhow many\b.*\b(have to|need to|must)\s+(attend|cover|go)\b/, 5],
        [/\bhow many\b.*\b(have to bunk)\b/, 2]
      ],
      PERCENTAGE: [
        [/\b(percent|percentage|pct|ratio|attendance rate|my attendance)\b/, 4],
        [/\bwhat\s*(is|s)?\s*(my|the|current)?\s*(overall\s*)?attendance\b/, 4]
      ],
      WHAT_IF: [
        [/\b(what if|suppose|simulate|if i)\b/, 4]
      ],
      TIMETABLE_DAY: [
        [/\b(today|tomorrow|schedule|timetable)\b/, 3]
      ],
      SEMESTER_HORIZON: [
        [/\b(semester|end date|horizon|total budget|final percentage|max achievable)\b/, 4]
      ],
      SUMMARY: [
        [/\b(summary|overview|report|status|all|everything|chart|board|help)\b/, 3]
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

    const active = Object.keys(scores).filter((k) => scores[k] >= 3);
    if (active.length === 0) {
      active.push("SUMMARY");
    }
    active.sort((a, b) => scores[b] - scores[a]);
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

  /**
   * Pure algorithmic query solver for the AI Chart & Query Board.
   * Answers burned, safe bunks, attendance %, per-subject breakdown, what-if, and schedule queries.
   */
  function runAlgorithmicBoardQuery(query, currentState = state, refDate = new Date()) {
    const metrics = computeAllMetrics(currentState, refDate);
    const subjectNames = metrics.subjects.map((s) => s.subject);
    const matchedNames = matchSubjectsInQuery(query, subjectNames);
    const params = extractQueryParameters(query, refDate);
    const { active: intents, scores } = classifyQueryIntents(query, params);

    const targetSubjects =
      matchedNames.length > 0
        ? metrics.subjects.filter((s) => matchedNames.includes(s.subject))
        : metrics.subjects;

    const blocks = [];
    const ov = metrics.overall;
    const isSingleSubject = matchedNames.length === 1 && !params.perSubjectExplicit;
    const focus = isSingleSubject ? targetSubjects[0] : ov;
    const focusLabel = isSingleSubject ? focus.subject : "Overall";

    // 1. Attendance Percentage Block
    if (intents.includes("PERCENTAGE") || intents.includes("SUMMARY")) {
      blocks.push({
        title: `${focusLabel} Attendance Percentage`,
        highlight: formatPct(focus.percentage),
        detail:
          focus.total === 0
            ? `No classes recorded for ${focusLabel} yet.`
            : `${focus.attended} attended out of ${focus.total} total classes (${formatPct(focus.percentage)} vs ${metrics.targetPct}% target).`
      });
    }

    // 2. Burned (Bunked) Classes Block
    if (intents.includes("BURNED") || intents.includes("SUMMARY")) {
      blocks.push({
        title: `${focusLabel} Classes Burned (Missed)`,
        highlight: `${focus.burned} ${focus.burned === 1 ? "class" : "classes"}`,
        detail:
          focus.total === 0
            ? `0 classes burned so far.`
            : `Formula B = T - A = ${focus.total} - ${focus.attended} = ${focus.burned} burned (${((focus.burned / focus.total) * 100).toFixed(1)}% missed).`
      });
    }

    // 3. Safe Classes You Can Bunk Block
    if (intents.includes("CAN_BUNK") || intents.includes("SUMMARY")) {
      if (focus.total === 0) {
        blocks.push({
          title: `${focusLabel} Safe Bunks Available`,
          highlight: "0 classes",
          detail: "Add or mark classes first to compute your safe bunk buffer."
        });
      } else if (focus.canBunk > 0) {
        blocks.push({
          title: `${focusLabel} Safe Bunks Available`,
          highlight: `Can bunk ${focus.canBunk} ${focus.canBunk === 1 ? "class" : "classes"}`,
          detail: `Formula S = floor((100*${focus.attended} - ${metrics.targetPct}*${focus.total}) / ${metrics.targetPct}) = ${focus.canBunk}. Skipping ${focus.canBunk} keeps attendance at ${((focus.attended / (focus.total + focus.canBunk)) * 100).toFixed(1)}% >= ${metrics.targetPct}%.`
        });
      } else {
        const recText =
          focus.mustAttend === Infinity
            ? "100% target cannot be recovered once a class is missed."
            : focus.mustAttend > 0
              ? `You have 0 safe bunks left; attend the next ${focus.mustAttend} in a row to reach ${metrics.targetPct}%.`
              : `You have 0 safe bunks left (right on the ${metrics.targetPct}% boundary).`;
        blocks.push({
          title: `${focusLabel} Safe Bunks Available`,
          highlight: "0 classes",
          detail: recText
        });
      }
    }

    // 4. Recovery / Must Attend Block
    if (intents.includes("MUST_ATTEND") && !intents.includes("CAN_BUNK") && !intents.includes("SUMMARY")) {
      if (focus.mustAttend === Infinity) {
        blocks.push({
          title: `${focusLabel} Recovery Requirement`,
          highlight: "Unreachable at 100%",
          detail: `Since ${focus.burned} class(es) were burned, 100% is unreachable.`
        });
      } else if (focus.mustAttend > 0) {
        blocks.push({
          title: `${focusLabel} Classes to Attend for ${metrics.targetPct}%`,
          highlight: `Attend next ${focus.mustAttend}`,
          detail: `Formula R = ceil((${metrics.targetPct}*${focus.total} - 100*${focus.attended}) / (100 - ${metrics.targetPct})) = ${focus.mustAttend}.`
        });
      } else {
        blocks.push({
          title: `${focusLabel} Recovery Requirement`,
          highlight: "0 needed (already safe)",
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
          title: `${dayName} Schedule Check`,
          highlight: "Weekly Holiday",
          detail: `${dayName} is configured as a weekly holiday — 0 classes scheduled.`
        });
      } else if (daySubjects.length === 0) {
        blocks.push({
          title: `${dayName} Schedule Check`,
          highlight: "No classes scheduled",
          detail: `Your timetable has no classes listed on ${dayName}.`
        });
      } else {
        // Count repeated subjects on that same day so simultaneous bunks are accounted for!
        const dayCounts = {};
        daySubjects.forEach((s) => { dayCounts[s] = (dayCounts[s] || 0) + 1; });
        const lines = Object.entries(dayCounts).map(([sub, cnt]) => {
          const m = metrics.subjects.find((x) => x.subject === sub);
          if (!m || m.total === 0) return `${sub} (${cnt}x): no baseline data`;
          const sim = simulateWhatIf(m.attended, m.total, 0, cnt, metrics.targetPct);
          const safe = sim.percentage >= metrics.targetPct;
          return `${sub} (${cnt}x): ${safe ? "SAFE to skip" : "DO NOT SKIP"} -> ${formatPct(sim.percentage)}`;
        });
        blocks.push({
          title: `${dayName} Bunk Feasibility (${daySubjects.length} classes)`,
          highlight: lines.every((l) => l.includes("SAFE to skip")) ? "All classes safe to bunk" : "Caution on some subjects",
          detail: lines.join(" | ")
        });
      }
    }

    // 7. Semester Horizon Block
    if (intents.includes("SEMESTER_HORIZON")) {
      if (!metrics.horizonEnabled) {
        blocks.push({
          title: "Semester Horizon Projection",
          highlight: "End date not set",
          detail: "Set a Semester End Date in Setup & Timetable to calculate total remaining scheduled classes and full-semester bunk budget."
        });
      } else {
        const h = focus === ov ? ov.horizon : focus;
        const margin = focus === ov ? h.semesterMargin : focus.semesterMargin;
        const budget = focus === ov ? h.semesterBudget : focus.semesterBudget;
        const future = focus === ov ? h.futureClasses : focus.futureClasses;
        const maxPct = focus === ov ? h.maxAchievablePct : focus.maxAchievablePct;
        blocks.push({
          title: `${focusLabel} Semester-End Forecast`,
          highlight: margin >= 0 ? `${margin} semester bunks left` : `${Math.abs(margin)} short of target`,
          detail: `${future} upcoming classes scheduled. Full-semester bunk budget = ${budget} (burned ${focus.burned}). Max achievable = ${formatPct(maxPct)}.`
        });
      }
    }

    // 8. Per-Subject Breakdown Rows (always returned for multi-subject / explicit per-subject / summary / burned / can_bunk)
    const includeBreakdown =
      params.perSubjectExplicit ||
      !isSingleSubject ||
      intents.includes("SUMMARY") ||
      intents.includes("CAN_BUNK") ||
      intents.includes("BURNED") ||
      intents.includes("PERCENTAGE");

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

    return {
      query,
      intents,
      intentScores: scores,
      matchedSubjects: matchedNames,
      metrics,
      blocks,
      perSubjectRows
    };
  }

  function injectAiBoardStyles() {
    if (typeof document === "undefined" || getEl("bunksmart-ai-board-styles")) return;
    const style = document.createElement("style");
    style.id = "bunksmart-ai-board-styles";
    style.textContent = `
      .ai-board-card {
        margin-top: 1.5rem;
        padding: 1.25rem;
        border-radius: 16px;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(255, 255, 255, 0.88);
        color: #0f172a;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
      }
      html.dark .ai-board-card {
        background: rgba(15, 23, 42, 0.86);
        color: #f1f5f9;
        border-color: rgba(148, 163, 184, 0.2);
      }
      .ai-board-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .ai-board-title { font-size: 1.15rem; font-weight: 700; margin: 0; }
      .ai-board-subtitle { font-size: 0.82rem; opacity: 0.75; margin: 0.15rem 0 0; }
      .ai-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .ai-kpi-box {
        padding: 0.75rem 0.9rem;
        border-radius: 12px;
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid rgba(148, 163, 184, 0.18);
      }
      .ai-kpi-label { font-size: 0.75rem; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.04em; }
      .ai-kpi-value { font-size: 1.35rem; font-weight: 700; margin-top: 0.2rem; }
      .ai-kpi-sub { font-size: 0.75rem; opacity: 0.75; margin-top: 0.15rem; }
      .ai-chart-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      .ai-tab-btn {
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        border: 1px solid rgba(99, 102, 241, 0.35);
        background: transparent;
        color: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
      }
      .ai-tab-btn.active {
        background: #4f46e5;
        color: #ffffff;
        border-color: #4f46e5;
      }
      .ai-chart-wrap {
        width: 100%;
        overflow-x: auto;
        padding: 0.75rem;
        border-radius: 12px;
        background: rgba(148, 163, 184, 0.08);
        margin-bottom: 1rem;
      }
      .ai-table-wrap { overflow-x: auto; margin-bottom: 1rem; }
      .ai-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .ai-table th, .ai-table td {
        padding: 0.5rem 0.65rem;
        text-align: left;
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      }
      .ai-table th { font-weight: 600; opacity: 0.8; font-size: 0.78rem; text-transform: uppercase; }
      .ai-badge {
        display: inline-block;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .ai-badge-safe { background: rgba(16, 185, 129, 0.15); color: #059669; }
      .ai-badge-warning { background: rgba(245, 158, 11, 0.16); color: #d97706; }
      .ai-badge-danger { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
      .ai-badge-neutral { background: rgba(148, 163, 184, 0.2); color: #64748b; }
      html.dark .ai-badge-safe { color: #34d399; }
      html.dark .ai-badge-warning { color: #fbbf24; }
      html.dark .ai-badge-danger { color: #f87171; }
      html.dark .ai-badge-neutral { color: #94a3b8; }
      .ai-chip-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
      .ai-chip {
        padding: 0.3rem 0.65rem;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.3);
        background: rgba(148, 163, 184, 0.1);
        color: inherit;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .ai-chip:hover { border-color: #6366f1; }
      .ai-query-form { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
      .ai-query-input {
        flex: 1;
        padding: 0.55rem 0.8rem;
        border-radius: 10px;
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: transparent;
        color: inherit;
        font-size: 0.9rem;
      }
      .ai-query-btn {
        padding: 0.55rem 1rem;
        border-radius: 10px;
        border: none;
        background: #4f46e5;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      .ai-feed { display: flex; flex-direction: column; gap: 0.65rem; }
      .ai-msg {
        padding: 0.75rem 0.9rem;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(148, 163, 184, 0.08);
      }
      .ai-msg-q { font-weight: 600; font-size: 0.88rem; margin-bottom: 0.45rem; color: #4f46e5; }
      html.dark .ai-msg-q { color: #818cf8; }
      .ai-block-item { margin-top: 0.35rem; font-size: 0.86rem; line-height: 1.4; }
      .ai-formula-details { margin-top: 0.75rem; font-size: 0.82rem; opacity: 0.9; }
      .ai-formula-code {
        margin-top: 0.4rem;
        padding: 0.65rem;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.08);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.78rem;
        white-space: pre-wrap;
      }
      html.dark .ai-formula-code { background: rgba(0, 0, 0, 0.3); }
    `;
    document.head.appendChild(style);
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

  function resolveAiBoardHost() {
    if (typeof document === "undefined") return null;
    const explicit = getEl("ai-board-widget") || getEl("ai-chart-board") || getEl("view-ai-board");
    if (explicit) return explicit;

    let autoHost = getEl("ai-board-auto-host");
    if (!autoHost) {
      const parent = getEl("view-home") || document.querySelector("main") || document.body;
      if (!parent) return null;
      autoHost = document.createElement("section");
      autoHost.id = "ai-board-auto-host";
      parent.appendChild(autoHost);
    }
    return autoHost;
  }

  function renderAiBoard() {
    const host = resolveAiBoardHost();
    if (!host) return;
    injectAiBoardStyles();

    const metrics = computeAllMetrics(state);
    const ov = metrics.overall;

    if (aiBoardMessages.length === 0) {
      aiBoardMessages.push(
        runAlgorithmicBoardQuery("How many classes burned, how many can I bunk, what is my attendance percentage, and each subject?", state)
      );
    }

    const latestMessages = aiBoardMessages.slice(-4).reverse();
    const firstSub = metrics.subjects[0]?.subject || "Maths";
    const quickPrompts = [
      "How many classes have I burned?",
      "How many classes can I bunk?",
      "What is my attendance percentage?",
      "How many classes to bunk in each subject?",
      "Can I bunk today?",
      `What if I bunk 2 in ${firstSub}?`
    ];

    window.setAiBoardChartMode = function (mode) {
      aiBoardChartMode = mode === "counts" ? "counts" : "percentage";
      renderAiBoard();
    };

    window.askAiBoard = function (promptText) {
      const q = String(promptText || "").trim();
      if (!q) return;
      const result = runAlgorithmicBoardQuery(q, state);
      aiBoardMessages.push(result);
      renderAiBoard();
    };

    const tableRowsHtml =
      metrics.subjects.length === 0
        ? `<tr><td colspan="6">No subjects added yet.</td></tr>`
        : metrics.subjects
            .map(
              (s) => `
          <tr>
            <td><strong>${escapeHtml(s.subject)}</strong></td>
            <td>${s.attended}</td>
            <td>${s.burned}</td>
            <td>${s.total}</td>
            <td>${formatPct(s.percentage)}</td>
            <td><span class="ai-badge ai-badge-${s.status}">${escapeHtml(formatSubjectActionText(s))}</span></td>
          </tr>
        `
            )
            .join("");

    const feedHtml = latestMessages
      .map((msg) => {
        const blocksHtml = msg.blocks
          .map(
            (b) => `
          <div class="ai-block-item">
            <strong>${escapeHtml(b.title)}:</strong> <span>${escapeHtml(b.highlight)}</span>
            <div style="opacity:0.8;font-size:0.8rem;">${escapeHtml(b.detail)}</div>
          </div>
        `
          )
          .join("");

        const miniSubHtml =
          msg.perSubjectRows.length > 0
            ? `<div style="margin-top:0.45rem;font-size:0.8rem;opacity:0.9;">
                <strong>Per-Subject:</strong>
                ${msg.perSubjectRows
                  .map(
                    (r) =>
                      `${escapeHtml(r.subject)}: ${formatPct(r.percentage)} (Burned ${r.burned}, ${escapeHtml(r.actionText)})`
                  )
                  .join(" • ")}
              </div>`
            : "";

        return `
          <div class="ai-msg">
            <div class="ai-msg-q">Q: ${escapeHtml(msg.query)}</div>
            ${blocksHtml}
            ${miniSubHtml}
          </div>
        `;
      })
      .join("");

    host.innerHTML = `
      <div class="ai-board-card">
        <div class="ai-board-header">
          <div>
            <h2 class="ai-board-title">Algorithmic AI Chart &amp; Query Board</h2>
            <p class="ai-board-subtitle">100% deterministic math engine — zero external AI calls</p>
          </div>
          <div class="ai-chart-tabs">
            <button type="button" class="ai-tab-btn ${aiBoardChartMode === "percentage" ? "active" : ""}" onclick="setAiBoardChartMode('percentage')">Attendance % Chart</button>
            <button type="button" class="ai-tab-btn ${aiBoardChartMode === "counts" ? "active" : ""}" onclick="setAiBoardChartMode('counts')">Attended / Burned / Bunkable</button>
          </div>
        </div>

        <div class="ai-kpi-grid">
          <div class="ai-kpi-box">
            <div class="ai-kpi-label">Attendance %</div>
            <div class="ai-kpi-value">${formatPct(ov.percentage)}</div>
            <div class="ai-kpi-sub">${ov.attended} / ${ov.total} classes (Target ${metrics.targetPct}%)</div>
          </div>
          <div class="ai-kpi-box">
            <div class="ai-kpi-label">Classes Burned</div>
            <div class="ai-kpi-value">${ov.burned}</div>
            <div class="ai-kpi-sub">Total missed across ${metrics.subjects.length} subjects</div>
          </div>
          <div class="ai-kpi-box">
            <div class="ai-kpi-label">Overall Can Bunk</div>
            <div class="ai-kpi-value">${ov.canBunk}</div>
            <div class="ai-kpi-sub">${ov.mustAttend > 0 && Number.isFinite(ov.mustAttend) ? `Need next ${ov.mustAttend} in a row` : "Safe consecutive skips"}</div>
          </div>
          <div class="ai-kpi-box">
            <div class="ai-kpi-label">Subject Safe Sum</div>
            <div class="ai-kpi-value">${metrics.sumSubjectCanBunk}</div>
            <div class="ai-kpi-sub">Sum of per-subject safe skips</div>
          </div>
        </div>

        <div class="ai-chart-wrap">${buildAiChartSvg(metrics, aiBoardChartMode)}</div>

        <div class="ai-table-wrap">
          <table class="ai-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Attended (A)</th>
                <th>Burned (B)</th>
                <th>Total (T)</th>
                <th>Attendance %</th>
                <th>Bunk / Recovery Status</th>
              </tr>
            </thead>
            <tbody>${tableRowsHtml}</tbody>
          </table>
        </div>

        <div class="ai-chip-row">
          ${quickPrompts
            .map(
              (p) =>
                `<button type="button" class="ai-chip" onclick="askAiBoard('${escapeHtml(p).replace(/'/g, "\\'")}')">${escapeHtml(p)}</button>`
            )
            .join("")}
        </div>

        <form id="ai-board-form" class="ai-query-form">
          <input type="text" id="ai-board-input" class="ai-query-input" placeholder="Ask e.g. 'How many burned?', 'Can I bunk in Maths?', 'What if I bunk 2 in CS?'" aria-label="Ask the algorithmic AI board">
          <button type="submit" class="ai-query-btn">Compute</button>
        </form>

        <div class="ai-feed">${feedHtml}</div>

        <details class="ai-formula-details">
          <summary>Mathematical Form &amp; Algorithms Used</summary>
          <pre class="ai-formula-code">1. Burned Classes:        B_i = T_i - A_i
2. Attendance %:          P_i = (A_i / T_i) * 100
3. Safe Bunks (P_i >= t): S_i = floor((100 * A_i - t * T_i) / t)
4. Recovery   (P_i <  t): R_i = ceil((t * T_i - 100 * A_i) / (100 - t))
5. Overall Aggregation:   A_tot = sum(A_i), T_tot = sum(T_i), B_tot = T_tot - A_tot
6. Query Pipeline:        Normalize -> Levenshtein Subject Match -> Weighted Intent Scoring -> Exact Solver</pre>
        </details>
      </div>
    `;

    const form = getEl("ai-board-form");
    const input = getEl("ai-board-input");
    if (form && input) {
      form.onsubmit = (e) => {
        e.preventDefault();
        window.askAiBoard(input.value);
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
    runAlgorithmicBoardQuery
  };

  if (typeof window !== "undefined") {
    window.BunkSmartAlgorithms = publicApi;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }

  function renderAll() {
    renderHome();
    renderRollCallWidget();
    renderSettings();
    renderPredictor();
  }

  /* --- INIT --- */
  function init() {
    initTheme();
    initNav();
    initQuickAddSubject();
    renderAll();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
