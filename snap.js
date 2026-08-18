// One-shot: renders the widget offscreen with live stats and writes snapshot.png
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { collectStats } = require('./stats');

// Demo stats for a clean README screenshot — no real process data.
const DEMO_STATS = {
  system: { cpu: 21, memUsedGB: 11.2, memTotalGB: 32, memPct: 35 },
  projects: [],
  others: [
    { pid: 4242, name: 'node.exe', cpu: 1.8, memMB: 96, cmd: 'npm run dev' },
    { pid: 5150, name: 'python.exe', cpu: 0.4, memMB: 48, cmd: 'uvicorn app:main --reload' },
  ],
};

app.whenReady().then(async () => {
  ipcMain.handle('stats:get', () => DEMO_STATS);
  const win = new BrowserWindow({
    width: 280,
    height: 548,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      offscreen: true,
    },
  });
  win.webContents.setBackgroundThrottling(false);
  await win.loadFile('index.html');
  await new Promise((r) => setTimeout(r, 8000)); // let two polls land
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'snapshot.png'), img.toPNG());
  console.log('snapshot written');
  app.quit();
});
