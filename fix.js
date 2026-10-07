const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const replacement = `    }

  window.updateGridData = (dayName, periodId, value) => {
      const cls = getActiveClass();
      if (!cls.timetable[dayName]) cls.timetable[dayName] = {};
      cls.timetable[dayName][periodId] = value.trim();
      renderEditGrid(); 
  };

  /* --- APPLY SCOPE MODAL --- */`;

code = code.replace(/    \}\s*\/\* --- APPLY SCOPE MODAL --- \*\//, replacement);
fs.writeFileSync('app.js', code);
