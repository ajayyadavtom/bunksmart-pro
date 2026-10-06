const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const modalFuncs = `
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
          html += \`<div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 mb-3">
            <div class="flex justify-between items-center mb-2">
              <h4 class="font-bold text-gray-800 dark:text-white text-sm">\${subj}</h4>
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
          </div>\`;
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
`;

content = content.replace(/function renderSettings\(\) \{/, modalFuncs + '\n  function renderSettings() {');
content = content.replace(/renderDashboardGrid\(\);/, "renderDashboardGrid();\n      renderPortalModal();\n      renderClassModal();");

fs.writeFileSync('app.js', content, 'utf8');
