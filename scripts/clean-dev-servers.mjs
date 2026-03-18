import { spawnSync } from 'node:child_process';

const DEFAULT_PORTS = [5173, 5174, 5175, 5176, 5177, 5178, 8787];

function parsePorts(argv) {
  const values = argv.length > 0 ? argv : DEFAULT_PORTS.map(String);
  const ports = values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  return [...new Set(ports)];
}

function getListeningPids(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8'
  });

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr.trim() || `Unable to inspect port ${port}.`);
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => Number.parseInt(line, 10))
    .filter((value) => Number.isInteger(value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendSignal(pid, signal) {
  try {
    process.kill(pid, signal);
    return 'sent';
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      if (error.code === 'ESRCH') {
        return 'missing';
      }

      if (error.code === 'EPERM') {
        return 'blocked';
      }
    }

    throw error;
  }
}

const ports = parsePorts(process.argv.slice(2));
const pidToPorts = new Map();

for (const port of ports) {
  for (const pid of getListeningPids(port)) {
    const existing = pidToPorts.get(pid) ?? [];
    existing.push(port);
    pidToPorts.set(pid, existing);
  }
}

if (pidToPorts.size === 0) {
  console.log('[dev-clean] no matching listeners found');
  process.exit(0);
}

const blocked = [];

for (const [pid, claimedPorts] of pidToPorts) {
  const result = sendSignal(pid, 'SIGTERM');

  if (result === 'sent') {
    console.log(`[dev-clean] SIGTERM pid=${pid} ports=${claimedPorts.join(',')}`);
    continue;
  }

  if (result === 'blocked') {
    blocked.push({ pid, ports: claimedPorts });
    console.log(`[dev-clean] unable to signal pid=${pid} ports=${claimedPorts.join(',')} (permission denied)`);
  }
}

await sleep(400);

for (const [pid, claimedPorts] of pidToPorts) {
  if (blocked.some((entry) => entry.pid === pid)) {
    continue;
  }

  const stillListening = claimedPorts.some((port) => getListeningPids(port).includes(pid));
  if (!stillListening) {
    continue;
  }

  const result = sendSignal(pid, 'SIGKILL');
  if (result === 'sent') {
    console.log(`[dev-clean] SIGKILL pid=${pid} ports=${claimedPorts.join(',')}`);
  }
}

if (blocked.length > 0) {
  process.exitCode = 1;
}
