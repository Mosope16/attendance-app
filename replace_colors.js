const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /emerald/g, to: 'primary' },
  { from: /emeraldDim/g, to: 'primaryDim' },
  { from: /emeraldText/g, to: 'primaryText' },
  { from: /EMERALD/g, to: 'PRIMARY' },
  { from: /violet/g, to: 'secondary' },
  { from: /violetDim/g, to: 'secondaryDim' },
  { from: /violetText/g, to: 'secondaryText' },
  { from: /VIOLET/g, to: 'SECONDARY' }
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));

let changedFiles = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Note: we need to replace specific words to avoid matching "emerald" inside a string if it's unrelated, 
  // but in this codebase, all occurrences of 'emerald' or 'violet' are our tokens.
  // We'll replace in reverse order of length if needed, but emerald and emeraldDim are handled fine by global regex
  // Wait, if we replace 'emerald' globally, 'emeraldDim' becomes 'primaryDim', wait!
  // 'emeraldDim'.replace(/emerald/g, 'primary') -> 'primaryDim'.
  // That actually works perfectly.
  // 'emeraldText' -> 'primaryText'.
  // Same for violet.
  // So we just need:
  // emerald -> primary
  // EMERALD -> PRIMARY
  // violet -> secondary
  // VIOLET -> SECONDARY
  
  content = content.replace(/emerald/g, 'primary');
  content = content.replace(/EMERALD/g, 'PRIMARY');
  content = content.replace(/violet/g, 'secondary');
  content = content.replace(/VIOLET/g, 'SECONDARY');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log(`Updated ${file}`);
  }
});

console.log(`Done. Updated ${changedFiles} files.`);
