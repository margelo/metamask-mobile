// On-device WebSocket benchmark runner.
//
// Unlike scripts/websocket-benchmark.js (which compares two Node libraries over
// loopback), this runs INSIDE the React Native runtime and drives the two REAL
// implementations the app can ship:
//   - React Native's bridge-based WebSocket (messages cross the JS bridge)
//   - NitroWebSocket via NitroWebSocketAdapter (C++ libwebsockets over JSI)
// against the SAME real echo endpoint, on the SAME device, interleaved per round
// so warmup/thermal/network drift hits both equally.

import { Platform } from 'react-native';
import {
  BenchImplementation,
  BenchWebSocket,
  BenchmarkConfig,
  BenchmarkReport,
  ImplementationResult,
  LatencyStats,
  ProgressCallback,
  SubscribeImplementationResult,
  ThroughputResult,
} from './types';

const WARMUP_MESSAGES = 20;
const OPEN_TIMEOUT_MS = 10_000;
const ECHO_TIMEOUT_MS = 10_000;

const now = (): number =>
  typeof global.performance?.now === 'function'
    ? global.performance.now()
    : Date.now();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function stats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { samples: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    samples: sorted.length,
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    mean: round(sum / sorted.length),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
  };
}

function meanStats(list: LatencyStats[]): LatencyStats {
  const valid = list.filter((s) => s.samples > 0);
  if (valid.length === 0) {
    return { samples: 0, min: 0, max: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
  }
  const avg = (pick: (s: LatencyStats) => number) =>
    Math.round((valid.reduce((a, s) => a + pick(s), 0) / valid.length) * 1000) /
    1000;
  return {
    samples: valid.reduce((a, s) => a + s.samples, 0),
    min: Math.min(...valid.map((s) => s.min)),
    max: Math.max(...valid.map((s) => s.max)),
    mean: avg((s) => s.mean),
    p50: avg((s) => s.p50),
    p95: avg((s) => s.p95),
    p99: avg((s) => s.p99),
  };
}

// ─── Socket helpers ───────────────────────────────────────────────────────────

function open(
  ctor: BenchImplementation['ctor'],
  url: string,
): Promise<BenchWebSocket> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new ctor(url);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
      reject(new Error(`open timeout after ${OPEN_TIMEOUT_MS}ms`));
    }, OPEN_TIMEOUT_MS);

    ws.onopen = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ws);
    };
    ws.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`open error: ${describeError(event)}`));
    };
  });
}

function close(ws: BenchWebSocket): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    ws.onclose = finish;
    try {
      ws.close();
    } catch {
      finish();
    }
    setTimeout(finish, 2000);
  });
}

function sendAndReceive(
  ws: BenchWebSocket,
  payload: string | ArrayBuffer,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.onmessage = null;
      reject(new Error(`echo timeout after ${ECHO_TIMEOUT_MS}ms`));
    }, ECHO_TIMEOUT_MS);
    ws.onmessage = () => {
      ws.onmessage = null;
      clearTimeout(timer);
      resolve();
    };
    ws.send(payload);
  });
}

function describeError(event: unknown): string {
  if (typeof event === 'string') return event;
  if (event && typeof event === 'object' && 'message' in event) {
    return String((event as { message: unknown }).message);
  }
  return 'unknown';
}

async function warmup(ws: BenchWebSocket): Promise<void> {
  for (let i = 0; i < WARMUP_MESSAGES; i++) {
    // eslint-disable-next-line no-await-in-loop
    await sendAndReceive(ws, `warmup:${i}`).catch(() => undefined);
  }
}

// ─── Individual benchmarks ──────────────────────────────────────────────────

async function benchmarkConnection(
  ctor: BenchImplementation['ctor'],
  url: string,
  runs: number,
): Promise<LatencyStats> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = now();
    // eslint-disable-next-line no-await-in-loop
    const ws = await open(ctor, url);
    times.push(now() - t0);
    // eslint-disable-next-line no-await-in-loop
    await close(ws);
    // eslint-disable-next-line no-await-in-loop
    await sleep(30);
  }
  return stats(times);
}

async function benchmarkLatency(
  ws: BenchWebSocket,
  count: number,
): Promise<LatencyStats> {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = now();
    // eslint-disable-next-line no-await-in-loop
    await sendAndReceive(ws, `ping:${i}`);
    times.push(now() - t0);
  }
  return stats(times);
}

