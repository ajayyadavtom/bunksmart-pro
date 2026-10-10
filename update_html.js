const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const modalHtml = `
  <!-- Notification Settings Modal -->
  <div id="notification-modal" class="fixed inset-0 z-[100] hidden bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 opacity-0 transition-opacity duration-300">
    <div class="bg-white dark:bg-brand-cardDark w-full sm:w-[450px] rounded-t-3xl sm:rounded-3xl flex flex-col sm:shadow-2xl transform translate-y-full sm:translate-y-0 sm:scale-95 transition-transform duration-300">
      <div class="flex justify-between items-center p-6 pb-4 border-b border-gray-100 dark:border-gray-800">
        <h2 class="font-bold text-xl dark:text-white flex items-center gap-2">🔔 Notification Settings</h2>
        <button onclick="closeModal('notification-modal')" class="p-2 text-gray-400 hover:text-rose-500 bg-gray-50 dark:bg-gray-800 rounded-full transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <div class="p-6 space-y-6 overflow-y-auto">
        
        <!-- Toggle Daily Reminders -->
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-gray-800 dark:text-white text-base">Daily Reminders</h4>
            <p class="text-xs text-gray-500 mt-1">Remind me to update my attendance.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="notif-daily-toggle" class="sr-only peer" onchange="toggleNotificationSetting('daily', this.checked)">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <!-- Reminder Time -->
        <div id="notif-time-container" class="opacity-50 pointer-events-none transition-opacity">
          <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reminder Time</label>
          <input type="time" id="notif-time-input" onchange="saveNotificationTime(this.value)" class="w-full form-input rounded-xl bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 px-4 py-3 font-bold text-gray-800 dark:text-white">
        </div>

        <div class="h-px w-full bg-gray-100 dark:bg-gray-800"></div>

        <!-- Toggle Low Attendance Alerts -->
        <div class="flex items-center justify-between">
          <div>
            <h4 class="font-bold text-gray-800 dark:text-white text-base">Low Attendance Alerts</h4>
            <p class="text-xs text-gray-500 mt-1">Warn me if I drop below my target.</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="notif-low-toggle" class="sr-only peer" onchange="toggleNotificationSetting('low', this.checked)">
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-rose-500"></div>
          </label>
        </div>

        <button onclick="requestNotificationPermission()" class="w-full mt-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold rounded-xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
          🔔 Send Test Notification
        </button>

      </div>
    </div>
  </div>

  <!-- Floating Buttons -->
`;

html = html.replace('<!-- Floating Buttons -->', modalHtml);
html = html.replace("alert('Notification Settings coming soon!'); return false;", "openNotificationSettings(); return false;");
html = html.replace(/app\.js\?v=\d+/, 'app.js?v=' + Date.now());

fs.writeFileSync('index.html', html);
