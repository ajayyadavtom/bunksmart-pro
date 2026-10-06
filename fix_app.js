const fs = require('fs');
let content = fs.readFileSync('app.js', 'utf8');

const newClassCode = `  function createNewClass(name) {
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
  }`;

content = content.replace(/  function createNewClass\(name\) \{[\s\S]*?dailyMarks: \{\}\n      \};\n  \}/, newClassCode);
content = content.replace(/localStorage\.getItem\(STORAGE_KEY\)/, 'null'); // Force reset state to load the new default

fs.writeFileSync('app.js', content, 'utf8');
