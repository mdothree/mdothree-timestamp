// Pre-deploy check for the browser ES modules:
//  1. every .js file parses (node --check)
//  2. every named import / re-export from a relative module is actually exported
//     (a missing export is a link-time SyntaxError that kills the whole page).
// Usage: node scripts/check-imports.mjs public/js
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dirs = process.argv.slice(2);
let problems = 0;

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (p.endsWith('.js') || p.endsWith('.mjs')) out.push(p);
  }
  return out;
}

const cache = new Map();
function exportsOf(file) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+\{([^}]*)\}/g)) m[1].split(',').forEach(s => s.trim() && names.add(s.split(':').pop().trim()));
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
      const parts = s.split(/\s+as\s+/); names.add((parts[1] || parts[0]).trim());
    });
  }
  if (/export\s+default/.test(src)) names.add('default');
  cache.set(file, names);
  return names;
}

function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = [];
  const re = /(import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const [, kind, clause, spec] = m;
    if (!spec.startsWith('.')) continue;
    if (kind === 'export' && !clause.trim().startsWith('{')) continue; // export * from
    const names = [];
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) braces[1].split(',').map(s => s.trim()).filter(Boolean).forEach(s => names.push(s.split(/\s+as\s+/)[0].trim()));
    const def = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+\w+/, '').replace(/,/g, '').trim();
    if (kind === 'import' && def && !def.startsWith('type')) names.push('default');
    out.push({ spec, names });
  }
  for (const m of src.matchAll(/import\s+['"](\.[^'"]+)['"]/g)) out.push({ spec: m[1], names: [] });
  return out;
}

for (const dir of dirs) {
  for (const f of walk(dir)) {
    // parse as an ES module via stdin: `node --check file.js` can pass broken ESM when package.json has no "type": "module"
    const syn = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), encoding: 'utf8' });
    if (syn.status !== 0) { console.log(`SYNTAX ERROR  ${f}\n${(syn.stderr || '').split('\n').slice(0, 5).join('\n')}`); problems++; continue; }
    for (const { spec, names } of importsOf(f)) {
      const target = path.resolve(path.dirname(f), spec);
      if (!fs.existsSync(target)) { console.log(`MISSING FILE  ${f} -> ${spec}`); problems++; continue; }
      const ex = exportsOf(target);
      for (const n of names) if (!ex.has(n)) { console.log(`MISSING EXPORT ${path.relative(dir, f)} imports '${n}' from ${spec}`); problems++; }
    }
  }
}
console.log(problems ? `${problems} problem(s)` : 'OK: all relative named imports resolve');
process.exit(problems ? 1 : 0);
