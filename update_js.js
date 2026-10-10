const fs = require('fs');
let js = fs.readFileSync('app.js', 'utf8');

const notifJS = `
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

})();
`;

js = js.replace(/}\s*\n\s*\)\(\);\s*$/, '}\n' + notifJS);
fs.writeFileSync('app.js', js);
