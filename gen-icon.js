// One-shot: renders icon.html offscreen and writes hikari.ico (PNG-compressed) + icon.png
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 256,
    height: 256,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });
  win.webContents.setBackgroundThrottling(false);
  await win.loadFile('icon.html');
  await new Promise((r) => setTimeout(r, 800));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  const png = img.toPNG();

  // ICO container with a single PNG-compressed 256x256 entry
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 256
  entry.writeUInt8(0, 1); // height 256
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset
  fs.writeFileSync(path.join(__dirname, 'hikari.ico'), Buffer.concat([header, entry, png]));
  fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
  console.log(`icon written: ${png.length} bytes png`);
  app.quit();
});
