const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const electronPath = require('electron');

const watchRoot = path.join(process.cwd(), 'src');
const extensions = new Set(['.js', '.html', '.css', '.svg']);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

let child = null;
let restartTimer = null;
let stopping = false;

function start() {
  child = spawn(electronPath, ['.'], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    windowsHide: false
  });

  child.on('exit', (code) => {
    if (!stopping && code) {
      console.log(`[dev] app exited with code ${code}; waiting for changes...`);
    }
  });
}

function restart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log('[dev] restarting Electron...');
    if (child && !child.killed) {
      child.once('exit', start);
      child.kill();
      return;
    }
    start();
  }, 150);
}

function shouldRestart(fileName) {
  return extensions.has(path.extname(String(fileName || '')).toLowerCase());
}

fs.watch(watchRoot, { recursive: true }, (_eventType, fileName) => {
  if (shouldRestart(fileName)) restart();
});

process.on('SIGINT', () => {
  stopping = true;
  if (child && !child.killed) child.kill();
  process.exit(0);
});

console.log('[dev] watching src; Electron will restart on changes.');
start();
