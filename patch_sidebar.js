const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

content = content.replace(/<div class="space-y-1 mb-8">[\s\S]*?<!-- End of top items -->/, `<div class="space-y-1 mb-8">
      <div class="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Main Menu</div>
      <a href="#" onclick="openCalendarModal(); return false;" class="flex items-center gap-4 px-4 py-3 text-gray-700 dark:text-gray-300 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors w-full"><span class="text-xl w-6 text-center inline-block">??</span> Attendance History</a>
      <a href="#" onclick="openModal('account-modal'); return false;" class="flex items-center gap-4 px-4 py-3 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-xl transition-colors w-full"><span class="text-xl w-6 text-center inline-block">??</span> Student Portal Setup</a>
      <a href="#" onclick="openEditClassModal('form'); return false;" class="flex items-center gap-4 px-4 py-3 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-xl transition-colors w-full"><span class="text-xl w-6 text-center inline-block">??</span> Edit Timetable</a>
      <!-- End of top items -->`);

fs.writeFileSync('index.html', content, 'utf8');