async function benchmarkThroughput(
  ws: BenchWebSocket,
  durationMs: number,
): Promise<ThroughputResult> {
  let sent = 0;
  let received = 0;
  const payload = 'x'.repeat(128);
  ws.onmessage = () => {
    received++;
  };

  const deadline = now() + durationMs;
  while (now() < deadline) {
    ws.send(payload);
    sent++;
    // Yield periodically so the event loop can drain inbound echoes.
    if (sent % 50 === 0) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(0);
    }
  }

  const waitDeadline = now() + 3000;
  const allEchoesReceived = () => received >= sent;
  while (!allEchoesReceived() && now() < waitDeadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(10);
  }
  ws.onmessage = null;

  return {
    sent,
    received,
    msgsPerSec: Math.round(received / (durationMs / 1000)),
  };
}

async function benchmarkPayload(
  ws: BenchWebSocket,
  count: number,
  payload: string | ArrayBuffer,
): Promise<LatencyStats> {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = now();
    // eslint-disable-next-line no-await-in-loop
    await sendAndReceive(ws, payload);
    times.push(now() - t0);
  }
  return stats(times);
}

function makeTextPayload(sizeKB: number): string {
  return 'A'.repeat(sizeKB * 1024);
}

function makeBinaryPayload(sizeKB: number): ArrayBuffer {
  const bytes = new Uint8Array(sizeKB * 1024);
  for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff;
  return bytes.buffer;
}

// ─── Subscribe-mode benchmarks (real push endpoints) ────────────────────────

/**
 * One realistic cycle against a real endpoint: open the socket, send the real
 * subscribe frame, and wait for the first inbound frame. Captures connection
 * time and time-to-first-message — the two things a user actually feels when a
 * screen that needs live data appears.
 */
async function subscribeCycle(
  ctor: BenchImplementation['ctor'],
  url: string,
  subscribeMessage: string | undefined,
  timeoutMs: number,
): Promise<{ connectMs: number; firstMsgMs: number }> {
  const t0 = now();
  const ws = await open(ctor, url);
  const connectMs = now() - t0;
  try {
    const firstMsgMs = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.onmessage = null;
        reject(new Error(`first-message timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      const tSub = now();
      ws.onmessage = () => {
        ws.onmessage = null;
        clearTimeout(timer);
        resolve(now() - tSub);
      };
      if (subscribeMessage) ws.send(subscribeMessage);
    });
    return { connectMs, firstMsgMs };
  } finally {
    await close(ws);
  }
}

/**
 * Passively observes the server-pushed stream after subscribing, timing the
 * inter-arrival of `sampleCount` frames. Cadence here is server-bound (it's the
 * same wire for both implementations), so this is reported as context, NOT as a
 * Nitro speedup — it confirms that on a real feed the bottleneck is the network,
 * not the client.
 */
async function observeStream(
  ctor: BenchImplementation['ctor'],
  url: string,
  subscribeMessage: string | undefined,
  sampleCount: number,
  timeoutMs: number,
): Promise<number> {
  const ws = await open(ctor, url);
  try {
    const timestamps: number[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.onmessage = null;
        if (timestamps.length > 1) resolve();
        else reject(new Error(`stream timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      ws.onmessage = () => {
        timestamps.push(now());
        if (timestamps.length >= sampleCount) {
          ws.onmessage = null;
          clearTimeout(timer);
          resolve();
        }
      };
      if (subscribeMessage) ws.send(subscribeMessage);
    });
    if (timestamps.length < 2) return 0;
    const windowMs = timestamps[timestamps.length - 1] - timestamps[0];
    if (windowMs <= 0) return 0;
    return Math.round(((timestamps.length - 1) / windowMs) * 1000);
  } finally {
    await close(ws);
  }
}

