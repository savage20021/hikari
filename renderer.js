const $ = (id) => document.getElementById(id);

const chara = $('companion');

// use the real artwork when chara.png exists; otherwise keep the SVG girl
const charaImg = $('chara-img');
function useCharaImg() {
  document.body.classList.add('img-mode');
  // tall images are full-body cutouts — float them without the card frame
  if (charaImg.naturalHeight / charaImg.naturalWidth > 1.4) {
    document.body.classList.add('cutout');
  }
}
// the image may finish loading before this script runs
if (charaImg.complete && charaImg.naturalWidth > 0) {
  useCharaImg();
} else {
  charaImg.addEventListener('load', useCharaImg);
  charaImg.addEventListener('error', () => charaImg.remove());
}
const bubbleText = $('bubble-text');
const bubble = $('bubble');

let latest = null;
let lastLineAt = 0;

document.getElementById('btn-close').addEventListener('click', () => window.companion.close());
document.getElementById('btn-min').addEventListener('click', () => window.companion.minimize());

function fmtMB(mb) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function barClass(pct) {
  if (pct >= 85) return 'fill hot';
  if (pct >= 60) return 'fill warn';
  return 'fill';
}

function say(text) {
  bubble.classList.add('swap');
  setTimeout(() => {
    bubbleText.textContent = text;
    bubble.classList.remove('swap');
  }, 250);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function chooseLine(data) {
  const { system, projects } = data;

  if (system.cpu >= 85) {
    chara.classList.add('worried');
    return pick([
      'CPU is running really hot… hang in there! (>_<;)',
      'S-so much processing… your PC is working super hard!',
      `CPU at ${Math.round(system.cpu)}%… maybe close something?`,
    ]);
  }
  if (system.memPct >= 90) {
    chara.classList.add('worried');
    return pick([
      'RAM is almost full… (・_・;)',
      `Memory is at ${Math.round(system.memPct)}%! Careful~`,
    ]);
  }
  chara.classList.remove('worried');

  if (projects.length === 0) {
    return pick([
      'No projects running right now… time to build something? ✧',
      'All quiet on the dev front~ ☕',
      'Your PC is relaxing. Me too, hehe.',
    ]);
  }

  const p = pick(projects);
  const cpu = p.cpu.toFixed(1);
  const mem = fmtMB(p.memMB);
  return pick([
    `${p.emoji} ${p.name} is running! Using ${cpu}% CPU and ${mem}~`,
    `${p.name} is hard at work — ${p.count} process${p.count > 1 ? 'es' : ''}, ${mem} of RAM!`,
    `I'm watching ${p.name} for you! ${cpu}% CPU right now ✧`,
    `${projects.length} project${projects.length > 1 ? 's' : ''} running in the background. All good! ♪`,
  ]);
}

// Process names/command lines come from other programs — escape them
// before they touch innerHTML (defense in depth alongside the CSP).
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(data) {
  const { system, projects, others } = data;

  $('cpu-bar').style.width = `${Math.min(100, system.cpu)}%`;
  $('cpu-bar').className = barClass(system.cpu);
  $('cpu-val').textContent = `${system.cpu.toFixed(0)}%`;

  $('ram-bar').style.width = `${Math.min(100, system.memPct)}%`;
  $('ram-bar').className = barClass(system.memPct);
  $('ram-val').textContent = `${system.memUsedGB.toFixed(1)}/${system.memTotalGB.toFixed(0)} GB`;

  const projEl = $('projects');
  if (projects.length === 0) {
    projEl.innerHTML = '<div class="empty">Nothing running right now~</div>';
  } else {
    projEl.innerHTML = projects
      .map(
        (p) => `
      <div class="proj">
        <span class="dot"></span>
        <span class="emoji">${esc(p.emoji)}</span>
        <div class="info">
          <div class="pname">${esc(p.name)}</div>
          <div class="psub">${p.count} process${p.count > 1 ? 'es' : ''} · ${esc(p.procs.map((x) => x.name).join(', '))}</div>
        </div>
        <div class="pstats">
          <div class="cpu">${p.cpu.toFixed(1)}% CPU</div>
          <div class="mem">${fmtMB(p.memMB)}</div>
        </div>
      </div>`
      )
      .join('');
  }

  const otherEl = $('others');
  if (others.length === 0) {
    otherEl.innerHTML = '<div class="empty">No other dev processes.</div>';
  } else {
    otherEl.innerHTML = others
      .map(
        (o) => `
      <div class="other">
        <div class="info">
          <div class="pname">${esc(o.name)} <span style="opacity:.5;font-weight:400">· ${o.pid}</span></div>
          <div class="psub" title="${esc(o.cmd)}">${esc(o.cmd) || '—'}</div>
        </div>
        <div class="pstats">
          <div class="cpu">${o.cpu.toFixed(1)}%</div>
          <div class="mem">${fmtMB(o.memMB)}</div>
        </div>
      </div>`
      )
      .join('');
  }
}

async function poll() {
  try {
    const data = await window.companion.getStats();
    if (data) {
      latest = data;
      render(data);
      if (!chatting && Date.now() - lastLineAt > 8000) {
        say(chooseLine(data));
        lastLineAt = Date.now();
      }
    }
  } catch (err) {
    console.error(err);
  }
}

/* ---------- chat + voice ---------- */
const chatInput = $('chat-input');
const btnVoice = $('btn-voice');
let voiceOn = localStorage.getItem('hikari-voice') !== 'off';
let chatting = false;
let currentAudio = null;

function renderVoiceBtn() {
  btnVoice.textContent = voiceOn ? '🔊' : '🔇';
  btnVoice.classList.toggle('muted', !voiceOn);
}
renderVoiceBtn();

btnVoice.addEventListener('click', () => {
  voiceOn = !voiceOn;
  localStorage.setItem('hikari-voice', voiceOn ? 'on' : 'off');
  if (!voiceOn && currentAudio) currentAudio.pause();
  renderVoiceBtn();
});

async function playVoice(text) {
  if (!voiceOn) return;
  try {
    const b64 = await window.companion.speak(text);
    if (!b64 || !voiceOn) return;
    if (currentAudio) currentAudio.pause();
    currentAudio = new Audio('data:audio/mp3;base64,' + b64);
    currentAudio.play();
  } catch (err) {
    console.error('voice failed', err);
  }
}

async function sendChat() {
  const msg = chatInput.value.trim();
  if (!msg || chatting) return;
  chatting = true;
  chatInput.value = '';
  chatInput.disabled = true;
  bubble.classList.add('thinking');
  bubbleText.textContent = 'Hmm';
  try {
    const reply = await window.companion.chat(msg);
    bubble.classList.remove('thinking');
    const text = reply.text || reply;
    say(text);
    lastLineAt = Date.now() + 25000; // keep the reply on screen a while
    playVoice(reply.spoken || text);
  } catch (err) {
    bubble.classList.remove('thinking');
    say('Sorry, I glitched out for a second there...');
  } finally {
    chatting = false;
    chatInput.disabled = false;
    chatInput.focus();
  }
}

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

/* ---------- startup ---------- */
const GREETING = "Hiya! I'm Hikari ✧ Ask me anything, or I'll just watch your projects~";
say(GREETING);
lastLineAt = Date.now() + 6000;
window.companion.getConfig().then((cfg) => {
  if (cfg.speakGreeting) playVoice("Well hello there~ Miss me? I'll be right here watching over everything... and you. Hehe.");
});
poll();
setInterval(poll, 3000);
