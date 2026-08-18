const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { collectStats } = require('./stats');
const { chat } = require('./chat');
const { speak } = require('./tts');

const DEFAULT_CONFIG = {
  voice: 'en-US-AnaNeural',
  pitch: '+15Hz',
  rate: '+6%',
  model: 'haiku',
  speakGreeting: true,
  persona: null, // custom persona prompt; null = built-in default (chat.js)
  projects: [],  // [{ key, name, emoji }] matched against process paths (stats.js)
};

// config.local.json is gitignored — put your persona/projects there so
// personal customizations stay out of the repo.
function loadConfig() {
  const cfg = { ...DEFAULT_CONFIG };
  for (const file of ['config.json', 'config.local.json']) {
    try {
      Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')));
    } catch {}
  }
  return cfg;
}

function statsSummary(data) {
  if (!data) return 'unavailable';
  const projs = data.projects.map((p) => `${p.name} (${p.cpu.toFixed(1)}% CPU, ${Math.round(p.memMB)} MB, ${p.count} procs)`).join('; ') || 'none';
  return `CPU ${data.system.cpu.toFixed(0)}%, RAM ${data.system.memUsedGB.toFixed(1)}/${data.system.memTotalGB.toFixed(0)} GB. Running projects: ${projs}. Other dev processes: ${data.others.length}.`;
}

let lastStats = null;

let win;

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 280, H = 548;
  win = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + workArea.width - W - 16,
    y: workArea.y + workArea.height - H - 16,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    hasShadow: false,
    icon: path.join(__dirname, 'hikari.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile('index.html');
}

app.setAppUserModelId('com.hikari.companion');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.whenReady().then(() => {
  ipcMain.handle('stats:get', async () => {
    const data = await collectStats(loadConfig().projects);
    if (data) lastStats = data;
    return data;
  });
  ipcMain.handle('chat:send', (e, msg) => {
    const cfg = loadConfig();
    return chat(String(msg).slice(0, 2000), statsSummary(lastStats), cfg.model, cfg.persona);
  });
  ipcMain.handle('tts:speak', async (e, text) => {
    try {
      return await speak(String(text), loadConfig());
    } catch (err) {
      console.error('tts failed:', err.message);
      return null; // offline or service hiccup — she just stays quiet
    }
  });
  ipcMain.handle('config:get', () => loadConfig());
  ipcMain.on('win:close', () => app.quit());
  ipcMain.on('win:min', () => win && win.minimize());
  createWindow();
});

app.on('window-all-closed', () => app.quit());
