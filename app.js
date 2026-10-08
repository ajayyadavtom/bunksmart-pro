window.onerror = function(msg, url, line, col, error) {
   alert("JS Error: " + msg + "\nLine: " + line);
};
(function () {
  "use strict";

  const STORAGE_KEY = "bunksmart_pro_state_v5";
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
      const sems = ["1st SEM", "2nd SEM", "3rd SEM", "4th SEM", "5th SEM", "6th SEM", "7th SEM", "8th SEM"];
      const classes = sems.map(name => createNewClass(name));
      return {
          activeClassId: classes[0].id,
          classes: classes
      };
  }

  function loadState() {
    try {
      const raw = null;
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

  let state = loadState();
  
  function getActiveClass() {
      return state.classes.find(c => c.id === state.activeClassId) || state.classes[0];
  }

  /* --- UI HELPERS --- */
  window.getEl = function(id) { return document.getElementById(id); };
  
  window.showToast = function(msg) {
    const el = getEl("toast");
    getEl("toast-msg").textContent = msg;
    el.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
    setTimeout(() => {
      el.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
    }, 2500);
  };

  window.closeModal = function(id) {
      const el = getEl(id);
      el.classList.add('opacity-0');
      
      // Animate inner content
      const inner = el.querySelector('.transform');
      if (inner) {
          inner.classList.remove('translate-y-0', 'sm:scale-100');
          inner.classList.add('translate-y-full', 'sm:scale-95');
      }
      
      setTimeout(() => el.classList.add('hidden'), 300);
  };

  window.openModal = function(id) {
      const el = getEl(id);
      el.classList.remove('hidden');
      
      const inner = el.querySelector('.transform');
      // small delay to allow display:block to apply before animating
      setTimeout(() => {
          el.classList.remove('opacity-0');
          if (inner) {
              inner.classList.remove('translate-y-full', 'sm:scale-95');
              inner.classList.add('translate-y-0', 'sm:scale-100');
          }
      }, 10);
  };

  /* --- MOCK HANDLERS --- */
  function initMocks() {
      const fileInput = getEl('hidden-file-input');
      if(fileInput) {
          fileInput.addEventListener('change', (e) => {
              if(e.target.files.length > 0) {
                  showToast(`Processing ${e.target.files.length} screenshot(s)... (Mock AI processing)`);
                  setTimeout(() => {
                      showToast("AI successfully extracted attendance logs!");
                      e.target.value = ""; // Reset
                  }, 2000);
              }
          });
      }

      // Mock sidebar clicks
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
          if(!el.hasAttribute('onclick')) {
              el.onclick = (e) => {
                  e.preventDefault();
                  showToast("This feature is coming soon!");
              }
          }
      });
  }

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
      const name = prompt("Enter new class/semester name (e.g. 9th SEM):");
      if (name) {
          const newC = createNewClass(name);
          state.classes.push(newC);
          state.activeClassId = newC.id;
          saveState(state);
          renderClassSelector();
          renderDashboardGrid();
          renderSettings();
          showToast("Class added successfully!");
      }
  };

  window.deleteClass = () => {
      if (state.classes.length <= 1) {
          showToast("You must have at least one class.");
          return;
      }
      if (confirm("Are you sure you want to delete this entire semester's data?")) {
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
            return Object.values(periods).some(v => v && typeof v === "string" && v.trim() !== "");
        });
        
        if (daysWithSubjects.length === 0) {
            daysWithSubjects = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        }
  
        let headHTML = `<th class="py-4 px-3 font-bold text-gray-500 dark:text-gray-400 sticky left-0 z-20 w-20 bg-white dark:bg-brand-cardDark border-b-2 border-gray-100 dark:border-gray-800 text-left">DAY</th>`;
        
        cls.periodsConfig.forEach(p => {
            if (p.type === 'break') {
                headHTML += `<th class="py-4 px-2 font-bold text-gray-400 dark:text-gray-500 text-[10px] w-8 uppercase tracking-widest border-b-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-cardDark"></th>`;
            } else {
                headHTML += `<th class="py-4 px-2 font-bold text-gray-600 dark:text-gray-300 text-[11px] w-28 whitespace-nowrap border-b-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-cardDark"><div class="flex flex-col items-center justify-center"><span>${p.start}</span><span class="text-[9px] text-gray-400 font-medium">${p.end}</span></div></th>`;
            }
        });
        headerRow.innerHTML = headHTML;
  
        let bodyHTML = '';
        daysWithSubjects.forEach((dayName, rowIndex) => {
            const dayShort = dayName.substring(0, 3).toUpperCase();
            const periods = cls.timetable[dayName] || {};
            
            bodyHTML += `<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                <td class="py-3 px-3 font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-brand-cardDark sticky left-0 z-10 text-sm text-left">${dayShort}</td>`;
            let i = 0;
            while (i < cls.periodsConfig.length) {
                const p = cls.periodsConfig[i];
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += `<td rowspan="${daysWithSubjects.length}" class="py-2 px-1 bg-gray-50/50 dark:bg-gray-800/30 text-center font-bold tracking-[0.4em] text-gray-300 dark:text-gray-600 text-xs uppercase rounded-xl border border-gray-100 dark:border-gray-800/50 shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg); vertical-align: middle;">${p.label || 'BREAK'}</td>`;
                    }
                    i++;
                } else {
                    const subj = (periods[p.id] || "").trim();
                    let colspan = 1;
                    
                    if (subj) {
                        let j = i + 1;
                        while (j < cls.periodsConfig.length) {
                            const nextP = cls.periodsConfig[j];
                            if (nextP.type === 'break') break;
                            const nextSubj = (periods[nextP.id] || "").trim();
                            if (nextSubj === subj) {
                                colspan++;
                                j++;
                            } else {
                                break;
                            }
                        }
                    }
                    
                    if (subj) {
                        bodyHTML += `<td colspan="${colspan}" class="py-1.5 px-1.5 align-middle"><div class="mx-auto w-full h-full min-h-[3.5rem] p-2 flex items-center justify-center text-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] leading-tight whitespace-normal break-words shadow-[0_2px_10px_-4px_rgba(99,102,241,0.2)] border border-indigo-100/50 dark:border-indigo-800/30 px-4">${subj}</div></td>`;
                    } else {
                        bodyHTML += `<td class="py-1.5 px-1.5 text-center align-middle"><span class="text-gray-200 dark:text-gray-700 text-lg font-light">-</span></td>`;
                    }
                    
                    i += colspan;
                }
            }
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
          el.classList.remove('active', 'text-indigo-600', 'border-indigo-600', 'bg-indigo-50/50', 'dark:bg-indigo-900/10');
          el.classList.add('text-gray-500', 'border-transparent');
      });
      document.querySelectorAll('.edit-tab-content').forEach(el => el.classList.add('hidden'));
      
      const activeBtn = getEl(`tab-${tab}`);
      if(activeBtn) {
          activeBtn.classList.remove('text-gray-500', 'border-transparent');
          activeBtn.classList.add('active', 'text-indigo-600', 'border-indigo-600', 'bg-indigo-50/50', 'dark:bg-indigo-900/10');
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
                    const hasValClass = subj ? 'has-val bg-indigo-50 dark:bg-indigo-900/20' : '';
                    
                    bodyHTML += `
                    <td class="p-1 border-r border-gray-100 dark:border-gray-800 last:border-0 min-w-[80px]">
                        <input type="text" 
                               value="${subj}" 
                               placeholder="Free"
                               onchange="updateGridData('${dayName}', '${p.id}', this.value)"
                               class="grid-input text-[11px] font-semibold p-2 text-center w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-colors ${hasValClass}">
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
      showToast("Timetable Saved & Applied Successfully! 🚀");
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
          <div class="flex gap-2 items-center bg-gray-50 dark:bg-gray-800/80 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-transform hover:scale-[1.01]">
              <input type="text" value="${p.id}" onchange="updatePeriodConfig(${idx}, 'id', this.value)" class="w-16 form-input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-sm font-bold text-gray-800 dark:text-white" placeholder="ID">
              <input type="time" value="${p.start}" onchange="updatePeriodConfig(${idx}, 'start', this.value)" class="flex-1 form-input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-sm font-medium text-gray-800 dark:text-white">
              <span class="text-gray-400 font-bold">-</span>
              <input type="time" value="${p.end}" onchange="updatePeriodConfig(${idx}, 'end', this.value)" class="flex-1 form-input bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 rounded-lg px-2 py-2 text-center text-sm font-medium text-gray-800 dark:text-white">
              <button onclick="removePeriodConfig(${idx})" class="p-2 text-gray-400 hover:text-rose-500 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
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
          showToast("JSON Imported Successfully! ✨");
      } catch (e) {
          showToast("Invalid JSON format. Check AI output.");
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

  /* --- MANUAL ROLL CALL (ATTENDANCE) --- */
  window.openManualEntry = () => {
      activeRollCallDate = isoDate(new Date());
      renderRollCallWidget();
      openModal('manual-rollcall-modal');
  };

  function isoDate(d) { return d.toISOString().split('T')[0]; }

  function markClass(dateKey, periodId, newSubject, status) {
    if (!newSubject) return;
    const cls = getActiveClass();
    cls.dailyMarks[dateKey] = cls.dailyMarks[dateKey] || {};
    
    // Find if period was already marked
    let oldKey = Object.keys(cls.dailyMarks[dateKey]).find(k => k.startsWith(periodId + "#") && k !== "isHoliday");
    if (oldKey) {
      const oldSubject = oldKey.split('#').slice(1).join('#');
      const oldStatus = cls.dailyMarks[dateKey][oldKey];
      if (cls.attendance[oldSubject]) {
        if (oldStatus === "attended") { cls.attendance[oldSubject].attended -= 1; cls.attendance[oldSubject].total -= 1; }
        if (oldStatus === "bunked") { cls.attendance[oldSubject].total -= 1; }
      }
      delete cls.dailyMarks[dateKey][oldKey];
    }

    if (!cls.attendance[newSubject]) cls.attendance[newSubject] = { attended: 0, total: 0, history: [] };
    const rec = cls.attendance[newSubject];

    if (status === "attended") { rec.attended += 1; rec.total += 1; }
    if (status === "bunked") { rec.total += 1; }

    cls.dailyMarks[dateKey][`${periodId}#${newSubject}`] = status;
    saveState(state);
    renderRollCallWidget();
  }

  window.toggleDayHoliday = () => {
    const cls = getActiveClass();
    const dateKey = activeRollCallDate;
    cls.dailyMarks[dateKey] = cls.dailyMarks[dateKey] || {};
    
    if (!cls.dailyMarks[dateKey].isHoliday) {
      // Revert marks for today
      Object.keys(cls.dailyMarks[dateKey]).forEach(k => {
        if (k !== 'isHoliday') {
          const oldSubject = k.split('#').slice(1).join('#');
          const oldStatus = cls.dailyMarks[dateKey][k];
          if (cls.attendance[oldSubject]) {
             if (oldStatus === "attended") { cls.attendance[oldSubject].attended -= 1; cls.attendance[oldSubject].total -= 1; }
             if (oldStatus === "bunked") { cls.attendance[oldSubject].total -= 1; }
          }
          delete cls.dailyMarks[dateKey][k];
        }
      });
      cls.dailyMarks[dateKey].isHoliday = true;
    } else {
      cls.dailyMarks[dateKey].isHoliday = false;
    }
    saveState(state);
    renderRollCallWidget();
  };

  let activeRollCallDate = isoDate(new Date());

