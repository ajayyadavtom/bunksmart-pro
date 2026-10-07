const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const regex = /let i = 0;\s*while \(i < cls\.periodsConfig\.length\) \{[\s\S]*?bodyHTML \+= `<\/tr>`;\s*\}\);\s*body\.innerHTML = bodyHTML;\s*\}/m;

const replacement = `cls.periodsConfig.forEach(p => {
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += \`<td rowspan="6" class="p-2 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center font-bold tracking-[0.2em] text-gray-400 text-xs shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg);">\${p.label || 'BREAK'}</td>\`;
                    }
                } else {
                    const subj = periods[p.id] || "";
                    const hasValClass = subj ? 'has-val bg-indigo-50 dark:bg-indigo-900/20' : '';
                    
                    bodyHTML += \`
                    <td class="p-1 border-r border-gray-100 dark:border-gray-800 last:border-0 min-w-[80px]">
                        <input type="text" 
                               value="\${subj}" 
                               placeholder="Free"
                               onchange="updateGridData('\${dayName}', '\${p.id}', this.value)"
                               class="grid-input text-[11px] font-semibold p-2 text-center w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-colors \${hasValClass}">
                    </td>\`;
                }
            });
            bodyHTML += \`</tr>\`;
        });
        body.innerHTML = bodyHTML;
    }`;

code = code.replace(regex, replacement);

// Also remove extendPeriod, splitPeriod, updateGridDataMultiple
code = code.replace(/window\.extendPeriod = [\s\S]*?renderEditGrid\(\);\s*\};\s*/g, '');
code = code.replace(/window\.splitPeriod = [\s\S]*?renderEditGrid\(\);\s*\};\s*/g, '');
code = code.replace(/window\.updateGridDataMultiple = [\s\S]*?renderEditGrid\(\);\s*\};\s*/g, '');

fs.writeFileSync('app.js', code);
console.log('Successfully reverted app.js');
