#!/usr/bin/env node
/**
 * Test runner.
 *
 * Purpose: discover every `tests/*.test.js` file in Node and pass the explicit
 * paths to `node --test`.
 *
 * Invariant: file discovery never happens in a shell glob or in node's own
 * glob handling. PowerShell on windows-latest does not expand `tests/*.test.js`,
 * and node's directory/glob argument behaviour has changed between v20 and v22.
 * Both failure modes are silent-ish: CI either errors on a literal path or runs
 * a subset of the suite and reports green. Enumerating here removes the class.
 *
 * Exits non-zero if no test files are found, so an empty suite can never pass.
 */

const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const testsDir = __dirname;
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => join(testsDir, name));

if (files.length === 0) {
  console.error(`No *.test.js files found in ${testsDir}`);
  process.exit(1);
}

console.log(`Running ${files.length} test file(s):`);
for (const file of files) {
  console.log(`  - ${file.slice(testsDir.length + 1)}`);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
