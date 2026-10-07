const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

// Update renderRollCallWidget to accept an optional dateKey parameter
content = content.replace(/function renderRollCallWidget\(\) \{/g, `let activeRollCallDate = isoDate(new Date());\n\nfunction renderRollCallWidget(targetDateStr) {\n    if (targetDateStr) activeRollCallDate = targetDateStr;\n    const targetDateObj = new Date(activeRollCallDate);\n`);
content = content.replace(/const dayIndex = new Date\(\)\.getDay\(\);/g, `const dayIndex = targetDateObj.getDay();`);
content = content.replace(/const dateKey = isoDate\(new Date\(\)\);/g, `const dateKey = activeRollCallDate;`);
content = content.replace(/const dateKey = isoDate\(new Date\(\)\);/g, `const dateKey = activeRollCallDate;`); // In toggleDayHoliday
content = content.replace(/window\.toggleDayHoliday = \(\) => \{[\s\S]*?const dateKey = isoDate\(new Date\(\)\);/, `window.toggleDayHoliday = () => {\n    const cls = getActiveClass();\n    const dateKey = activeRollCallDate;`);

// Modify window.openManualEntry to reset date to today
content = content.replace(/window\.openManualEntry = \(\) => \{/, `window.openManualEntry = () => {\n      activeRollCallDate = isoDate(new Date());`);

// Update the header of RollCallWidget to show the selected date clearly
content = content.replace(/\$\{new Date\(\)\.toLocaleDateString\('en-US', \{weekday: 'long', month: 'short', day: 'numeric'\}\)\}/g, `\${targetDateObj.toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'})}`);

// Now, update selectCalendarDate to add an "Edit this Day" button
content = content.replace(/<\/div>\n        <div class="space-y-2">/g, `</div>\n        <button onclick="editPastAttendance('\${dateStr}')" class="w-full mt-2 mb-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit this Day's Attendance</button>\n        <div class="space-y-2">`);
content = content.replace(/<div class="text-center p-6 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800\/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 mt-2">No attendance records found for this day\.<\/div>/g, `<div class="text-center p-6 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 mt-2 mb-4">No attendance records found for this day.</div><button onclick="editPastAttendance('\${dateStr}')" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-colors">Add Attendance for this Day</button>`);

// Add the window function to open past attendance
content = content.replace(/\/\* --- INIT --- \*\//, `
  window.editPastAttendance = (dateStr) => {
      closeModal('calendar-modal');
      renderRollCallWidget(dateStr);
      openModal('manual-rollcall-modal');
  };
  /* --- INIT --- */`);

fs.writeFileSync('app.js', content, 'utf8');