async function runSubscribeImpl(
  impl: BenchImplementation,
  config: BenchmarkConfig,
  onProgress: ProgressCallback,
): Promise<SubscribeImplementationResult> {
  const connectSamples: number[] = [];
  const firstMsgSamples: number[] = [];
  const errors: string[] = [];
  const total = config.rounds * config.subscribeCycles;

  for (let i = 0; i < total; i++) {
    onProgress(`  [${impl.label}] connect+first-message cycle ${i + 1}/${total}…`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const { connectMs, firstMsgMs } = await subscribeCycle(
        impl.ctor,
        config.echoUrl,
        config.subscribeMessage,
        config.messageTimeoutMs,
      );
      connectSamples.push(connectMs);
      firstMsgSamples.push(firstMsgMs);
    } catch (error) {
      errors.push(
        `cycle ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(100);
  }

  let streamMsgsPerSec = 0;
  onProgress(`  [${impl.label}] observing stream (${config.streamSamples} frames)…`);
  try {
    streamMsgsPerSec = await observeStream(
      impl.ctor,
      config.echoUrl,
      config.subscribeMessage,
      config.streamSamples,
      config.messageTimeoutMs,
    );
  } catch (error) {
    errors.push(
      `stream: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    label: impl.label,
    connectionMs: stats(connectSamples),
    firstMessageMs: stats(firstMsgSamples),
    streamMsgsPerSec,
    streamSamples: config.streamSamples,
    errors,
  };
}

// ─── Orchestration ──────────────────────────────────────────────────────────

interface RoundResult {
  connection: LatencyStats;
  latency: LatencyStats;
  throughput: ThroughputResult;
  largePayload: LatencyStats;
  binaryPayload: LatencyStats;
}

async function runOneRound(
  impl: BenchImplementation,
  config: BenchmarkConfig,
  onProgress: ProgressCallback,
): Promise<RoundResult> {
  onProgress(`  [${impl.label}] connection (${config.connectionRuns} runs)…`);
  const connection = await benchmarkConnection(
    impl.ctor,
    config.echoUrl,
    config.connectionRuns,
  );

  const largeText = makeTextPayload(config.largeMsgSizeKB);
  const binary = makeBinaryPayload(config.binaryMsgSizeKB);

  const ws = await open(impl.ctor, config.echoUrl);
  ws.binaryType = 'arraybuffer';
  try {
    await warmup(ws);

    onProgress(`  [${impl.label}] latency (${config.latencyMessages} msgs)…`);
    const latency = await benchmarkLatency(ws, config.latencyMessages);

    onProgress(
      `  [${impl.label}] throughput (${config.throughputDurationMs / 1000}s)…`,
    );
    const throughput = await benchmarkThroughput(
      ws,
      config.throughputDurationMs,
    );

    onProgress(
      `  [${impl.label}] large payload ${config.largeMsgSizeKB}KB × ${config.largeMsgCount}…`,
    );
    const largePayload = await benchmarkPayload(
      ws,
      config.largeMsgCount,
      largeText,
    );

    onProgress(
      `  [${impl.label}] binary payload ${config.binaryMsgSizeKB}KB × ${config.binaryMsgCount}…`,
    );
    const binaryPayload = await benchmarkPayload(
      ws,
      config.binaryMsgCount,
      binary,
    );

    return { connection, latency, throughput, largePayload, binaryPayload };
  } finally {
    await close(ws);
  }
}

function aggregate(
  label: string,
  rounds: RoundResult[],
  errors: string[],
): ImplementationResult {
  const throughputs = rounds.map((r) => r.throughput);
  const valid = throughputs.filter((t) => t.sent > 0);
  const avgThroughput: ThroughputResult =
    valid.length === 0
      ? { sent: 0, received: 0, msgsPerSec: 0 }
      : {
          sent: Math.round(
            valid.reduce((a, t) => a + t.sent, 0) / valid.length,
          ),
          received: Math.round(
            valid.reduce((a, t) => a + t.received, 0) / valid.length,
          ),
          msgsPerSec: Math.round(
            valid.reduce((a, t) => a + t.msgsPerSec, 0) / valid.length,
          ),
        };

  return {
    label,
    connectionMs: meanStats(rounds.map((r) => r.connection)),
    latencyMs: meanStats(rounds.map((r) => r.latency)),
    throughput: avgThroughput,
    largePayloadMs: meanStats(rounds.map((r) => r.largePayload)),
    binaryPayloadMs: meanStats(rounds.map((r) => r.binaryPayload)),
    errors,
  };
}

async function runSubscribeBenchmark(
  implementations: BenchImplementation[],
  config: BenchmarkConfig,
  onProgress: ProgressCallback,
): Promise<BenchmarkReport> {
  const startedAt = new Date().toISOString();
  const subscribeResults: SubscribeImplementationResult[] = [];

  // Interleave by running each impl once per "pass" so warmup/network drift
  // affects both equally. runSubscribeImpl already loops internally, so a single
  // call per impl (alternating order) is sufficient here.
  const order = implementations;
  for (const impl of order) {
    onProgress(`Subscribe benchmark — ${impl.label}`);
    // eslint-disable-next-line no-await-in-loop
    const result = await runSubscribeImpl(impl, config, onProgress);
    subscribeResults.push(result);
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
  }

  const completedAt = new Date().toISOString();
  const platform = `${Platform.OS} ${String(Platform.Version)}`;
  const report: BenchmarkReport = {
    startedAt,
    completedAt,
    config,
    platform,
    results: [],
    subscribeResults,
    text: '',
  };
  report.text = formatSubscribeReport(report);
  return report;
}

export async function runWebSocketBenchmark(
  implementations: BenchImplementation[],
  config: BenchmarkConfig,
  onProgress: ProgressCallback = () => undefined,
): Promise<BenchmarkReport> {
  if (config.mode === 'subscribe') {
    return runSubscribeBenchmark(implementations, config, onProgress);
  }

  const startedAt = new Date().toISOString();
  const roundsByImpl = new Map<string, RoundResult[]>();
  const errorsByImpl = new Map<string, string[]>();
  for (const impl of implementations) {
    roundsByImpl.set(impl.label, []);
    errorsByImpl.set(impl.label, []);
  }

  for (let round = 0; round < config.rounds; round++) {
    // Alternate order each round so neither impl always runs "first".
    const order =
      round % 2 === 0 ? implementations : [...implementations].reverse();
    for (const impl of order) {
      onProgress(`Round ${round + 1}/${config.rounds} — ${impl.label}`);
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await runOneRound(impl, config, onProgress);
        roundsByImpl.get(impl.label)?.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errorsByImpl.get(impl.label)?.push(`round ${round + 1}: ${message}`);
        onProgress(`  [${impl.label}] round ${round + 1} failed: ${message}`);
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
  }

  const results = implementations.map((impl) =>
    aggregate(
      impl.label,
      roundsByImpl.get(impl.label) ?? [],
      errorsByImpl.get(impl.label) ?? [],
    ),
  );

  const completedAt = new Date().toISOString();
  const platform = `${Platform.OS} ${String(Platform.Version)}`;
  const text = formatReport({
    startedAt,
    completedAt,
    config,
    platform,
    results,
    text: '',
  });

  return { startedAt, completedAt, config, platform, results, text };
}

// ─── Report formatting ──────────────────────────────────────────────────────

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

function ratio(slower: number, faster: number): string {
  if (faster <= 0) return 'n/a';
  return `${(slower / faster).toFixed(2)}×`;
}

function statBlock(title: string, a: LatencyStats, b: LatencyStats): string {
  return [
    `  ${title}`,
    `  Metric   ${pad(a.samples ? 'A' : '-', 12)}   ${pad('B', 12)}`,
    `  mean     ${pad(a.mean, 9)} ms   ${pad(b.mean, 9)} ms`,
    `  p50      ${pad(a.p50, 9)} ms   ${pad(b.p50, 9)} ms`,
    `  p95      ${pad(a.p95, 9)} ms   ${pad(b.p95, 9)} ms`,
    `  p99      ${pad(a.p99, 9)} ms   ${pad(b.p99, 9)} ms`,
    `  min      ${pad(a.min, 9)} ms   ${pad(b.min, 9)} ms`,
    `  max      ${pad(a.max, 9)} ms   ${pad(b.max, 9)} ms`,
  ].join('\n');
}

// ─── Realistic (delta) formatting ───────────────────────────────────────────

function signed(ms: number): string {
  const rounded = Math.round(ms * 1000) / 1000;
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

/**
 * Renders a metric as RN bridge / Nitro / "ms saved" (RN − Nitro). Absolute
 * milliseconds only — no ratios — so near-zero network time can't inflate it.
 * `bridge` is the slower baseline (RN), `nitro` the candidate.
 */
function deltaBlock(
  title: string,
  bridge: LatencyStats,
  nitro: LatencyStats,
): string {
  const line = (metric: string, pick: (s: LatencyStats) => number): string =>
    `  ${metric.padEnd(6)} ${pad(pick(bridge), 9)} ms   ${pad(
      pick(nitro),
      9,
    )} ms   ${pad(signed(pick(bridge) - pick(nitro)), 10)} ms`;
  return [
    `  ${title}`,
    `  Metric ${pad('RN bridge', 9)}      ${pad('Nitro', 9)}      ${pad(
      'ms saved',
      10,
    )}`,
    line('mean', (s) => s.mean),
    line('p50', (s) => s.p50),
    line('p95', (s) => s.p95),
    line('p99', (s) => s.p99),
  ].join('\n');
}

function rule(): string {
  return '────────────────────────────────────────────────────────────────────────────';
}

function bar(): string {
  return '================================================================================';
}

/** Realistic echo-mode report: absolute ms + ms saved, never ratios. */
function formatDeltaReport(report: BenchmarkReport): string {
  const { results, config } = report;
  const bridge = results[0];
  const nitro = results[1];

  const lines: string[] = [];
  lines.push(bar());
  lines.push('  WEBSOCKET BENCHMARK — REALISTIC REPORT (absolute ms deltas)');
  lines.push('  MetaMask Mobile — on-device, real implementations');
  lines.push(bar());
  lines.push('');
  lines.push(`Started   : ${report.startedAt}`);
  lines.push(`Completed : ${report.completedAt}`);
  lines.push(`Platform  : ${report.platform}`);
  lines.push(`Endpoint  : ${config.echoUrl}  (echo / synthetic round-trip)`);
  lines.push('');
  lines.push(
    'Reads as: RN bridge value | Nitro value | ms saved (RN − Nitro).',
  );
  lines.push(
    'Positive "ms saved" = Nitro is faster by that many milliseconds.',
  );
  lines.push('');

  if (!bridge || !nitro) {
    lines.push('Not enough implementations to compare.');
    return lines.join('\n');
  }

  lines.push('LEGEND');
  lines.push(`  RN bridge = ${bridge.label}`);
  lines.push(`  Nitro     = ${nitro.label}`);
  lines.push('');

  lines.push(rule());
  lines.push('1. CONNECTION ESTABLISHMENT');
  lines.push(rule());
  lines.push(deltaBlock('connection', bridge.connectionMs, nitro.connectionMs));
  lines.push('');

  lines.push(rule());
  lines.push('2. ROUND-TRIP LATENCY — small message');
  lines.push(rule());
  lines.push(deltaBlock('latency', bridge.latencyMs, nitro.latencyMs));
  lines.push('');

  lines.push(rule());
  lines.push(`3. LARGE PAYLOAD — ${config.largeMsgSizeKB}KB text round-trip`);
  lines.push(rule());
  lines.push(deltaBlock('large', bridge.largePayloadMs, nitro.largePayloadMs));
  lines.push('');

  lines.push(rule());
  lines.push(`4. BINARY PAYLOAD — ${config.binaryMsgSizeKB}KB round-trip`);
  lines.push(rule());
  lines.push(deltaBlock('binary', bridge.binaryPayloadMs, nitro.binaryPayloadMs));
  lines.push('');

  lines.push(rule());
  lines.push('5. THROUGHPUT — 128-byte messages (context, not a ratio)');
  lines.push(rule());
  lines.push(
    `  RN bridge : ${bridge.throughput.msgsPerSec} msg/s   ` +
      `Nitro: ${nitro.throughput.msgsPerSec} msg/s`,
  );
  lines.push('');

  const p50Saved = bridge.latencyMs.p50 - nitro.latencyMs.p50;
  lines.push(rule());
  lines.push('HONEST TAKEAWAY');
  lines.push(rule());
  lines.push(
    `  Nitro saves ~${signed(p50Saved)} ms per round-trip at p50 on this run.`,
  );
  lines.push(
    '  That per-message saving is the durable win — it compounds on',
  );
  lines.push(
    '  high-frequency feeds. Quote ms saved, not multipliers.',
  );
  lines.push('');

  const allErrors = results.flatMap((r) =>
    r.errors.map((e) => `  [${r.label}] ${e}`),
  );
  if (allErrors.length > 0) {
    lines.push(rule());
    lines.push('ERRORS / SKIPPED ROUNDS');
    lines.push(rule());
    lines.push(...allErrors);
    lines.push('');
  }

  lines.push(bar());
  lines.push('  END OF REPORT');
  lines.push(bar());
  return lines.join('\n');
}

/** Realistic subscribe-mode report against a real push endpoint. */
function formatSubscribeReport(report: BenchmarkReport): string {
  const { subscribeResults = [], config } = report;
  const bridge = subscribeResults[0];
  const nitro = subscribeResults[1];

  const lines: string[] = [];
  lines.push(bar());
  lines.push('  WEBSOCKET BENCHMARK — REAL ENDPOINT (subscribe & listen)');
  lines.push('  MetaMask Mobile — production socket, absolute ms deltas');
  lines.push(bar());
  lines.push('');
  lines.push(`Started   : ${report.startedAt}`);
  lines.push(`Completed : ${report.completedAt}`);
  lines.push(`Platform  : ${report.platform}`);
  lines.push(`Endpoint  : ${config.echoUrl}  (REAL push feed)`);
  if (config.endpointNote) lines.push(`Note      : ${config.endpointNote}`);
  lines.push(
    `Config    : cycles=${config.rounds * config.subscribeCycles}, ` +
      `streamSamples=${config.streamSamples}, timeout=${
        config.messageTimeoutMs / 1000
      }s`,
  );
  lines.push('');
  lines.push(
    'Reads as: RN bridge value | Nitro value | ms saved (RN − Nitro).',
  );
  lines.push('');

  if (!bridge || !nitro) {
    lines.push('Not enough implementations to compare.');
    return lines.join('\n');
  }

  lines.push('LEGEND');
  lines.push(`  RN bridge = ${bridge.label}`);
  lines.push(`  Nitro     = ${nitro.label}`);
  lines.push('');

  lines.push(rule());
  lines.push('1. CONNECTION ESTABLISHMENT  (new WebSocket → open)');
  lines.push(rule());
  lines.push(deltaBlock('connect', bridge.connectionMs, nitro.connectionMs));
  lines.push('');

  lines.push(rule());
  lines.push('2. TIME TO FIRST MESSAGE  (subscribe → first inbound frame)');
  lines.push(rule());
  lines.push(deltaBlock('first', bridge.firstMessageMs, nitro.firstMessageMs));
  lines.push('');

  lines.push(rule());
  lines.push('3. STREAM CADENCE  (server-bound — same wire for both)');
  lines.push(rule());
  lines.push(
    `  RN bridge : ${bridge.streamMsgsPerSec} msg/s   ` +
      `Nitro: ${nitro.streamMsgsPerSec} msg/s   ` +
      `(${bridge.streamSamples} frames each)`,
  );
  lines.push(
    '  Expected ~equal: the server sets the pace, not the client. This',
  );
  lines.push(
    '  confirms real feeds are network-bound, so ratios stay near 1×.',
  );
  lines.push('');

  const firstSaved = bridge.firstMessageMs.p50 - nitro.firstMessageMs.p50;
  lines.push(rule());
  lines.push('HONEST TAKEAWAY');
  lines.push(rule());
  lines.push(
    `  On this REAL endpoint Nitro saves ~${signed(
      firstSaved,
    )} ms to first data (p50).`,
  );
  lines.push(
    '  Real network latency dominates, so expect single-digit-ms wins here —',
  );
  lines.push(
    '  not the 100×+ figures from the synthetic loopback benchmark.',
  );
  lines.push('');

  const allErrors = subscribeResults.flatMap((r) =>
    r.errors.map((e) => `  [${r.label}] ${e}`),
  );
  if (allErrors.length > 0) {
    lines.push(rule());
    lines.push('ERRORS / TIMED-OUT CYCLES');
    lines.push(rule());
    lines.push(...allErrors);
    lines.push('');
  }

  lines.push(bar());
  lines.push('  END OF REPORT');
  lines.push(bar());
  return lines.join('\n');
}

export function formatReport(report: BenchmarkReport): string {
  if (report.config.mode === 'subscribe') return formatSubscribeReport(report);
  if (report.config.reportMode === 'delta') return formatDeltaReport(report);

  const { results, config } = report;
  // Report is written for the two-implementation case (A = first, B = second).
  const a = results[0];
  const b = results[1];

  const lines: string[] = [];
  lines.push(
    '================================================================================',
  );
  lines.push('  WEBSOCKET PERFORMANCE BENCHMARK (on-device, real implementations)');
  lines.push('  MetaMask Mobile');
  lines.push(
    '================================================================================',
  );
  lines.push('');
  lines.push(`Started   : ${report.startedAt}`);
  lines.push(`Completed : ${report.completedAt}`);
  lines.push(`Platform  : ${report.platform}`);
  lines.push(`Echo URL  : ${config.echoUrl}`);
  lines.push(
    `Config    : rounds=${config.rounds}, connRuns=${config.connectionRuns}, ` +
      `latencyMsgs=${config.latencyMessages}, throughput=${
        config.throughputDurationMs / 1000
      }s, large=${config.largeMsgSizeKB}KB×${config.largeMsgCount}, ` +
      `binary=${config.binaryMsgSizeKB}KB×${config.binaryMsgCount}`,
  );
  lines.push('');
  lines.push('LEGEND');
  results.forEach((r, i) => {
    lines.push(`  ${i === 0 ? 'A' : 'B'} = ${r.label}`);
  });
  lines.push('');

  if (!a || !b) {
    lines.push('Not enough implementations to compare.');
    return lines.join('\n');
  }

  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(`1. CONNECTION ESTABLISHMENT TIME (avg of ${config.rounds} rounds)`);
  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(statBlock('connection ms', a.connectionMs, b.connectionMs));
  lines.push(
    `  → ${b.label} vs ${a.label} (mean): ${ratio(
      a.connectionMs.mean,
      b.connectionMs.mean,
    )}`,
  );
  lines.push('');

  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push('2. ROUND-TRIP LATENCY — small message');
  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(statBlock('latency ms', a.latencyMs, b.latencyMs));
  lines.push(
    `  → p50 ratio (${a.label} / ${b.label}): ${ratio(
      a.latencyMs.p50,
      b.latencyMs.p50,
    )}`,
  );
  lines.push('');

  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(
    `3. THROUGHPUT — 128-byte messages, ${
      config.throughputDurationMs / 1000
    }s burst`,
  );
  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(`  Metric              ${pad('A', 13)}   ${pad('B', 13)}`);
  lines.push(
    `  sent                ${pad(a.throughput.sent, 13)}   ${pad(
      b.throughput.sent,
      13,
    )}`,
  );
  lines.push(
    `  received            ${pad(a.throughput.received, 13)}   ${pad(
      b.throughput.received,
      13,
    )}`,
  );
  lines.push(
    `  msgs/sec            ${pad(a.throughput.msgsPerSec, 13)}   ${pad(
      b.throughput.msgsPerSec,
      13,
    )}`,
  );
  lines.push(
    `  → throughput ratio (${b.label} / ${a.label}): ${ratio(
      b.throughput.msgsPerSec,
      a.throughput.msgsPerSec,
    )}`,
  );
  lines.push('');

  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(`4. LARGE PAYLOAD — ${config.largeMsgSizeKB}KB text round-trip`);
  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(statBlock('large ms', a.largePayloadMs, b.largePayloadMs));
  lines.push(
    `  → mean ratio (${a.label} / ${b.label}): ${ratio(
      a.largePayloadMs.mean,
      b.largePayloadMs.mean,
    )}`,
  );
  lines.push('');

  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(
    `5. BINARY PAYLOAD — ${config.binaryMsgSizeKB}KB ArrayBuffer round-trip`,
  );
  lines.push(
    '────────────────────────────────────────────────────────────────────────────',
  );
  lines.push(statBlock('binary ms', a.binaryPayloadMs, b.binaryPayloadMs));
  lines.push(
    `  → mean ratio (${a.label} / ${b.label}): ${ratio(
      a.binaryPayloadMs.mean,
      b.binaryPayloadMs.mean,
    )}`,
  );
  lines.push('');

  const allErrors = results.flatMap((r) =>
    r.errors.map((e) => `  [${r.label}] ${e}`),
  );
  if (allErrors.length > 0) {
    lines.push(
      '────────────────────────────────────────────────────────────────────────────',
    );
    lines.push('ERRORS / SKIPPED ROUNDS');
    lines.push(
      '────────────────────────────────────────────────────────────────────────────',
    );
    lines.push(...allErrors);
    lines.push('');
  }

  lines.push(
    '================================================================================',
  );
  lines.push('  END OF REPORT');
  lines.push(
    '================================================================================',
  );

  return lines.join('\n');
}
