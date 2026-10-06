import re

with open('src/main.js', 'r', encoding='utf-8') as f:
    content = f.read()

dashboard_func = """  function renderDashboardGrid() {
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
                headHTML += `<th class="py-3 px-2 font-semibold border-r border-indigo-500 dark:border-indigo-800 last:border-0 bg-indigo-50 dark:bg-indigo-900/40 w-12 opacity-80 text-[10px]"><div class="mx-auto" style="writing-mode: vertical-rl; transform: rotate(180deg);">${p.label || 'BREAK'}</div></th>`;
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
                        bodyHTML += `<td rowspan="${daysWithSubjects.length}" class="py-2 px-1 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/80 text-center font-bold tracking-[0.2em] text-gray-500 dark:text-gray-400 text-[10px] shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg); vertical-align: middle;">${p.label || 'BREAK'}</td>`;
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
  }"""

edit_func = """  function renderEditGrid() {
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
    }"""

content = re.sub(r'  function renderDashboardGrid\(\) \{.*?body\.innerHTML = bodyHTML;\s*\}', dashboard_func, content, flags=re.DOTALL)
content = re.sub(r'  function renderEditGrid\(\) \{.*?body\.innerHTML = bodyHTML;\s*\}', edit_func, content, flags=re.DOTALL)

with open('src/main.js', 'w', encoding='utf-8') as f:
    f.write(content)
