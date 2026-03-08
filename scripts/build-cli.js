#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist', 'cli');
fs.mkdirSync(distDir, { recursive: true });

const builds = [
  { target: 'node18-macos-x64', output: 'tv-broadcast-macos' },
  { target: 'node18-linux-x64', output: 'tv-broadcast-linux' },
  { target: 'node18-win-x64', output: 'tv-broadcast-win.exe' },
];

for (const build of builds) {
  const output = path.join(distDir, build.output);
  console.log(`Building ${build.target}...`);
  execSync(`npx pkg index.js -o "${output}" -t ${build.target}`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
}

console.log('Done!');
