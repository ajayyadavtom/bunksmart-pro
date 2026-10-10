const fs = require('fs');

let js = fs.readFileSync('app.js', 'utf8');

const analyticsJS = `
    /* --- ANALYTICS GRAPH LOGIC --- */
    window.setAnalyticsView = (mode) => {
        const cls = getActiveClass();
        cls.settings = cls.settings || {};
        cls.settings.analyticsViewMode = mode;
        saveState(state);
        openAnalyticsModal();
    };

    function renderAnalytics() {
        const cls = getActiveClass();
        const container = getEl('analytics-content');
        
        // Calculate Stats
        const subjStats = {};
        
        // Initialize subjStats with all unique subjects from the timetable
        Object.values(cls.timetable || {}).forEach(day => {
            Object.values(day).forEach(subj => {
                const s = (typeof subj === 'string' ? subj : '').trim();
                if(s && !subjStats[s]) {
                    subjStats[s] = { attended: 0, bunked: 0, total: 0 };
                }
            });
        });
  
        // Populate from history
        const historyKeys = Object.keys(cls.dailyMarks || {});
        let hasData = false;
  
        historyKeys.forEach(dateStr => {
            const marks = cls.dailyMarks[dateStr];
            if (marks && !marks.isHoliday) {
                Object.keys(marks).forEach(k => {
                    if (k === 'isHoliday') return;
                    const status = marks[k];
                    let subj = k.split('#').slice(1).join('#').trim();
                    if(subj) {
                        if (!subjStats[subj]) subjStats[subj] = { attended: 0, bunked: 0, total: 0 };
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
            }
        });
  
        if (!hasData) {
            container.innerHTML = \`
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="text-6xl mb-4 opacity-50">dY"S</div>
                    <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300">No Data Yet</h3>
                    <p class="text-sm text-gray-500 max-w-xs mt-2">Start tracking your attendance in the Roll Call tab to see your analytics graph here!</p>
                </div>
            \`;
            return;
        }
  
        let totalAttended = 0;
        let totalBunked = 0;
        
        const viewMode = (cls.settings && cls.settings.analyticsViewMode) ? cls.settings.analyticsViewMode : 'card';
        let barsHTML = '';

        if (viewMode === 'table') {
            barsHTML += \`<div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4"><table class="w-full text-left text-sm">
                <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    <tr>
                        <th class="px-4 py-3 font-bold">Subject</th>
                        <th class="px-4 py-3 font-bold text-center">Att</th>
                        <th class="px-4 py-3 font-bold text-center">Bnk</th>
                        <th class="px-4 py-3 font-bold text-right">%</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">\`;
        }
        
        Object.entries(subjStats).forEach(([subj, data]) => {
            if(data.total === 0) return;
            
            totalAttended += data.attended;
            totalBunked += data.bunked;
            
            const percentage = Math.round((data.attended / data.total) * 100);
            
            let colorClass = 'bg-emerald-500';
            let textColorClass = 'text-emerald-700 dark:text-emerald-400';
            let bgClass = 'bg-emerald-50 dark:bg-emerald-900/20';
            let tableTextColor = 'text-emerald-600 dark:text-emerald-400';
            
            if(percentage < 75) {
                colorClass = 'bg-rose-500';
                textColorClass = 'text-rose-700 dark:text-rose-400';
                bgClass = 'bg-rose-50 dark:bg-rose-900/20';
                tableTextColor = 'text-rose-600 dark:text-rose-500';
            } else if(percentage < 85) {
                colorClass = 'bg-amber-500';
                textColorClass = 'text-amber-700 dark:text-amber-400';
                bgClass = 'bg-amber-50 dark:bg-amber-900/20';
                tableTextColor = 'text-amber-600 dark:text-amber-500';
            }
  
            if (viewMode === 'table') {
                barsHTML += \`
                    <tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                        <td class="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">\${subj}</td>
                        <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-400">\${data.attended}</td>
                        <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-400">\${data.bunked}</td>
                        <td class="px-4 py-3 text-right font-black \${tableTextColor}">\${percentage}%</td>
                    </tr>
                \`;
            } else {
                barsHTML += \`
                    <div class="mb-5 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <div class="flex justify-between items-end mb-2">
                            <div class="font-bold text-gray-800 dark:text-gray-200 truncate pr-4">\${subj}</div>
                            <div class="font-black text-lg \${textColorClass}">\${percentage}%</div>
                        </div>
                        <div class="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                            <div class="h-full \${colorClass} transition-all duration-1000" style="width: \${percentage}%"></div>
                        </div>
                        <div class="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            <span>\${data.attended} Attended</span>
                            <span>\${data.bunked} Bunked</span>
                        </div>
                    </div>
                \`;
            }
        });

        if (viewMode === 'table') {
            barsHTML += \`</tbody></table></div>\`;
        }
        
        const overallTotal = totalAttended + totalBunked;
        const overallPercentage = overallTotal > 0 ? Math.round((totalAttended / overallTotal) * 100) : 0;
        
        let overallColor = overallPercentage >= 75 ? 'text-emerald-500' : 'text-rose-500';
  
        const summaryHTML = \`
            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 p-4 opacity-20 text-6xl">📈</div>
                <h3 class="text-indigo-100 font-medium mb-1">Overall Attendance</h3>
                <div class="text-4xl font-black mb-4">\${overallPercentage}%</div>
                
                <div class="flex gap-4">
                    <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex-1 border border-white/20">
                        <div class="text-[10px] uppercase tracking-wider text-indigo-100 font-bold mb-1">Total Attended</div>
                        <div class="text-xl font-bold">\${totalAttended}</div>
                    </div>
                    <div class="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 flex-1 border border-white/20">
                        <div class="text-[10px] uppercase tracking-wider text-indigo-100 font-bold mb-1">Total Bunked</div>
                        <div class="text-xl font-bold">\${totalBunked}</div>
                    </div>
                </div>
            </div>
        \`;
  
        container.innerHTML = summaryHTML + \`<h3 class="font-bold text-gray-700 dark:text-gray-300 mb-4 px-1">Subject Breakdown</h3>\` + barsHTML;
    }

    /* --- NOTIFICATION LOGIC --- */
    window.openNotificationSettings = () => {
        closeSidebar();
        
        const cls = getActiveClass();
        if (!cls.settings.notifications) {
            cls.settings.notifications = { daily: false, time: '18:00', low: false };
        }
        
        const notif = cls.settings.notifications;
        
        getEl('notif-daily-toggle').checked = notif.daily;
        getEl('notif-low-toggle').checked = notif.low;
        getEl('notif-time-input').value = notif.time || '18:00';
        
        if (notif.daily) {
            getEl('notif-time-container').classList.remove('opacity-50', 'pointer-events-none');
        } else {
            getEl('notif-time-container').classList.add('opacity-50', 'pointer-events-none');
        }
        
        openModal('notification-modal');
    };

    window.toggleNotificationSetting = (type, checked) => {
        const cls = getActiveClass();
        if (!cls.settings.notifications) cls.settings.notifications = { daily: false, time: '18:00', low: false };
        
        cls.settings.notifications[type] = checked;
        
        if (type === 'daily') {
            if (checked) {
                getEl('notif-time-container').classList.remove('opacity-50', 'pointer-events-none');
                requestNotificationPermission(false);
            } else {
                getEl('notif-time-container').classList.add('opacity-50', 'pointer-events-none');
            }
        } else if (type === 'low' && checked) {
            requestNotificationPermission(false);
        }
        
        saveState(state);
    };

    window.saveNotificationTime = (time) => {
        const cls = getActiveClass();
        if (!cls.settings.notifications) cls.settings.notifications = { daily: false, time: '18:00', low: false };
        cls.settings.notifications.time = time;
        saveState(state);
        showToast("Reminder time saved.");
    };

    window.requestNotificationPermission = (test = true) => {
        if (!("Notification" in window)) {
            alert("This browser does not support desktop notifications.");
            return;
        }

        Notification.requestPermission().then(function (permission) {
            if (permission === "granted" && test) {
                new Notification("Notifications Enabled!", {
                    body: "BunkSmart Pro will now alert you based on your settings.",
                    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>dYZ</text></svg>"
                });
                showToast("Test notification sent!");
            }
        });
    };

    // A simple mock for daily checks or low attendance warnings if it were a PWA.
    // In this pure frontend version, we can check when the app loads.
    function checkNotifications() {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        
        const cls = getActiveClass();
        if (!cls.settings.notifications) return;
        
        const notif = cls.settings.notifications;
        
        // Low Attendance Check
        if (notif.low) {
            const historyKeys = Object.keys(cls.dailyMarks || {});
            const subjStats = {};
            historyKeys.forEach(dateStr => {
                const marks = cls.dailyMarks[dateStr];
                if (marks && !marks.isHoliday) {
                    Object.keys(marks).forEach(k => {
                        if (k === 'isHoliday') return;
                        let subj = k.split('#').slice(1).join('#').trim();
                        if (subj) {
                            if (!subjStats[subj]) subjStats[subj] = { attended: 0, total: 0 };
                            subjStats[subj].total++;
                            if (marks[k] === 'attended') subjStats[subj].attended++;
                        }
                    });
                }
            });
            
            let lowSubjects = [];
            Object.keys(subjStats).forEach(subj => {
                let p = Math.round((subjStats[subj].attended / subjStats[subj].total) * 100);
                if (p < cls.settings.targetPercentage) {
                    lowSubjects.push(subj);
                }
            });
            
            // Just for demonstration: notify once per session if low
            if (lowSubjects.length > 0 && !sessionStorage.getItem('bunksmart_low_warned')) {
                new Notification("Low Attendance Warning", {
                    body: \`You are below \${cls.settings.targetPercentage}% in: \${lowSubjects.join(', ')}\`
                });
                sessionStorage.setItem('bunksmart_low_warned', 'true');
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(checkNotifications, 3000);
    });

`;

// Insert the code right before the final init(); call or '})();'
js = js.replace(/function init\(\)\s*\{/, analyticsJS + '\n  function init() {');
fs.writeFileSync('app.js', js);
