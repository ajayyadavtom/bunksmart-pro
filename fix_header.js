const fs = require('fs');

let content = fs.readFileSync('app.js', 'utf8');

const dashboard_func = `  function renderDashboardGrid() {
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
  
        let headHTML = \`<th class="py-4 px-3 font-bold text-gray-500 dark:text-gray-400 sticky left-0 z-20 w-20 bg-white dark:bg-brand-cardDark border-b-2 border-gray-100 dark:border-gray-800 text-left">DAY</th>\`;
        
        cls.periodsConfig.forEach(p => {
            if (p.type === 'break') {
                headHTML += \`<th class="py-4 px-2 font-bold text-gray-400 dark:text-gray-500 text-[10px] w-8 uppercase tracking-widest border-b-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-cardDark"></th>\`;
            } else {
                headHTML += \`<th class="py-4 px-2 font-bold text-gray-600 dark:text-gray-300 text-[11px] w-28 whitespace-nowrap border-b-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-brand-cardDark"><div class="flex flex-col items-center justify-center"><span>\${p.start}</span><span class="text-[9px] text-gray-400 font-medium">\${p.end}</span></div></th>\`;
            }
        });
        headerRow.innerHTML = headHTML;
  
        let bodyHTML = '';
        daysWithSubjects.forEach((dayName, rowIndex) => {
            const dayShort = dayName.substring(0, 3).toUpperCase();
            const periods = cls.timetable[dayName] || {};
            
            bodyHTML += \`<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                <td class="py-3 px-3 font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-brand-cardDark sticky left-0 z-10 text-sm text-left">\${dayShort}</td>\`;
            
            cls.periodsConfig.forEach(p => {
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += \`<td rowspan="\${daysWithSubjects.length}" class="py-2 px-1 bg-gray-50/50 dark:bg-gray-800/30 text-center font-bold tracking-[0.4em] text-gray-300 dark:text-gray-600 text-xs uppercase rounded-xl" style="writing-mode: vertical-rl; transform: rotate(180deg); vertical-align: middle;">\${p.label || 'BREAK'}</td>\`;
                    }
                } else {
                    const subj = periods[p.id] || "";
                    if (subj) {
                        bodyHTML += \`<td class="py-1.5 px-1.5 align-middle"><div class="mx-auto w-full h-full min-h-[3.5rem] p-2 flex items-center justify-center text-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] leading-tight whitespace-normal break-words shadow-[0_2px_10px_-4px_rgba(99,102,241,0.2)] border border-indigo-100/50 dark:border-indigo-800/30">\${subj}</div></td>\`;
                    } else {
                        bodyHTML += \`<td class="py-1.5 px-1.5 text-center align-middle"><span class="text-gray-200 dark:text-gray-700 text-lg font-light">-</span></td>\`;
                    }
                }
            });
            bodyHTML += \`</tr>\`;
        });
  
        body.innerHTML = bodyHTML;
  }`;

content = content.replace(/  function renderDashboardGrid\(\) \{[\s\S]*?body\.innerHTML = bodyHTML;\s*\}/, dashboard_func);

fs.writeFileSync('app.js', content, 'utf8');