function renderRollCallWidget(targetDateStr) {
    if (targetDateStr) activeRollCallDate = targetDateStr;
    const targetDateObj = new Date(activeRollCallDate);

    const cls = getActiveClass();
    const host = getEl("rollcall-widget-content");
    const dayIndex = targetDateObj.getDay();
    const dayName = DAY_NAMES[dayIndex];
    const dateKey = activeRollCallDate;

    if (cls.settings.holidays.includes(dayIndex)) {
      host.innerHTML = `<div class="text-center p-6"><div class="text-5xl mb-3">🎉</div><h3 class="text-xl font-bold dark:text-white">Weekly Holiday</h3><p class="text-gray-500 mt-2">Enjoy your day off!</p></div>`;
      return;
    }

    const periodsForToday = cls.timetable[dayName] || {};
    const validPeriods = cls.periodsConfig.filter(p => periodsForToday[p.id] && periodsForToday[p.id].trim() !== "");

    if (validPeriods.length === 0) {
      host.innerHTML = `<div class="text-center p-6"><h3 class="text-lg font-bold text-gray-500">No classes scheduled for today.</h3><button onclick="openEditClassModal('form')" class="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-bold">Edit Timetable</button></div>`;
      return;
    }

    const marksToday = cls.dailyMarks[dateKey] || {};
    
    if (marksToday.isHoliday) {
      host.innerHTML = `
        <div class="text-center p-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div class="text-5xl mb-4">🌴</div>
          <h3 class="text-xl font-bold dark:text-white mb-6">Today is marked as a Holiday</h3>
          <button onclick="toggleDayHoliday()" class="px-6 py-3 bg-white dark:bg-gray-700 shadow-md border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 hover:-translate-y-0.5 transition-transform">Undo Holiday</button>
        </div>
      `;
      return;
    }
    
    window.handleMarkDirect = (periodId, stat) => {
      const subj = getEl(`rc-sub-${periodId}`).value;
      if (subj) markClass(dateKey, periodId, subj, stat);
    };

    let html = `
      <div class="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div>
            <h3 class="font-bold text-lg text-gray-800 dark:text-gray-200">${targetDateObj.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'})}</h3>
        </div>
        <button onclick="toggleDayHoliday()" class="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-900 px-4 py-2 rounded-xl hover:bg-rose-100 transition-colors">Mark Holiday</button>
      </div>
    `;

    html += validPeriods.map((p) => {
      const periodId = p.id;
      const defaultSubject = periodsForToday[periodId];
      const existingKey = Object.keys(marksToday).find(k => k.startsWith(periodId + "#") && k !== "isHoliday");
      const currentSubject = existingKey ? existingKey.split('#').slice(1).join('#') : defaultSubject;
      const chosen = existingKey ? marksToday[existingKey] : null;
      
      const timeStr = (p.start && p.end) ? `${p.start} - ${p.end}` : '';

      const btn = (status, clsStr, label) => `
        <button onclick="handleMarkDirect('${periodId}', '${status}')" 
          class="flex-1 py-3 rounded-xl text-sm font-bold transition-all ${clsStr} ${chosen === status ? 'ring-2 ring-offset-2 ring-indigo-500 shadow-md scale-[1.02]' : 'opacity-70 hover:opacity-100 hover:-translate-y-0.5'}">
          ${label}
        </button>
      `;

      return `
        <div class="mb-5 p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex justify-between items-center mb-4">
            <span class="text-sm font-bold px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 rounded-lg">${periodId}</span>
            <span class="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded-md border border-gray-100 dark:border-gray-700">${timeStr}</span>
          </div>
          <input type="text" id="rc-sub-${periodId}" class="w-full form-input rounded-xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-600 px-4 py-3 text-base font-bold text-gray-800 dark:text-white mb-5 shadow-inner" value="${currentSubject}">
                    <div class="grid grid-cols-2 gap-3">
            ${btn('attended', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50', 'Attended')}
            ${btn('bunked', 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50', 'Bunked')}
            ${btn('holiday', 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600', 'Cancelled')}
            ${btn('changed', 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50', 'Subj / Teacher Changed')}
          </div>
        </div>
      `;
    }).join("");
    
    host.innerHTML = html;
  }


  
  /* --- CALENDAR HISTORY --- */
  let currentCalendarDate = new Date();
  
  window.openCalendarModal = () => {
      renderCalendar();
      openModal('calendar-modal');
      closeSidebar();
  };

  window.changeCalendarMonth = (offset) => {
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + offset);
      renderCalendar();
  };

  function renderCalendar() {
      const year = currentCalendarDate.getFullYear();
      const month = currentCalendarDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const displayEl = getEl('calendar-month-display');
      if (displayEl) displayEl.textContent = `${monthNames[month]} ${year}`;
      
      const grid = getEl('calendar-grid');
      if (!grid) return;
      
      let html = '';
      const cls = getActiveClass();
      
      for (let i = 0; i < firstDay; i++) {
          html += `<div class="aspect-square bg-transparent"></div>`;
      }
      
      const today = new Date();
      for (let d = 1; d <= daysInMonth; d++) {
          const dateObj = new Date(year, month, d);
          
          // Note: isoDate returns YYYY-MM-DD in local time if we adjust for timezone offset
          const tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
          const localISOTime = (new Date(dateObj - tzoffset)).toISOString().slice(0, -1);
          const dateStr = localISOTime.split('T')[0];
          
          const marks = cls.dailyMarks[dateStr] || {};
          let attended = 0;
          let bunked = 0;
          
          if (!marks.isHoliday) {
              Object.keys(marks).forEach(k => {
                  if (k !== 'isHoliday') {
                      if (marks[k] === 'attended') attended++;
                      if (marks[k] === 'bunked') bunked++;
                  }
              });
          }
          
          const isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
          const isHoliday = marks.isHoliday;
          
          let indicatorHtml = '';
          let bgClass = "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600";
          
          if (isHoliday) {
              bgClass = "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
              indicatorHtml = `<div class="text-[8px] font-bold text-orange-400 uppercase mt-0.5">Holiday</div>`;
          } else if (attended > 0 || bunked > 0) {
              bgClass = "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800";
              indicatorHtml = `
                <div class="flex gap-1 justify-center mt-1">
                  ${attended > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm"></span>` : ''}
                  ${bunked > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-sm"></span>` : ''}
                </div>
              `;
          }
          
          if (isToday) {
              bgClass += " ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-gray-900";
          }
          
          html += `
          <div onclick="selectCalendarDate('${dateStr}')" class="aspect-square flex flex-col items-center justify-center rounded-xl border cursor-pointer transition-all ${bgClass}">
              <span class="text-sm font-bold ${isHoliday ? 'text-orange-500' : 'text-gray-700 dark:text-gray-200'}">${d}</span>
              ${indicatorHtml}
          </div>
          `;
      }
      grid.innerHTML = html;
  }

  window.selectCalendarDate = (dateStr) => {
      const cls = getActiveClass();
      const marks = cls.dailyMarks[dateStr] || {};
      const displayTitle = getEl('cal-selected-date');
      const details = getEl('cal-details-content');
      
      const parts = dateStr.split('-');
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
      displayTitle.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      
      if (marks.isHoliday) {
          details.innerHTML = `<div class="p-6 text-center bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800"><span class="text-4xl mb-3 block">???</span><h4 class="font-bold text-orange-700 dark:text-orange-400">Marked as Holiday</h4></div>`;
          return;
      }
      
              let attendedHTML = '';
        let bunkedHTML = '';
        let otherHTML = '';
        let totalAttended = 0;
        let totalBunked = 0;
        let totalOther = 0;
        
        Object.keys(marks).forEach(k => {
            if (k !== 'isHoliday') {
                const subj = k.split('#').slice(1).join('#');
                const status = marks[k];
                if (status === 'attended') {
                    totalAttended++;
                    attendedHTML += `<div class="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-bold flex justify-between items-center shadow-sm border border-emerald-100 dark:border-emerald-800"><span class="truncate pr-2">${subj}</span> <span class="shrink-0 bg-emerald-100 dark:bg-emerald-800/50 px-2 py-1 rounded-md text-xs border border-emerald-200 dark:border-emerald-700">Attended</span></div>`;
                } else if (status === 'bunked') {
                    totalBunked++;
                    bunkedHTML += `<div class="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 rounded-lg text-sm font-bold flex justify-between items-center shadow-sm border border-rose-100 dark:border-rose-800"><span class="truncate pr-2">${subj}</span> <span class="shrink-0 bg-rose-100 dark:bg-rose-800/50 px-2 py-1 rounded-md text-xs border border-rose-200 dark:border-rose-700">Bunked</span></div>`;
                } else if (status === 'holiday') {
                    totalOther++;
                    otherHTML += `<div class="p-3 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-bold flex justify-between items-center shadow-sm border border-gray-200 dark:border-gray-700"><span class="truncate pr-2">${subj}</span> <span class="shrink-0 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-md text-xs border border-gray-300 dark:border-gray-600">Cancelled</span></div>`;
                } else if (status === 'changed') {
                    totalOther++;
                    otherHTML += `<div class="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold flex justify-between items-center shadow-sm border border-amber-100 dark:border-amber-800"><span class="truncate pr-2">${subj}</span> <span class="shrink-0 bg-amber-100 dark:bg-amber-800/50 px-2 py-1 rounded-md text-xs border border-amber-200 dark:border-amber-700">Subj Changed</span></div>`;
                }
            }
        });
        
        if (totalAttended === 0 && totalBunked === 0 && totalOther === 0) {
          details.innerHTML = `<div class="text-center p-6 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 mt-2 mb-4">No attendance records found for this day.</div><button onclick="editPastAttendance('${dateStr}')" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">Add Attendance for this Day</button>`;
          return;
      }
      
      details.innerHTML = `
        <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="p-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-center border border-emerald-200 dark:border-emerald-800 shadow-sm">
                <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400">${totalAttended}</div>
                <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mt-1">Attended</div>
            </div>
            <div class="p-4 bg-rose-100 dark:bg-rose-900/30 rounded-xl text-center border border-rose-200 dark:border-rose-800 shadow-sm">
                <div class="text-2xl font-black text-rose-600 dark:text-rose-400">${totalBunked}</div>
                <div class="text-[10px] font-bold text-rose-600 dark:text-rose-500 uppercase tracking-widest mt-1">Bunked</div>
            </div>
        </div>
        <button onclick="editPastAttendance('${dateStr}')" class="w-full mt-2 mb-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit this Day's Attendance</button>
          <div class="space-y-2">
              ${attendedHTML ? '<h4 class="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2 mt-4 ml-1">Attended Classes</h4>' + attendedHTML : ''}
              ${bunkedHTML ? '<h4 class="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2 mt-4 ml-1">Bunked Classes</h4>' + bunkedHTML : ''}
              ${otherHTML ? '<h4 class="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2 mt-4 ml-1">Other (Neutral)</h4>' + otherHTML : ''}
          </div>
      `;
  };

  
  window.editPastAttendance = (dateStr) => {
      closeModal('calendar-modal');
      renderRollCallWidget(dateStr);
      openModal('manual-rollcall-modal');
  };
  /* --- INIT --- */
  function init() {
    initTheme();
    initSidebar();
    initMocks();
    renderClassSelector();
    renderDashboardGrid();
    renderSettings();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.resetCurrentClass = () => {
      if(confirm("Are you sure you want to completely erase everything and reset to default?")) {
          localStorage.removeItem('bunksmart_pro_state_v5');
          window.location.reload();
      }
  };


  /* --- ANALYTICS GRAPH MODAL --- */
  window.openAnalyticsModal = () => {
      renderAnalytics();
      closeSidebar(); // Ensure sidebar closes on mobile
      openModal('analytics-modal');
  };

  function renderAnalytics() {
      const cls = getActiveClass();
      const container = getEl('analytics-content');
      
      // Calculate Stats
      const subjStats = {};
      
      // Initialize subjStats with all unique subjects from the timetable
      Object.values(cls.timetable || {}).forEach(day => {
          Object.values(day).forEach(subj => {
              const s = subj.trim();
              if(s && !subjStats[s]) {
                  subjStats[s] = { attended: 0, bunked: 0, total: 0 };
              }
          });
      });

      // Populate from history
      const historyKeys = Object.keys(cls.attendanceHistory || {});
      let hasData = false;

      historyKeys.forEach(dateStr => {
          const marks = cls.attendanceHistory[dateStr];
          Object.keys(marks).forEach(periodId => {
              const status = marks[periodId].status || marks[periodId];
              // Try to find the subject from the timetable for that day, or just skip if it was changed
              const dateObj = new Date(dateStr);
              const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              const dayName = dayNames[dateObj.getDay()];
              
              let subj = (cls.timetable[dayName] && cls.timetable[dayName][periodId]) ? cls.timetable[dayName][periodId].trim() : "Unknown";
              
              if(subj && subj !== "Unknown" && subjStats[subj]) {
                  if (status === 'attended') {
                      subjStats[subj].attended++;
                      subjStats[subj].total++;
                      hasData = true;
                  } else if (status === 'bunked') {
                      subjStats[subj].bunked++;
                      subjStats[subj].total++;
                      hasData = true;
                  }
              }
          });
      });

      if (!hasData) {
          container.innerHTML = `
              <div class="flex flex-col items-center justify-center py-12 text-center">
                  <div class="text-6xl mb-4 opacity-50">📊</div>
                  <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300">No Data Yet</h3>
                  <p class="text-sm text-gray-500 max-w-xs mt-2">Start tracking your attendance in the Roll Call tab to see your analytics graph here!</p>
              </div>
          `;
          return;
      }

      let totalAttended = 0;
      let totalBunked = 0;
      
      let barsHTML = '';
      
      Object.entries(subjStats).forEach(([subj, data]) => {
          if(data.total === 0) return;
          
          totalAttended += data.attended;
          totalBunked += data.bunked;
          
          const percentage = Math.round((data.attended / data.total) * 100);
          
          let colorClass = 'bg-emerald-500';
          let textColorClass = 'text-emerald-700 dark:text-emerald-400';
          let bgClass = 'bg-emerald-50 dark:bg-emerald-900/20';
          
          if(percentage < 75) {
              colorClass = 'bg-rose-500';
              textColorClass = 'text-rose-700 dark:text-rose-400';
              bgClass = 'bg-rose-50 dark:bg-rose-900/20';
          } else if(percentage < 85) {
              colorClass = 'bg-amber-500';
              textColorClass = 'text-amber-700 dark:text-amber-400';
              bgClass = 'bg-amber-50 dark:bg-amber-900/20';
          }

          barsHTML += `
              <div class="mb-5 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div class="flex justify-between items-end mb-2">
                      <div class="font-bold text-gray-800 dark:text-gray-200 truncate pr-4">${subj}</div>
                      <div class="font-black text-lg ${textColorClass}">${percentage}%</div>
                  </div>
                  <div class="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                      <div class="h-full ${colorClass} transition-all duration-1000" style="width: ${percentage}%"></div>
                  </div>
                  <div class="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      <span>${data.attended} Attended</span>
                      <span>${data.bunked} Bunked</span>
                  </div>
              </div>
          `;
      });
      
      const overallTotal = totalAttended + totalBunked;
      const overallPercentage = overallTotal > 0 ? Math.round((totalAttended / overallTotal) * 100) : 0;
      
      let overallColor = overallPercentage >= 75 ? 'text-emerald-500' : 'text-rose-500';

      const summaryHTML = `
          <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
              <div class="absolute top-0 right-0 p-4 opacity-20 text-6xl">📈</div>
              <h3 class="text-indigo-100 font-medium mb-1">Overall Attendance</h3>
              <div class="text-4xl font-black mb-4">${overallPercentage}%</div>
              
              <div class="flex gap-4">
                  <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex-1 border border-white/20">
                      <div class="text-[10px] uppercase tracking-wider text-indigo-100 font-bold mb-1">Total Attended</div>
                      <div class="text-xl font-bold">${totalAttended}</div>
                  </div>
                  <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex-1 border border-white/20">
                      <div class="text-[10px] uppercase tracking-wider text-indigo-100 font-bold mb-1">Total Bunked</div>
                      <div class="text-xl font-bold">${totalBunked}</div>
                  </div>
              </div>
          </div>
      `;

      container.innerHTML = summaryHTML + `<h3 class="font-bold text-gray-700 dark:text-gray-300 mb-4 px-1">Subject Breakdown</h3>` + barsHTML;
  }

})();







