const si = require('systeminformation');

// Known code projects — matched against process command lines / paths.
// key must appear as a path segment (e.g. \myproject\) to count.
// Define yours via a "projects" array in config.local.json (gitignored):
//   { "projects": [{ "key": "myproject", "name": "My Project", "emoji": "🚀" }] }
// With none configured, everything shows under "other dev processes".

// Generic dev runtimes worth showing even when not matched to a project
const DEV_NAMES = new Set([
  'node.exe', 'node', 'python.exe', 'python', 'pythonw.exe', 'py.exe',
  'bun.exe', 'deno.exe', 'uvicorn', 'dotnet.exe', 'java.exe',
]);

function projectMatcher(key) {
  return new RegExp(`[\\\\/ "']${key}([\\\\/ "']|$)`, 'i');
}

let polling = false;

async function collectStats(projectList = []) {
  if (polling) return null; // wmic/CIM queries are slow; don't overlap
  polling = true;
  try {
    const MATCHERS = projectList.map((p) => ({ ...p, re: projectMatcher(p.key) }));
    const [load, mem, procs] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.processes(),
    ]);

    const projects = MATCHERS.map((p) => ({
      key: p.key, name: p.name, emoji: p.emoji,
      cpu: 0, memMB: 0, count: 0, procs: [],
    }));
    const others = [];

    for (const proc of procs.list) {
      const hay = `${proc.command || ''} ${proc.params || ''} ${proc.path || ''}`;
      if (/hikari/i.test(hay)) continue; // don't report ourselves
      if (proc.pid === process.pid) continue;

      const memMB = (proc.memRss || 0) / 1024;
      const cpu = proc.cpu || 0;

      const project = projects.find((p, i) => MATCHERS[i].re.test(hay));

      if (project) {
        project.cpu += cpu;
        project.memMB += memMB;
        project.count += 1;
        project.procs.push({ pid: proc.pid, name: proc.name, cpu, memMB });
      } else if (DEV_NAMES.has((proc.name || '').toLowerCase())) {
        others.push({
          pid: proc.pid,
          name: proc.name,
          cpu,
          memMB,
          cmd: (proc.params || proc.command || '').slice(0, 80),
        });
      }
    }

    others.sort((a, b) => b.memMB - a.memMB);

    return {
      system: {
        cpu: load.currentLoad,
        memUsedGB: mem.active / 1024 ** 3,
        memTotalGB: mem.total / 1024 ** 3,
        memPct: (mem.active / mem.total) * 100,
      },
      projects: projects.filter((p) => p.count > 0),
      others: others.slice(0, 6),
    };
  } finally {
    polling = false;
  }
}

module.exports = { collectStats };
