import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';

const label = process.argv[2];
if (!/^v\d+$/.test(label ?? '')) {
  console.error('usage: node scripts/pack.mjs <v1|v2|...> [--force]');
  process.exit(1);
}
if (existsSync(`dist/${label}/app.asar`) && !process.argv.includes('--force')) {
  console.error(`dist/${label}/app.asar already exists; pass --force to replace it.`);
  process.exit(1);
}

const stage = `build/stage-${label}`;
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
for (const entry of ['package.json', 'main.js', 'preload.js', 'renderer']) {
  cpSync(entry, `${stage}/${entry}`, { recursive: true });
}

mkdirSync(`dist/${label}`, { recursive: true });
execSync(`npx @electron/asar pack ${stage} dist/${label}/app.asar`, { stdio: 'inherit' });
console.log(`packed dist/${label}/app.asar`);
