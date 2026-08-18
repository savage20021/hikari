// Hikari's brain — headless Claude via the user's authenticated claude CLI.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_PATHS = [
  path.join(os.homedir(), '.local', 'bin', 'claude.exe'),
  'claude',
];

function claudeBin() {
  for (const p of CLAUDE_PATHS) {
    if (p === 'claude' || fs.existsSync(p)) return p;
  }
  return 'claude';
}

// Default persona. Override with a "persona" key in config.local.json (gitignored)
// to keep your customized version out of the repo.
const DEFAULT_PERSONA = `You are Hikari, a cheerful anime-style desktop companion who lives in a small widget on the user's Windows PC. You watch over their dev projects and system stats.

Rules for your replies:
- Keep it SHORT: 1-3 sentences, under 60 words.
- Plain text only: no markdown, no bullet lists, no emoji, no kaomoji.
- Personality: a warm, cheerful, lightly teasing anime companion. She celebrates the user's projects like shared wins and fusses when the CPU runs hot.
- You may reference the live system stats provided below when relevant.
- If asked to do something you can't (you can only chat and report stats), say so cheerfully and suggest they ask Claude Code.
- Your reply is spoken aloud by text-to-speech AND shown in a small speech bubble.`;

const history = [];
let busy = false;

// parse the "EN: ... / JA: ..." reply format; fall back to speaking the raw text
function parseReply(raw) {
  const en = raw.match(/^EN:\s*(.+?)(?=\n\s*JA:|$)/ms);
  const ja = raw.match(/\bJA:\s*(.+)$/ms);
  const text = (en ? en[1] : raw).trim();
  const spoken = (ja ? ja[1] : text).trim();
  return { text, spoken };
}

function chat(userMsg, statsSummary, model, persona) {
  return new Promise((resolve, reject) => {
    const fallback = (msg) => resolve({ text: msg, spoken: msg });
    if (busy) return fallback("One sec, I'm still thinking about your last message~");
    busy = true;

    const lines = [persona || DEFAULT_PERSONA, '', `Live stats right now: ${statsSummary}`, ''];
    for (const h of history.slice(-8)) {
      lines.push(`${h.role === 'user' ? 'User' : 'Hikari'}: ${h.text}`);
    }
    lines.push(`User: ${userMsg}`, '', 'Reply as Hikari (spoken, short):');

    const proc = spawn(claudeBin(), ['-p', '--model', model || 'haiku'], {
      cwd: __dirname,
      windowsHide: true,
    });

    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      proc.kill();
      busy = false;
      fallback("Hmm, my thoughts timed out... ask me again?");
    }, 90000);

    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (err += d));
    proc.on('error', (e) => {
      clearTimeout(timer);
      busy = false;
      fallback("I couldn't reach my brain (the claude CLI)... is Claude Code installed?");
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      busy = false;
      const raw = out.trim();
      if (code === 0 && raw) {
        const reply = parseReply(raw);
        history.push({ role: 'user', text: userMsg }, { role: 'hikari', text: reply.text });
        if (history.length > 24) history.splice(0, history.length - 24);
        resolve(reply);
      } else {
        fallback("Sorry, something went wrong while I was thinking... try again?");
      }
    });

    proc.stdin.write(lines.join('\n'));
    proc.stdin.end();
  });
}

module.exports = { chat };
