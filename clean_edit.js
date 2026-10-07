const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const targetStr = `            let i = 0;
            while (i < cls.periodsConfig.length) {
                const p = cls.periodsConfig[i];
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += \`<td rowspan="6" class="p-2 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center font-bold tracking-[0.2em] text-gray-400 text-xs shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg);">\${p.label || 'BREAK'}</td>\`;
                    }
                    i++;
                } else {
                    const subj = (periods[p.id] || "").trim();
                    let colspan = 1;
                    
                    if (subj) {
                        let j = i + 1;
                        while (j < cls.periodsConfig.length) {
                            const nextP = cls.periodsConfig[j];
                            if (nextP.type === 'break') break;
                            const nextSubj = (periods[nextP.id] || "").trim();
                            if (nextSubj === subj) {
                                colspan++;
                                j++;
                            } else {
                                break;
                            }
                        }
                    }
                    
                    const hasValClass = subj ? 'has-val' : '';
                    
                    let buttonsHTML = '';
                    if (colspan > 1) {
                        buttonsHTML = \`<button onclick="splitPeriod('\${dayName}', \${i}, \${colspan})" class="absolute right-1 top-1 bottom-1 px-1.5 bg-rose-500 text-white font-bold rounded shadow-md text-[9px] active:bg-rose-600 transition-colors flex items-center justify-center z-10" aria-label="Split">Split</button>\`;
                    } else if (i + 1 < cls.periodsConfig.length && cls.periodsConfig[i+1].type !== 'break') {
                        buttonsHTML = \`<button onclick="extendPeriod('\${dayName}', \${i})" class="absolute -right-2 top-1 bottom-1 px-1 bg-indigo-500 text-white rounded-full shadow-md z-20 active:bg-indigo-600 transition-transform active:scale-95 flex items-center justify-center text-[10px]" title="Combine with next period">➕</button>\`;
                    }

                    bodyHTML += \`
                    <td colspan="\${colspan}" class="p-2 border-r border-gray-100 dark:border-gray-800 last:border-0 relative min-w-[80px]">
                        <input type="text" 
                               value="\${subj}" 
                               placeholder="Free"
                               onchange="updateGridDataMultiple('\${dayName}', \${i}, \${colspan}, this.value)"
                               class="grid-input text-xs font-semibold p-2 text-center w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition-colors \${hasValClass} \${colspan > 1 ? 'font-black tracking-wide bg-indigo-50 dark:bg-indigo-900/20' : ''}">
                        \${buttonsHTML}
                    </td>\`;
                    
                    i += colspan;
                }
            }`;

const replaceStr = `            cls.periodsConfig.forEach(p => {
                if (p.type === 'break') {
                    if (rowIndex === 0) {
                        bodyHTML += \`<td rowspan="6" class="p-2 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-center font-bold tracking-[0.2em] text-gray-400 text-xs shadow-inner" style="writing-mode: vertical-rl; transform: rotate(180deg);">\${p.label || 'BREAK'}</td>\`;
                    }
                } else {
                    const subj = periods[p.id] || "";
                    const hasValClass = subj ? 'has-val' : '';
                    
                    bodyHTML += \`
                    <td class="p-1 border-r border-gray-100 dark:border-gray-800 last:border-0">
                        <input type="text" 
                               value="\${subj}" 
                               placeholder="Free"
                               onchange="updateGridData('\${dayName}', '\${p.id}', this.value)"
                               class="grid-input text-[11px] font-medium p-2 text-center w-full bg-transparent border border-gray-200 dark:border-gray-700 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors \${hasValClass}">
                    </td>\`;
                }
            });`;

// Because of Windows CRLF and Unicode emoji issues, a simpler string replacement without regex is better.
// But to avoid formatting mismatches, let's use a regex that matches the start and end.
const finalRegex = /let i = 0;\s*while[\s\S]*?i \+= colspan;\s*\}\s*\}/;

code = code.replace(finalRegex, replaceStr);

fs.writeFileSync('app.js', code);
console.log('Reverted Edit Grid loop');
