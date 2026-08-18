// Hikari's voice — Microsoft Edge neural TTS (free online service).
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const fs = require('fs');
const os = require('os');
const path = require('path');

let tts = null;
let currentVoice = null;

// strip anything that reads badly aloud: emoji, markdown leftovers, kaomoji bits
function sanitize(text) {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, '')
    .replace(/[*_`#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

async function speak(text, cfg) {
  const clean = sanitize(text);
  if (!clean) return null;

  if (!tts || currentVoice !== cfg.voice) {
    tts = new MsEdgeTTS();
    await tts.setMetadata(cfg.voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    currentVoice = cfg.voice;
  }

  const dir = path.join(os.tmpdir(), 'hikari-tts');
  fs.mkdirSync(dir, { recursive: true });
  const res = await tts.toFile(dir, clean, { pitch: cfg.pitch, rate: cfg.rate });
  const buf = fs.readFileSync(res.audioFilePath);
  fs.unlink(res.audioFilePath, () => {});
  return buf.toString('base64');
}

module.exports = { speak };
