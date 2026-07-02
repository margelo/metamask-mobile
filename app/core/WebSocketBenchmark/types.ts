// Shared types for the on-device WebSocket benchmark harness.
// Kept impl-agnostic so the same runner can drive React Native's bridge-based
// WebSocket and the native NitroWebSocket (libwebsockets via JSI) side-by-side.

export interface BenchWebSocketMessageEvent {
  data: string | ArrayBuffer;
}

/**
 * Minimal W3C-ish surface shared by RN's WebSocket and NitroWebSocketAdapter.
 * Both expose .onX handlers, send(), close() and a numeric readyState.
 */
export interface BenchWebSocket {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: BenchWebSocketMessageEvent) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  readyState: number;
  binaryType?: string;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
}

export type BenchWebSocketCtor = new (url: string) => BenchWebSocket;

export interface BenchImplementation {
  /** Short label used in the report, e.g. "RN WebSocket (bridge)". */
  label: string;
  ctor: BenchWebSocketCtor;
}

/**
 * How the benchmark drives the connection:
 *   'echo'      — round-trips against a server that echoes every frame back.
 *                 Good for isolating per-message overhead, but synthetic.
 *   'subscribe' — connects to a REAL push endpoint, sends a subscribe frame,
 *                 then measures connection time, time-to-first-message, and the
 *                 observed server-pushed stream. Reflects production behaviour.
 */
export type BenchmarkMode = 'echo' | 'subscribe';

/**
 * How results are presented:
 *   'delta' — REALISTIC. Shows absolute ms for each implementation plus the
 *             ms saved (RN bridge − Nitro) at mean/p50/p95/p99. No ratios, so
 *             near-zero network time can't inflate the headline.
 *   'ratio' — Legacy. Shows speedup multipliers (can look extreme when the
 *             denominator is tiny — see findings docs).
 */
export type ReportMode = 'delta' | 'ratio';

/**
 * A named real-world (or echo) endpoint the benchmark can target. Subscribe
 * presets carry the exact frame the app sends in production so the measured
 * "time to first message" matches real Predict/RTDS behaviour.
 */
export interface EndpointPreset {
  id: string;
  label: string;
  url: string;
  mode: BenchmarkMode;
  /** For subscribe mode: frame sent immediately after the socket opens. */
  subscribeMessage?: string;
  /** Plain-language caveat surfaced in the report (e.g. needs live IDs). */
  note?: string;
}

export interface BenchmarkConfig {
  /** Endpoint URL. In echo mode it must echo frames back. */
  echoUrl: string;
  /** Drives echo round-trips vs real subscribe-and-listen. */
  mode: BenchmarkMode;
  /** Presentation mode for the formatted report. */
  reportMode: ReportMode;
  /** subscribe mode: frame sent after open to start the data stream. */
  subscribeMessage?: string;
  /** subscribe mode: human-readable caveat copied from the preset. */
  endpointNote?: string;
  /** How many connect/close cycles to average for connection time. */
  connectionRuns: number;
  /** Ping-pong round trips per implementation for latency. */
  latencyMessages: number;
  /** Burst duration (ms) for the throughput test. */
  throughputDurationMs: number;
  /** Large-payload round trips. */
  largeMsgCount: number;
  /** KB per large payload. */
  largeMsgSizeKB: number;
  /** Binary-payload round trips. */
  binaryMsgCount: number;
  /** KB per binary payload. */
  binaryMsgSizeKB: number;
  /** Interleaved rounds — each round runs every implementation once. */
  rounds: number;
  /** subscribe mode: connect→subscribe→first-message cycles per round. */
  subscribeCycles: number;
  /** subscribe mode: server-pushed messages to observe for stream cadence. */
  streamSamples: number;
  /** subscribe mode: per-step timeout (connect, first message, stream). */
  messageTimeoutMs: number;
}

export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  // Postman's public raw echo server — echoes back every frame unchanged.
  echoUrl: 'wss://ws.postman-echo.com/raw',
  mode: 'echo',
  reportMode: 'delta',
  connectionRuns: 10,
  latencyMessages: 200,
  throughputDurationMs: 3000,
  largeMsgCount: 30,
  largeMsgSizeKB: 64,
  binaryMsgCount: 30,
  binaryMsgSizeKB: 64,
  rounds: 3,
  subscribeCycles: 8,
  streamSamples: 40,
  messageTimeoutMs: 10_000,
};

const RTDS_SYMBOLS = ['btc/usd', 'eth/usd', 'sol/usd', 'usdc/usd', 'bnb/usd'];

/**
 * Real production WebSocket endpoints used by the Predict feature, plus the
 * default echo server. URLs and subscribe frames mirror
 * app/components/UI/Predict/providers/polymarket/WebSocketManager.ts so the
 * "time to first message" measured here matches what users actually experience.
 */
export const ENDPOINT_PRESETS: EndpointPreset[] = [
  {
    id: 'echo',
    label: 'Echo (synthetic round-trip)',
    url: 'wss://ws.postman-echo.com/raw',
    mode: 'echo',
    note: 'Synthetic: server echoes frames. Isolates per-message overhead but is NOT real traffic.',
  },
  {
    id: 'rtds',
    label: 'Predict RTDS crypto feed (real)',
    url: 'wss://ws-live-data.polymarket.com',
    mode: 'subscribe',
    subscribeMessage: JSON.stringify({
      action: 'subscribe',
      subscriptions: RTDS_SYMBOLS.map((symbol) => ({
        topic: 'crypto_prices_chainlink',
        type: 'update',
        filters: JSON.stringify({ symbol }),
      })),
    }),
    note: 'Real public crypto price stream (no auth). Best realistic target — pushes updates continuously.',
  },
  {
    id: 'market',
    label: 'Predict market channel (real)',
    url: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
    mode: 'subscribe',
    subscribeMessage: JSON.stringify({ type: 'market', assets_ids: [] }),
    note: 'Real endpoint but needs LIVE token IDs to stream price_change; with an empty asset list it may only ack or time out.',
  },
];

export interface LatencyStats {
  samples: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ThroughputResult {
  sent: number;
  received: number;
  msgsPerSec: number;
}

/** Aggregated per-implementation result, averaged across rounds. */
export interface ImplementationResult {
  label: string;
  connectionMs: LatencyStats;
  latencyMs: LatencyStats;
  throughput: ThroughputResult;
  largePayloadMs: LatencyStats;
  binaryPayloadMs: LatencyStats;
  /** Non-fatal errors collected during the run (e.g. a failed round). */
  errors: string[];
}

/** Per-implementation result for subscribe (real-endpoint) mode. */
export interface SubscribeImplementationResult {
  label: string;
  /** Time from `new WebSocket()` to the `open` event. */
  connectionMs: LatencyStats;
  /** Time from sending the subscribe frame to the first inbound frame. */
  firstMessageMs: LatencyStats;
  /** Observed cadence of the server-pushed stream (server-bound, ~equal). */
  streamMsgsPerSec: number;
  /** Total inbound frames timed for the stream cadence figure. */
  streamSamples: number;
  /** Non-fatal errors collected during the run (e.g. a timed-out cycle). */
  errors: string[];
}

export interface BenchmarkReport {
  startedAt: string;
  completedAt: string;
  config: BenchmarkConfig;
  platform: string;
  /** Populated in echo mode. */
  results: ImplementationResult[];
  /** Populated in subscribe (real-endpoint) mode. */
  subscribeResults?: SubscribeImplementationResult[];
  /** Pre-formatted human-readable text report (also written to the .txt file). */
  text: string;
}

export type ProgressCallback = (message: string) => void;
