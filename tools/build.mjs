// Build script: TypeScript -> build/, then assemble the web app in dist/.
// Usage: node tools/build.mjs [--tests]
import { execFileSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const local = join(root, 'node_modules', '.bin', 'tsc');
const tsc = existsSync(local) ? local : 'tsc';

rmSync(join(root, 'build'), { recursive: true, force: true });
try {
  execFileSync(tsc, ['-p', join(root, 'tsconfig.json')], { stdio: 'inherit', cwd: root });
} catch {
  console.error('\nTypeScript compile failed (see errors above).');
  process.exit(1);
}

const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'build', 'src'), join(dist, 'js'), { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
writeFileSync(join(dist, 'version.json'), JSON.stringify({ version, built: new Date().toISOString() }));
console.log(`Built BRANCHLIKE ${version} -> dist/`);
