import './style.css';
(function () {
  "use strict";

  const STORAGE_KEY = "bunksmart_pro_state_v4";
  const THEME_KEY = "bunksmart_theme";
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* --- STATE MANAGEMENT --- */
  function generateId() {
      return Math.random().toString(36).substr(2, 9);
  }

  function createNewClass(name) {
      return {
          id: generateId(),
          name: name,
          settings: { targetPercentage: 75, holidays: [0] },
          periodsConfig: [
              { id: 'P1', start: '9:00', end: '9:50' },
              { id: 'P2', start: '9:50', end: '10:40' },
              { id: 'B1', start: '10:40', end: '11:00', type: 'break', label: 'BREAK' },
              { id: 'P3', start: '11:00', end: '11:50' },
              { id: 'P4', start: '11:50', end: '12:40' },
              { id: 'B2', start: '12:40', end: '1:30', type: 'break', label: 'LUNCH BREAK' },
              { id: 'P5', start: '1:30', end: '2:25' },
              { id: 'P6', start: '2:25', end: '3:15' },
              { id: 'P7', start: '3:15', end: '4:15' }
          ],
          timetable: {
              Monday: { 'P1': 'OS', 'P2': 'DS', 'P3': 'JAVA', 'P4': 'PDS', 'P5': 'DDCO', 'P6': 'GIT LAB(A1)', 'P7': 'GIT LAB(A1)' },
              Tuesday: { 'P1': 'DDCO', 'P2': 'DS', 'P3': 'PDS', 'P4': 'OS', 'P5': 'GIT LAB(A2)', 'P6': 'GIT LAB(A2)', 'P7': 'TUTORIALS' },
              Wednesday: { 'P1': 'DS', 'P2': 'DDCO', 'P3': 'PDS', 'P4': 'JAVA', 'P5': 'SOCIETAL PROJECT', 'P6': 'SOCIETAL PROJECT', 'P7': 'SOCIETAL PROJECT' },
              Thursday: { 'P1': 'JAVA', 'P2': 'DS', 'P3': 'YOGA', 'P4': 'OS', 'P5': 'DS Lab(A2)/JAVA Lab(A1)', 'P6': 'DS Lab(A2)/JAVA Lab(A1)', 'P7': 'SOCIETAL PROJECT' },
              Friday: { 'P1': 'PDS', 'P2': 'OS', 'P3': 'DS Lab(A1)/JAVA Lab(A2)', 'P4': 'DS Lab(A1)/JAVA Lab(A2)', 'P5': 'DDCO', 'P6': 'JAVA', 'P7': 'TUTORIALS' },
              Saturday: { 'P1': 'JAVA', 'P2': 'PDS', 'P3': 'OS', 'P4': 'DS', 'P5': 'DIP MATHS', 'P6': 'DIP MATHS', 'P7': 'TUTORIALS' }
          },
          attendance: {},
          dailyMarks: {}
      };
  }

  function buildSampleState() {
      const cls = createNewClass("3rd Sem A (East West)");
      return {
          activeClassId: cls.id,
          classes: [cls]
      };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildSampleState();
      const parsed = JSON.parse(raw);
      if (!parsed.classes || parsed.classes.length === 0) return buildSampleState();
      return parsed;
    } catch (e) {
      return buildSampleState();
    }
  }

  function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  localStorage.removeItem('bunksmart_pro_state_v4'); let state = loadState();
  
  function getActiveClass() {
      return state.classes.find(c => c.id === state.activeClassId) || state.classes[0];
  }

  /* --- UI HELPERS --- */
  window.getEl = function(id) { return document.getElementById(id); };
  
  window.showToast = function(msg) {
    const el = getEl("toast");
    el.textContent = msg;
    el.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
    setTimeout(() => {
      el.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
    }, 2500);
  };

  window.closeModal = function(id) {
      const el = getEl(id);
      el.classList.add('opacity-0');
      setTimeout(() => el.classList.add('hidden'), 300);
  };

  window.openModal = function(id) {
      const el = getEl(id);
      el.classList.remove('hidden');
      // small delay to allow display:block to apply before animating opacity
      setTimeout(() => el.classList.remove('opacity-0'), 10);
  };

  /* --- THEME & SIDEBAR LOGIC --- */
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    if (isDark) {
      document.documentElement.classList.add('dark');
      getEl('theme-icon-light').classList.remove('hidden');
      getEl('theme-icon-dark').classList.add('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      getEl('theme-icon-dark').classList.remove('hidden');
      getEl('theme-icon-light').classList.add('hidden');
    }

    getEl('theme-toggle').addEventListener('click', () => {
      const isCurrentlyDark = document.documentElement.classList.contains('dark');
      if (isCurrentlyDark) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem(THEME_KEY, 'light');
        getEl('theme-icon-dark').classList.remove('hidden');
        getEl('theme-icon-light').classList.add('hidden');
      } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem(THEME_KEY, 'dark');
        getEl('theme-icon-light').classList.remove('hidden');
        getEl('theme-icon-dark').classList.add('hidden');
      }
    });
  }

  function initSidebar() {
    const sidebar = getEl('sidebar');
    const overlay = getEl('sidebar-overlay');
    const toggleBtn = getEl('menu-toggle');
    const closeBtn = getEl('sidebar-close');

    function openSidebar() {
      sidebar.classList.remove('-translate-x-full');
      overlay.classList.remove('hidden');
      setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    }

    function closeSidebar() {
      sidebar.classList.add('-translate-x-full');
      overlay.classList.add('opacity-0');
      setTimeout(() => overlay.classList.add('hidden'), 300);
    }

    toggleBtn.addEventListener('click', openSidebar);
    closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    window.toggleSubmenu = function(id) {
        const el = getEl(id);
        const icon = el.previousElementSibling.querySelector('svg');
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
        } else {
            el.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
        }
    };
  }

  /* --- MAIN DASHBOARD (CLASSES & GRID) --- */
  function renderClassSelector() {
      const sel = getEl('class-selector');
      sel.innerHTML = state.classes.map(c => `<option value="${c.id}" ${c.id === state.activeClassId ? 'selected' : ''}>${c.name}</option>`).join('');
      
      sel.onchange = (e) => {
          state.activeClassId = e.target.value;
          saveState(state);
          renderDashboardGrid();
      renderPortalModal();
      renderClassModal();
          renderSettings();
      };
  }

  window.addClass = () => {
      const name = prompt("Enter new class name:");
      if (name) {
          const newC = createNewClass(name);
          state.classes.push(newC);
          state.activeClassId = newC.id;
          saveState(state);
          renderClassSelector();
          renderDashboardGrid();
          renderSettings();
          showToast("Class added!");
      }
  };

  window.deleteClass = () => {
      if (state.classes.length <= 1) {
          alert("You must have at least one class.");
          return;
      }
      if (confirm("Are you sure you want to delete this class?")) {
          state.classes = state.classes.filter(c => c.id !== state.activeClassId);
          state.activeClassId = state.classes[0].id;
          saveState(state);
          renderClassSelector();
          renderDashboardGrid();
          renderSettings();
          showToast("Class deleted.");
      }
  };

  function renderDashboardGrid() {
        const cls = getActiveClass();
        const headerRow = getEl('grid-header');
        const body = getEl('grid-body');
  
        let daysWithSubjects = DAY_NAMES.filter(day => {
            const periods = cls.timetable[day] || {};
            return Object.values(periods).some(v => v && v.trim() !== "");
        });
        
        if (daysWithSubjects.length === 0) {
            daysWithSubjects = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        }
  
        let headHTML = `<th class="py-3 px-3 font-semibold border-r border-indigo-500 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/40 sticky left-0 z-10 w-20">Day</th>`;
        cls.periodsConfig.forEach(p => {
            if (p.type === 'break') {
                headHTML += `<th class="py-3 px-2 font-semibold border-r border-indigo-500 dark:border-indigo-800 last:border-0 bg-indigo-50 dark:bg-indigo-900/40 w-12 opacity-80 text-[10px] flex flex-col justify-center items-center h-full break-all" style="writing-mode: vertical-rl; transform: rotate(180deg); opacity: 0.7;">${p.label || 'BREAK'}</th>`;
            } else {
                headHTML += `<th class="py-3 px-2 font-semibold border-r border-indigo-500 dark:border-indigo-800 last:border-0 bg-indigo-50 dark:bg-indigo-900/40 text-[10px] w-28"><div class="flex flex-col"><span>${p.start} -</span><span>${p.end}</span></div></th>`;
            }
        });
        headerRow.innerHTML = headHTML;
  
        let bodyHTML = '';
        daysWithSubjects.forEach((dayName, rowIndex) => {
            const dayShort = dayName.substring(0, 3).toUpperCase();
            const periods = cls.timetable[dayName] || {};
            
            bodyHTML += `<tr class="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                <td class="py-4 px-3 font-bold text-indigo-700 dark:text-indigo-400 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-cardDark sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-sm">${dayShort}</td>`;
            
            cls.periodsConfig.forEach(p => {
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += `<td rowspan="${daysWithSubjects.length}" class="py-2 px-1 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 text-center font-bold tracking-[0.2em] text-gray-500 dark:text-gray-400 text-xs shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg); vertical-align: middle;">${p.label || 'BREAK'}</td>`;
                    }
                } else {
                    const subj = periods[p.id] || "";
                    if (subj) {
                        bodyHTML += `<td class="py-2 px-1 border-r border-gray-100 dark:border-gray-800 last:border-0 align-middle"><div class="mx-auto w-full h-full min-h-[3.5rem] p-1 flex items-center justify-center text-center rounded bg-indigo-100/50 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100 font-bold text-[10px] leading-tight whitespace-normal break-words shadow-sm border border-indigo-200/50 dark:border-indigo-800/50">${subj}</div></td>`;
                    } else {
                        bodyHTML += `<td class="py-2 px-1 border-r border-gray-100 dark:border-gray-800 last:border-0 text-center align-middle"><span class="text-gray-300 dark:text-gray-600 text-xs">-</span></td>`;
                    }
                }
            });
            bodyHTML += `</tr>`;
        });
  
        body.innerHTML = bodyHTML;
  }

  /* --- EDIT CLASS MODAL (GRID FORM ENTRY) --- */
  window.openEditClassModal = (tab = 'form') => {
      switchEditTab(tab);
      if (tab === 'form') renderEditGrid();
      openModal('edit-class-modal');
  };

  window.switchEditTab = (tab) => {
      document.querySelectorAll('.edit-tab').forEach(el => {
          el.classList.remove('active', 'text-indigo-600', 'border-indigo-600');
          el.classList.add('text-gray-500', 'border-transparent');
      });
      document.querySelectorAll('.edit-tab-content').forEach(el => el.classList.add('hidden'));
      
      const activeBtn = getEl(`tab-${tab}`);
      if(activeBtn) {
          activeBtn.classList.remove('text-gray-500', 'border-transparent');
          activeBtn.classList.add('active', 'text-indigo-600', 'border-indigo-600');
      }
      const activeContent = getEl(`content-${tab}`);
      if(activeContent) activeContent.classList.remove('hidden');
  };

  function renderEditGrid() {
        const cls = getActiveClass();
        const headerRow = getEl('edit-grid-header');
        const body = getEl('edit-grid-body');
  
        let headHTML = `<th class="py-3 px-3 font-semibold border-r border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 w-16">Day</th>`;
        cls.periodsConfig.forEach(p => {
            headHTML += `<th class="py-3 px-2 font-semibold border-r border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 last:border-0 min-w-[80px]">${p.id}</th>`;
        });
        headerRow.innerHTML = headHTML;
  
        let bodyHTML = '';
        const displayDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        
        displayDays.forEach((dayName, rowIndex) => {
            const dayShort = dayName.substring(0, 3).toUpperCase();
            const periods = cls.timetable[dayName] || {};
            
            bodyHTML += `<tr>
                <td class="py-3 px-3 font-bold text-gray-700 dark:text-gray-300 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-cardDark">${dayShort}</td>`;
            
            cls.periodsConfig.forEach(p => {
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += `<td rowspan="6" class="p-2 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center font-bold tracking-[0.2em] text-gray-400 text-xs shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg);">${p.label || 'BREAK'}</td>`;
                    }
                } else {
                    const subj = periods[p.id] || "";
                    const hasValClass = subj ? 'has-val' : '';
                    
                    bodyHTML += `
                    <td class="p-1 border-r border-gray-100 dark:border-gray-800 last:border-0">
                        <input type="text" 
                               value="${subj}" 
                               placeholder="Free"
                               onchange="updateGridData('${dayName}', '${p.id}', this.value)"
                               class="grid-input text-[10px] p-2 text-center w-full bg-transparent border border-transparent rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${hasValClass}">
                    </td>`;
                }
            });
            bodyHTML += `</tr>`;
        });
        body.innerHTML = bodyHTML;
    }

  window.updateGridData = (dayName, periodId, value) => {
      const cls = getActiveClass();
      if (!cls.timetable[dayName]) cls.timetable[dayName] = {};
      cls.timetable[dayName][periodId] = value.trim();
      
      // Trigger re-render of just this input visually
      renderEditGrid(); 
  };

  /* --- APPLY SCOPE MODAL --- */
  window.openApplyScopeModal = () => {
      closeModal('edit-class-modal');
      setTimeout(() => {
          openModal('apply-scope-modal');
      }, 300);
  };

  window.confirmSaveTimetable = () => {
      saveState(state);
      closeModal('apply-scope-modal');
      renderDashboardGrid();
      showToast("Timetable Applied Successfully! 🚀");
  };

  /* --- CONFIGURE PERIOD TIMES MODAL --- */
  window.openConfigurePeriodsModal = () => {
      renderPeriodTimesEditor();
      openModal('configure-periods-modal');
  };

  function renderPeriodTimesEditor() {
      const cls = getActiveClass();
      const container = getEl('period-times-container');
      
      let html = cls.periodsConfig.map((p, idx) => `
          <div class="flex gap-2 items-center bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <input type="text" value="${p.id}" onchange="updatePeriodConfig(${idx}, 'id', this.value)" class="w-16 form-input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-sm font-bold text-gray-800 dark:text-white">
              <input type="time" value="${p.start}" onchange="updatePeriodConfig(${idx}, 'start', this.value)" class="flex-1 form-input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-sm text-gray-800 dark:text-white">
              <span class="text-gray-400">-</span>
              <input type="time" value="${p.end}" onchange="updatePeriodConfig(${idx}, 'end', this.value)" class="flex-1 form-input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-sm text-gray-800 dark:text-white">
              <button onclick="removePeriodConfig(${idx})" class="p-2 text-gray-400 hover:text-rose-500"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
      `).join('');
      
      container.innerHTML = html;
  }

  window.updatePeriodConfig = (idx, field, val) => {
      const cls = getActiveClass();
      cls.periodsConfig[idx][field] = val;
  };

  window.addNewPeriodConfig = () => {
      const cls = getActiveClass();
      const num = cls.periodsConfig.length + 1;
      cls.periodsConfig.push({ id: `P${num}`, start: "", end: "" });
      renderPeriodTimesEditor();
  };

  window.removePeriodConfig = (idx) => {
      const cls = getActiveClass();
      cls.periodsConfig.splice(idx, 1);
      renderPeriodTimesEditor();
  };

  window.savePeriodTimes = () => {
      saveState(state);
      closeModal('configure-periods-modal');
      renderDashboardGrid();
      showToast("Period times saved!");
  };

  /* --- JSON IMPORT --- */
  window.copyAiPrompt = () => {
      const prompt = `Convert my timetable screenshot into this JSON format for BunkSmart. Return ONLY JSON. Format: { "Your Class Name": { "lastDate": "2026-10-06", "holidays": [0, 6], "subjects": { "Monday": {"P1":"Maths", "P2":"Physics"}, "Tuesday": {"P1":"Chem"} } } }`;
      navigator.clipboard.writeText(prompt).then(() => {
          showToast("Prompt copied! Paste it into Gemini.");
      });
  };

  window.importJsonData = () => {
      const jsonStr = getEl('json-input-area').value;
      try {
          const parsed = JSON.parse(jsonStr);
          // Very basic ingestion for demonstration
          const className = Object.keys(parsed)[0];
          const data = parsed[className];
          
          let targetCls = state.classes.find(c => c.name === className);
          if (!targetCls) {
              targetCls = createNewClass(className);
              state.classes.push(targetCls);
          }
          
          if(data.holidays) targetCls.settings.holidays = data.holidays;
          if(data.subjects) targetCls.timetable = data.subjects;
          
          state.activeClassId = targetCls.id;
          saveState(state);
          
          closeModal('edit-class-modal');
          renderClassSelector();
          renderDashboardGrid();
          showToast("JSON Imported Successfully!");
      } catch (e) {
          showToast("Invalid JSON format.");
      }
  };

  /* --- SETTINGS SECTION --- */
  
  function renderPortalModal() {
      const cls = getActiveClass();
      const container = getEl('portal-subjects-container');
      if (!container) return;
      
      const uniqueSubjects = new Set();
      Object.values(cls.timetable).forEach(day => {
          Object.values(day).forEach(subj => {
              if (subj && subj.trim() !== '') uniqueSubjects.add(subj);
          });
      });
      
      let html = '';
      Array.from(uniqueSubjects).sort().forEach(subj => {
          html += `<div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 mb-3">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-bold text-gray-800 dark:text-white text-sm">${subj}</h4>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Total Held</label>
                <input type="number" value="0" class="w-full form-input rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-bold dark:text-white text-center">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Attended</label>
                <input type="number" value="0" class="w-full form-input rounded-lg bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-bold dark:text-white text-center">
              </div>
            </div>
          </div>`;
      });
      container.innerHTML = html;
  }

  function renderClassModal() {
      const cls = getActiveClass();
      const nameInput = getEl('class-name-input');
      const periodsInput = getEl('class-periods-input');
      
      if (nameInput) nameInput.value = cls.name;
      if (periodsInput) {
          // Count non-break periods
          const numPeriods = cls.periodsConfig.filter(p => p.type !== 'break').length;
          periodsInput.value = numPeriods;
      }
  }

  function renderSettings() {
      const cls = getActiveClass();
      getEl('target-display').textContent = cls.settings.targetPercentage + '%';
      getEl('target-slider').value = cls.settings.targetPercentage;
      
      getEl('check-sat').checked = cls.settings.holidays.includes(6);
      getEl('check-sun').checked = cls.settings.holidays.includes(0);
      
      getEl('target-slider').onchange = (e) => {
          cls.settings.targetPercentage = Number(e.target.value);
          saveState(state);
          getEl('target-display').textContent = cls.settings.targetPercentage + '%';
      };
      
      const updateHol = () => {
          let h = [];
          if(getEl('check-sun').checked) h.push(0);
          if(getEl('check-sat').checked) h.push(6);
          cls.settings.holidays = h;
          saveState(state);
      };
      
      getEl('check-sat').onchange = updateHol;
      getEl('check-sun').onchange = updateHol;
  }

  /* --- INIT --- */
  function init() {
    initTheme();
    initSidebar();
    renderClassSelector();
    renderDashboardGrid();
    renderSettings();
  }

  document.addEventListener('DOMContentLoaded', init);
})();


window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); };

window.addClass = function() { alert('Add Class Coming Soon'); }; window.deleteClass = function() { alert('Delete Class Coming Soon'); };



