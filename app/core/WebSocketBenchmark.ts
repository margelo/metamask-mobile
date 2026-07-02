/**
 * WebSocket Benchmark — runs INSIDE React Native.
 *
 * This is the only benchmark that produces ground-truth results because it
 * runs both WebSocket implementations in the actual RN runtime:
 *
 *   OriginalRNWebSocket  — the bridge-based WebSocket React Native ships with.
 *                          Every send/receive serialises across the JS bridge
 *                          (Hermes/JSC ↔ native thread). This is what the app
 *                          used BEFORE NitroWebSocket was introduced.
 *
 *   NitroWebSocketAdapter — C++ libwebsockets exposed via Nitro's JSI binding.
 *                           The C++ callback fires directly into the JS runtime
 *                           with zero serialisation and zero thread hops.
 *
 * HOW TO RUN
 * ──────────
 * 1. Start a local echo server on your dev machine (port 18765):
 *      node scripts/websocket-benchmark.js --echo-only
 *    Or just start any ws echo server:
 *      npx wscat --listen 18765
 *
 * 2. Import and call from a component, dev-menu action, or Metro console:
 *      import { runWebSocketBenchmark } from 'app/core/WebSocketBenchmark';
 *      runWebSocketBenchmark().then((report) => {
 *        console.log(report);
 *        // Or copy to clipboard, write to a file, etc.
 *      });
 *
 * 3. Echo server URL:
 *      iOS simulator   → ws://localhost:18765   (connects to Mac directly)
 *      Android emulator → ws://10.0.2.2:18765   (10.0.2.2 = host machine)
 *      Real device     → ws://<your-mac-local-ip>:18765
 *
 * MESSAGE FORMATS
 * ───────────────
 * All scenarios use real MetaMask message formats from:
 *   app/components/UI/Predict/providers/polymarket/WebSocketManager.ts
 *   app/components/UI/Perps/services/PerpsConnectionManager.ts
 */

import performance from 'react-native-performance';
import { OriginalRNWebSocket, NitroWebSocketAdapter } from './NitroWebSocketSetup';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_ECHO_SERVER = __DEV__
  ? 'ws://localhost:18765'       // iOS simulator / Android emulator (use 10.0.2.2 for Android)
  : undefined;

const N = {
  coldStartRuns:   20,
  priceStreamMsgs: 100,
  orderbookMsgs:    30,
  heartbeats:       15,
  reconnectRuns:    10,
  batchTokens:      30,
  batchRuns:        20,
  // Feature-mapped scenarios
  chartRuns:        15,   // chart initial-load (graph payload) round-trips
  chartPoints:     500,   // candles in the historical series (~chart on open)
  perpsPriceMsgs:  100,   // Perps allMids live-price stream
  perpsBookMsgs:    30,   // Perps l2Book full-depth burst
  perpsBookRuns:     5,
  rtdsRuns:         20,   // RTDS crypto price time-to-first-data
  rtdsStreamMsgs:  100,   // RTDS crypto price stream
};

// ─── Real MetaMask message fixtures ──────────────────────────────────────────

function makePriceChangeMsg(tokenIds: string[]): string {
  return JSON.stringify({
    event_type: 'price_change',
    market: 'polymarket-eth-wins-q4',
    price_changes: tokenIds.map((id, i) => ({
      asset_id: id,
      price:    (0.45 + i * 0.03).toFixed(4),
      best_bid: (0.44 + i * 0.03).toFixed(4),
      best_ask: (0.46 + i * 0.03).toFixed(4),
    })),
    timestamp: new Date().toISOString(),
  });
}

function makeOrderbookMsg(tokenId: string): string {
  return JSON.stringify({
    event_type: 'book',
    market: 'polymarket-eth-wins-q4',
    asset_id: tokenId,
    bids: Array.from({ length: 10 }, (_, i) => ({
      price: (0.50 - i * 0.01).toFixed(4),
      size: String(100 + i * 20),
    })),
    asks: Array.from({ length: 10 }, (_, i) => ({
      price: (0.51 + i * 0.01).toFixed(4),
      size: String(80 + i * 15),
    })),
    timestamp: new Date().toISOString(),
  });
}

function makeRtdsPriceMsg(symbol: string): string {
  const v = symbol === 'btc/usd' ? 67234.5 : 3420.1;
  return JSON.stringify({
    topic: 'crypto_prices_chainlink',
    type: 'update',
    timestamp: Math.floor(Date.now() / 1000),
    payload: { symbol, timestamp: Math.floor(Date.now() / 1000) + 1, value: v },
  });
}

const MARKET_SUBSCRIBE = (ids: string[]) =>
  JSON.stringify({ type: 'market', assets_ids: ids });

const RTDS_SUBSCRIBE = (symbols: string[]) =>
  JSON.stringify({
    action: 'subscribe',
    subscriptions: symbols.map((s) => ({
      topic: 'crypto_prices_chainlink',
      type: 'update',
      filters: JSON.stringify({ symbol: s }),
    })),
  });

// Chart / graph INITIAL LOAD — historical price series (candlesticks) the app
// renders when a price chart first opens. One big message → first paint of the
// graph. This is the payload a Predict/Perps chart screen waits on.
function makeChartSeriesMsg(points: number): string {
  const start = Math.floor(Date.now() / 1000);
  const series = Array.from({ length: points }, (_, i) => {
    const base = 0.45 + Math.sin(i / 12) * 0.05;
    return {
      t: start - (points - i) * 60,
      o: +base.toFixed(4),
      h: +(base + 0.012).toFixed(4),
      l: +(base - 0.011).toFixed(4),
      c: +(base + 0.003).toFixed(4),
      v: 1000 + i * 7,
    };
  });
  return JSON.stringify({ event_type: 'history', interval: '1m', series });
}

// Perps (HyperLiquid) — live mid prices for every market (allMids channel).
// Powers the Perps markets list price ticker.
function makePerpsAllMidsMsg(): string {
  const coins = [
    'BTC', 'ETH', 'SOL', 'ARB', 'AVAX', 'OP', 'MATIC', 'LINK',
    'DOGE', 'SUI', 'APT', 'INJ', 'TIA', 'SEI', 'LTC',
  ];
  const mids: Record<string, string> = {};
  coins.forEach((c, i) => {
    mids[c] = (100 + i * 37.45).toFixed(2);
  });
  return JSON.stringify({ channel: 'allMids', data: { mids } });
}

// Perps (HyperLiquid) — full L2 order book for a coin (l2Book channel).
// Powers the Perps order book / depth view.
function makePerpsL2BookMsg(coin: string): string {
  const level = (px: number, sz: number) => ({
    px: px.toFixed(1),
    sz: sz.toFixed(4),
    n: 3,
  });
  const bids = Array.from({ length: 10 }, (_, i) => level(67000 - i * 5, 0.5 + i * 0.1));
  const asks = Array.from({ length: 10 }, (_, i) => level(67005 + i * 5, 0.4 + i * 0.1));
  return JSON.stringify({
    channel: 'l2Book',
    data: { coin, time: Date.now(), levels: [bids, asks] },
  });
}

const PERPS_ALLMIDS_SUBSCRIBE = JSON.stringify({
  method: 'subscribe',
  subscription: { type: 'allMids' },
});

const PERPS_L2BOOK_SUBSCRIBE = (coin: string) =>
  JSON.stringify({ method: 'subscribe', subscription: { type: 'l2Book', coin } });

const CHART_HISTORY_REQUEST = JSON.stringify({
  event_type: 'history_request',
  interval: '1m',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

function percentile(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

interface Stats {
  mean: number; p50: number; p95: number; p99: number; min: number; max: number;
}

function stats(samples: number[]): Stats {
  const s = [...samples].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    mean: +mean.toFixed(3),
    p50:  +percentile(s, 50).toFixed(3),
    p95:  +percentile(s, 95).toFixed(3),
    p99:  +percentile(s, 99).toFixed(3),
    min:  +s[0].toFixed(3),
    max:  +s[s.length - 1].toFixed(3),
  };
}

// ─── WebSocket abstraction ────────────────────────────────────────────────────
// Wraps both implementations behind the same interface so benchmark code is
// identical for both — ensuring a fair comparison.

type WSConstructor = typeof WebSocket;

interface WsHandle {
  send(data: string): void;
  close(): Promise<void>;
  /** Register handler BEFORE calling send to avoid losing messages that arrive
   *  in the same synchronous flush as the response. Resolves when n messages
   *  have been received; calls onFirst(data) for the very first one. */
  onN(n: number, onFirst?: (data: string) => void): Promise<void>;
  once(): Promise<string>;
}

function openSocket(Ctor: WSConstructor, url: string): Promise<WsHandle> {
  return new Promise((resolve, reject) => {
    const ws = new Ctor(url);
    let messageListeners: Array<(data: string) => void> = [];

    ws.onmessage = (e: MessageEvent) => {
      // Dispatch to all registered listeners (handles the "register before send" pattern)
      for (const fn of messageListeners) fn(e.data as string);
    };

    ws.onerror = (e: Event) => reject(e);
    ws.onopen  = () => {
      resolve({
        send(data: string) { ws.send(data); },

        close() {
          return new Promise((r) => { ws.onclose = r; ws.close(); });
        },

        onN(n: number, onFirst?: (data: string) => void): Promise<void> {
          return new Promise((r) => {
            let count = 0;
            const listener = (data: string) => {
              if (count === 0 && onFirst) onFirst(data);
              if (++count >= n) {
                messageListeners = messageListeners.filter((l) => l !== listener);
                r();
              }
            };
            messageListeners.push(listener);
          });
        },

        once(): Promise<string> {
          return new Promise((r) => {
            const listener = (data: string) => {
              messageListeners = messageListeners.filter((l) => l !== listener);
              r(data);
            };
            messageListeners.push(listener);
          });
        },
      });
    };
  });
}

// ─── Reusable feature measurements ──────────────────────────────────────────
// Small, composable helpers so each app-feature scenario reads as one line.

/**
 * Time-to-first-data: connect, send one request/subscribe frame, measure until
 * the first response arrives. This is what a screen waits on before it can
 * render real data (price, chart, book…). Averaged over `runs`.
 */
async function measureTtfd(
  Ctor: WSConstructor,
  url: string,
  message: string,
  runs: number,
): Promise<Stats> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ws = await openSocket(Ctor, url);
    const t0 = performance.now();
    const done = ws.once();
    ws.send(message);
    // eslint-disable-next-line no-await-in-loop
    await done;
    times.push(performance.now() - t0);
    // eslint-disable-next-line no-await-in-loop
    await ws.close();
    // eslint-disable-next-line no-await-in-loop
    await sleep(10);
  }
  return stats(times);
}

/**
 * Per-message average latency across a burst of `msgs` identical frames,
 * repeated over `runs` connections. Models a high-frequency feed (order book,
 * live prices) where many updates land back-to-back.
 */
async function measureBurstPerMsg(
  Ctor: WSConstructor,
  url: string,
  message: string,
  msgs: number,
  runs: number,
): Promise<Stats> {
  const perMsg: number[] = [];
  for (let run = 0; run < runs; run++) {
    // eslint-disable-next-line no-await-in-loop
    const ws = await openSocket(Ctor, url);
    const t0 = performance.now();
    const done = ws.onN(msgs);
    for (let i = 0; i < msgs; i++) ws.send(message);
    // eslint-disable-next-line no-await-in-loop
    await done;
    perMsg.push((performance.now() - t0) / msgs);
    // eslint-disable-next-line no-await-in-loop
    await ws.close();
    // eslint-disable-next-line no-await-in-loop
    await sleep(20);
  }
  return stats(perMsg);
}

/**
 * Sustained throughput over a single connection: blast `msgs` frames and time
 * how long until all echoes return. Reports total time + messages/second.
 */
async function measureThroughput(
  Ctor: WSConstructor,
  url: string,
  message: string,
  msgs: number,
): Promise<{ totalMs: number; msgsPerSec: number }> {
  const ws = await openSocket(Ctor, url);
  const t0 = performance.now();
  const done = ws.onN(msgs);
  for (let i = 0; i < msgs; i++) ws.send(message);
  await done;
  const totalMs = performance.now() - t0;
  await ws.close();
  return {
    totalMs: +totalMs.toFixed(2),
    msgsPerSec: Math.round(msgs / (totalMs / 1000)),
  };
}

// ─── Benchmark scenarios ──────────────────────────────────────────────────────

interface Throughput {
  totalMs: number;
  msgsPerSec: number;
}

interface ScenarioResults {
  coldStart:   { rn: Stats; nitro: Stats };
  orderbook:   { rn: Stats; nitro: Stats };
  heartbeat:   { rn: Stats; nitro: Stats };
  reconnect:   { rn: Stats; nitro: Stats };
  batchSub:    { rn: Stats; nitro: Stats };
  priceStream: { rn: Throughput; nitro: Throughput };
  // Feature-mapped scenarios
  chartLoad:    { rn: Stats; nitro: Stats };               // Charts: graph initial load (ttfd)
  perpsPrices:  { rn: Throughput; nitro: Throughput };     // Perps: live price stream
  perpsBook:    { rn: Stats; nitro: Stats };               // Perps: order book per-msg
  rtdsTtfd:     { rn: Stats; nitro: Stats };               // RTDS crypto: time-to-first-price
  rtdsStream:   { rn: Throughput; nitro: Throughput };     // RTDS crypto: price stream
}

/**
 * Runs a single scenario against both WebSocket implementations.
 * The echo server must be running before calling this function.
 *
 * @param echoUrl - WebSocket echo server URL (e.g. 'ws://localhost:18765').
 *                  The server must echo back every message it receives.
 */
async function runAllScenarios(
  echoUrl: string,
  onProgress?: (msg: string) => void,
): Promise<ScenarioResults> {
  const log = onProgress ?? ((m: string) => console.log('[WS Bench]', m));

  const TOKENS10 = Array.from({ length: 10 }, (_, i) => `tok-${i}`);
  const PRICE_MSG = makePriceChangeMsg(TOKENS10);
  const OB_MSG    = makeOrderbookMsg('tok-0');
  const SUB_MSG   = MARKET_SUBSCRIBE(TOKENS10);
  const BATCH_SUB = MARKET_SUBSCRIBE(
    Array.from({ length: N.batchTokens }, (_, i) => `polymarket-token-${i}`)
  );

  const rnCtor    = OriginalRNWebSocket as WSConstructor;
  const nitroCtor = NitroWebSocketAdapter as unknown as WSConstructor;

  if (!rnCtor) {
    throw new Error(
      'OriginalRNWebSocket is undefined. ' +
      'Make sure this module is imported AFTER NitroWebSocketSetup has run, ' +
      'but OriginalRNWebSocket must have been captured BEFORE Nitro installed itself. ' +
      'Check the import order in NitroWebSocketSetup.ts.'
    );
  }

  // ── 1. Cold-start latency: subscribe → first price message ─────────────────
  log(`Cold-start latency ×${N.coldStartRuns} (subscribe → first price msg)…`);

  const coldStartRN:    number[] = [];
  const coldStartNitro: number[] = [];

  for (let i = 0; i < N.coldStartRuns; i++) {
    // RN bridge — send one price msg, measure time until echo arrives
    const ws = await openSocket(rnCtor, echoUrl);
    const t0 = performance.now();
    const done = ws.once();
    ws.send(PRICE_MSG);
    await done;
    coldStartRN.push(performance.now() - t0);
    await ws.close();
    await sleep(10);
  }

  for (let i = 0; i < N.coldStartRuns; i++) {
    // Nitro JSI — same: send one price msg, measure time until echo arrives
    const ws = await openSocket(nitroCtor, echoUrl);
    const t0 = performance.now();
    const done = ws.once();
    ws.send(PRICE_MSG);
    await done;
    coldStartNitro.push(performance.now() - t0);
    await ws.close();
    await sleep(10);
  }

  // ── 2. Price stream throughput ──────────────────────────────────────────────
  log(`Price stream: ${N.priceStreamMsgs} msgs (${PRICE_MSG.length}B each)…`);

  const ws_rn = await openSocket(rnCtor, echoUrl);
  const t_rn = performance.now();
  const doneRN = ws_rn.onN(N.priceStreamMsgs);
  for (let i = 0; i < N.priceStreamMsgs; i++) ws_rn.send(PRICE_MSG);
  await doneRN;
  const rnStreamMs = performance.now() - t_rn;
  await ws_rn.close();

  const ws_ni = await openSocket(nitroCtor, echoUrl);
  const t_ni = performance.now();
  const doneNI = ws_ni.onN(N.priceStreamMsgs);
  for (let i = 0; i < N.priceStreamMsgs; i++) ws_ni.send(PRICE_MSG);
  await doneNI;
  const nitroStreamMs = performance.now() - t_ni;
  await ws_ni.close();

  // ── 3. Orderbook burst (50 msgs × 640 bytes) ───────────────────────────────
  log(`Orderbook burst: ${N.orderbookMsgs} msgs (${OB_MSG.length}B each)…`);

  const obRN:    number[] = [];
  const obNitro: number[] = [];

  for (let run = 0; run < 5; run++) {
    const ws = await openSocket(rnCtor, echoUrl);
    const t0 = performance.now();
    const done = ws.onN(N.orderbookMsgs);
    for (let i = 0; i < N.orderbookMsgs; i++) ws.send(OB_MSG);
    await done;
    obRN.push((performance.now() - t0) / N.orderbookMsgs);
    await ws.close();
    await sleep(20);
  }

  for (let run = 0; run < 5; run++) {
    const ws = await openSocket(nitroCtor, echoUrl);
    const t0 = performance.now();
    const done = ws.onN(N.orderbookMsgs);
    for (let i = 0; i < N.orderbookMsgs; i++) ws.send(OB_MSG);
    await done;
    obNitro.push((performance.now() - t0) / N.orderbookMsgs);
    await ws.close();
    await sleep(20);
  }

  // ── 4. Heartbeat PING/PONG (text frame, round-trip) ───────────────────────
  log(`Heartbeat PING/PONG ×${N.heartbeats}…`);

  const hbRN:    number[] = [];
  const hbNitro: number[] = [];

  const wsHbRN = await openSocket(rnCtor, echoUrl);
  for (let i = 0; i < N.heartbeats; i++) {
    const t = performance.now();
    const done = wsHbRN.once();
    wsHbRN.send('ping');
    await done;
    hbRN.push(performance.now() - t);
    await sleep(5);
  }
  await wsHbRN.close();

  const wsHbNi = await openSocket(nitroCtor, echoUrl);
  for (let i = 0; i < N.heartbeats; i++) {
    const t = performance.now();
    const done = wsHbNi.once();
    wsHbNi.send('ping');
    await done;
    hbNitro.push(performance.now() - t);
    await sleep(5);
  }
  await wsHbNi.close();

  // ── 5. Reconnect recovery ──────────────────────────────────────────────────
  // We simulate reconnect by closing and immediately reopening with the same URL.
  // This measures connection establishment + first message latency, which is
  // what happens in reconnect scenarios in production.
  log(`Reconnect recovery ×${N.reconnectRuns}…`);

  const rcRN:    number[] = [];
  const rcNitro: number[] = [];

  for (let i = 0; i < N.reconnectRuns; i++) {
    const ws1 = await openSocket(rnCtor, echoUrl);
    ws1.send(PRICE_MSG);
    await ws1.once();
    await ws1.close(); // simulates disconnect

    // Reconnect: measure from close → open → first message
    const t0 = performance.now();
    const ws2 = await openSocket(rnCtor, echoUrl);
    const done = ws2.once();
    ws2.send(PRICE_MSG);
    await done;
    rcRN.push(performance.now() - t0);
    await ws2.close();
    await sleep(20);
  }

  for (let i = 0; i < N.reconnectRuns; i++) {
    const ws1 = await openSocket(nitroCtor, echoUrl);
    ws1.send(PRICE_MSG);
    await ws1.once();
    await ws1.close();

    const t0 = performance.now();
    const ws2 = await openSocket(nitroCtor, echoUrl);
    const done = ws2.once();
    ws2.send(PRICE_MSG);
    await done;
    rcNitro.push(performance.now() - t0);
    await ws2.close();
    await sleep(20);
  }

  // ── 6. Batch subscription (30 tokens, homepage load pattern) ──────────────
  log(`Batch subscription ×${N.batchRuns} (${N.batchTokens} tokens, ${BATCH_SUB.length}B)…`);

  const bsRN:    number[] = [];
  const bsNitro: number[] = [];

  for (let i = 0; i < N.batchRuns; i++) {
    const ws = await openSocket(rnCtor, echoUrl);
    const t0 = performance.now();
    const done = ws.once();
    ws.send(BATCH_SUB);
    await done;
    bsRN.push(performance.now() - t0);
    await ws.close();
  }

  for (let i = 0; i < N.batchRuns; i++) {
    const ws = await openSocket(nitroCtor, echoUrl);
    const t0 = performance.now();
    const done = ws.once();
    ws.send(BATCH_SUB);
    await done;
    bsNitro.push(performance.now() - t0);
    await ws.close();
  }

  // ── 7. CHARTS — graph initial load (history series → first chart paint) ────
  const CHART_MSG = makeChartSeriesMsg(N.chartPoints);
  log(`Charts: graph initial load ×${N.chartRuns} (${N.chartPoints} pts, ${CHART_MSG.length}B)…`);
  // Echo returns the same big payload, so this times "request → full series in
  // JS, ready to render" — exactly what a chart screen waits on.
  const chartRN = await measureTtfd(rnCtor, echoUrl, CHART_MSG, N.chartRuns);
  const chartNitro = await measureTtfd(nitroCtor, echoUrl, CHART_MSG, N.chartRuns);

  // ── 8. PERPS — live price stream (HyperLiquid allMids) ─────────────────────
  const PERPS_PRICE_MSG = makePerpsAllMidsMsg();
  log(`Perps: live price stream ${N.perpsPriceMsgs} msgs (${PERPS_PRICE_MSG.length}B)…`);
  const perpsPricesRN = await measureThroughput(rnCtor, echoUrl, PERPS_PRICE_MSG, N.perpsPriceMsgs);
  const perpsPricesNitro = await measureThroughput(nitroCtor, echoUrl, PERPS_PRICE_MSG, N.perpsPriceMsgs);

  // ── 9. PERPS — order book depth (HyperLiquid l2Book) ───────────────────────
  const PERPS_BOOK_MSG = makePerpsL2BookMsg('BTC');
  log(`Perps: order book burst ${N.perpsBookMsgs}×${N.perpsBookRuns} (${PERPS_BOOK_MSG.length}B)…`);
  const perpsBookRN = await measureBurstPerMsg(rnCtor, echoUrl, PERPS_BOOK_MSG, N.perpsBookMsgs, N.perpsBookRuns);
  const perpsBookNitro = await measureBurstPerMsg(nitroCtor, echoUrl, PERPS_BOOK_MSG, N.perpsBookMsgs, N.perpsBookRuns);

  // ── 10. RTDS — crypto price feed (time-to-first-price + stream) ────────────
  const RTDS_MSG = makeRtdsPriceMsg('btc/usd');
  log(`RTDS crypto: time-to-first-price ×${N.rtdsRuns} + stream ${N.rtdsStreamMsgs}…`);
  const rtdsTtfdRN = await measureTtfd(rnCtor, echoUrl, RTDS_MSG, N.rtdsRuns);
  const rtdsTtfdNitro = await measureTtfd(nitroCtor, echoUrl, RTDS_MSG, N.rtdsRuns);
  const rtdsStreamRN = await measureThroughput(rnCtor, echoUrl, RTDS_MSG, N.rtdsStreamMsgs);
  const rtdsStreamNitro = await measureThroughput(nitroCtor, echoUrl, RTDS_MSG, N.rtdsStreamMsgs);

  // Touch the otherwise-unused subscribe frames so they stay in sync with the
  // real app formats (and to document the exact handshake each feature uses).
  void PERPS_ALLMIDS_SUBSCRIBE;
  void PERPS_L2BOOK_SUBSCRIBE('BTC');
  void CHART_HISTORY_REQUEST;

  return {
    coldStart:   { rn: stats(coldStartRN),   nitro: stats(coldStartNitro) },
    orderbook:   { rn: stats(obRN),          nitro: stats(obNitro)        },
    heartbeat:   { rn: stats(hbRN),          nitro: stats(hbNitro)        },
    reconnect:   { rn: stats(rcRN),          nitro: stats(rcNitro)        },
    batchSub:    { rn: stats(bsRN),          nitro: stats(bsNitro)        },
    priceStream: {
      rn:    { totalMs: +rnStreamMs.toFixed(2),    msgsPerSec: Math.round(N.priceStreamMsgs / (rnStreamMs    / 1000)) },
      nitro: { totalMs: +nitroStreamMs.toFixed(2), msgsPerSec: Math.round(N.priceStreamMsgs / (nitroStreamMs / 1000)) },
    },
    chartLoad:   { rn: chartRN,        nitro: chartNitro       },
    perpsPrices: { rn: perpsPricesRN,  nitro: perpsPricesNitro },
    perpsBook:   { rn: perpsBookRN,    nitro: perpsBookNitro   },
    rtdsTtfd:    { rn: rtdsTtfdRN,     nitro: rtdsTtfdNitro    },
    rtdsStream:  { rn: rtdsStreamRN,   nitro: rtdsStreamNitro  },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BenchmarkOptions {
  /** WebSocket echo server URL. Defaults to ws://localhost:18765 in DEV. */
  echoUrl?: string;
  /** Called with progress messages during the run. Defaults to console.log. */
  onProgress?: (msg: string) => void;
}

/**
 * Run the full WebSocket benchmark inside React Native and return a formatted
 * report string with real ground-truth timings.
 *
 * @example
 * import { runWebSocketBenchmark } from 'app/core/WebSocketBenchmark';
 * runWebSocketBenchmark().then((report) => console.log(report));
 */
export async function runWebSocketBenchmark(
  options: BenchmarkOptions = {},
): Promise<string> {
  const echoUrl = options.echoUrl ?? DEFAULT_ECHO_SERVER;

  if (!echoUrl) {
    throw new Error(
      'echoUrl is required in production. ' +
      'Pass options.echoUrl with the address of a ws:// echo server.',
    );
  }

  if (!__DEV__) {
    // Safety guard — never run benchmark code in production builds.
    return 'WebSocket benchmark is only available in development builds.';
  }

  const startTs = new Date().toISOString();
  const log     = options.onProgress ?? ((m: string) => console.log('[WS Bench]', m));

  log(`Starting benchmark → ${echoUrl}`);
  log('This runs BOTH implementations in the real RN runtime — no simulation.');

  const r = await runAllScenarios(echoUrl, log);

  const endTs = new Date().toISOString();

  const su = (rn: number, nitro: number) =>
    nitro > 0 ? (rn / nitro).toFixed(2) + '×' : 'N/A';

  const row = (label: string, rnVal: unknown, nitroVal: unknown, speedup: string) =>
    `  ${label.padEnd(32)} ${String(rnVal).padStart(12)}   ${String(nitroVal).padStart(12)}   ${speedup}`;

  // Signed "ms saved" (RN − Nitro). Positive = Nitro faster. Honest absolute
  // number that, unlike a ratio, can't be inflated by a tiny denominator.
  const saved = (rn: number, nitro: number) => {
    const d = Math.round((rn - nitro) * 1000) / 1000;
    return `${d >= 0 ? '+' : ''}${d} ms`;
  };

  // One row of the FEATURE SHOWCASE: feature → UI surface → winner + amount.
  const feat = (
    feature: string,
    surface: string,
    rn: number,
    nitro: number,
    unit: 'ms' | 'msg/s',
  ) => {
    const faster = unit === 'ms' ? nitro < rn : nitro > rn;
    const winner = faster ? 'Nitro' : 'RN';
    const gain =
      unit === 'ms'
        ? `${saved(rn, nitro)} (${su(rn, nitro)})`
        : `+${(nitro - rn).toLocaleString()} msg/s (${su(nitro, rn)})`;
    return (
      `  ${feature.padEnd(26)} ${surface.padEnd(26)} ` +
      `${winner.padEnd(6)} ${gain}`
    );
  };

  const report = `
================================================================================
  METAMASK IN-APP WEBSOCKET BENCHMARK — GROUND TRUTH RESULTS
  Measured inside React Native runtime — real bridge vs real JSI timings
================================================================================

Run date   : ${startTs}
Completed  : ${endTs}
Echo server: ${echoUrl}
Note: These are REAL measurements. No bridge overhead simulation needed.
      RN WebSocket (bridge path) and NitroWebSocket (JSI path) both connect
      to the same echo server on the same device/simulator, so network
      conditions are identical. The ONLY variable is the implementation.

─── IMPLEMENTATIONS COMPARED ──────────────────────────────────────────────────

  RN WebSocket   — React Native's built-in bridge-based WebSocket.
                   Message path: JS → serialise → bridge → native → network
                                 network → native → bridge → deserialise → JS
                   Every send/receive crosses the bridge twice.

  NitroWebSocket — C++ libwebsockets exposed via Nitro JSI.
                   Message path: JS → JSI C++ call (zero-copy) → network
                                 network → C++ callback → JSI → JS (zero-copy)
                   Zero bridge crossings. Zero serialisation per message.

================================================================================
  MESSAGE LATENCY — Subscribe → first price_change received
  10-token batch price_change message  n=${N.coldStartRuns} runs
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.coldStart.rn.mean + ' ms', r.coldStart.nitro.mean + ' ms', su(r.coldStart.rn.mean, r.coldStart.nitro.mean))}
${row('p50',   r.coldStart.rn.p50  + ' ms', r.coldStart.nitro.p50  + ' ms', '')}
${row('p95',   r.coldStart.rn.p95  + ' ms', r.coldStart.nitro.p95  + ' ms', '')}
${row('p99',   r.coldStart.rn.p99  + ' ms', r.coldStart.nitro.p99  + ' ms', '')}
${row('Min',   r.coldStart.rn.min  + ' ms', r.coldStart.nitro.min  + ' ms', '')}
${row('Max',   r.coldStart.rn.max  + ' ms', r.coldStart.nitro.max  + ' ms', '')}

================================================================================
  PRICE STREAM THROUGHPUT — ${N.priceStreamMsgs} × price_change messages (${makePriceChangeMsg(['t0','t1','t2','t3','t4','t5','t6','t7','t8','t9']).length} bytes each)
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Total time',  r.priceStream.rn.totalMs + ' ms', r.priceStream.nitro.totalMs + ' ms', '')}
${row('Msgs / sec',  r.priceStream.rn.msgsPerSec, r.priceStream.nitro.msgsPerSec, (r.priceStream.nitro.msgsPerSec / Math.max(1, r.priceStream.rn.msgsPerSec)).toFixed(2) + '×')}

================================================================================
  ORDERBOOK BURST — ${N.orderbookMsgs} full-depth updates (${makeOrderbookMsg('t').length} bytes each)
  Per-message average over ${N.orderbookMsgs}-message burst  (5 runs)
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.orderbook.rn.mean + ' ms', r.orderbook.nitro.mean + ' ms', su(r.orderbook.rn.mean, r.orderbook.nitro.mean))}
${row('p50',   r.orderbook.rn.p50  + ' ms', r.orderbook.nitro.p50  + ' ms', '')}
${row('p95',   r.orderbook.rn.p95  + ' ms', r.orderbook.nitro.p95  + ' ms', '')}
${row('Min',   r.orderbook.rn.min  + ' ms', r.orderbook.nitro.min  + ' ms', '')}
${row('Max',   r.orderbook.rn.max  + ' ms', r.orderbook.nitro.max  + ' ms', '')}

================================================================================
  HEARTBEAT PING/PONG ROUND-TRIP — text frame (n=${N.heartbeats})
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.heartbeat.rn.mean + ' ms', r.heartbeat.nitro.mean + ' ms', su(r.heartbeat.rn.mean, r.heartbeat.nitro.mean))}
${row('p50',   r.heartbeat.rn.p50  + ' ms', r.heartbeat.nitro.p50  + ' ms', '')}
${row('p95',   r.heartbeat.rn.p95  + ' ms', r.heartbeat.nitro.p95  + ' ms', '')}
${row('Min',   r.heartbeat.rn.min  + ' ms', r.heartbeat.nitro.min  + ' ms', '')}
${row('Max',   r.heartbeat.rn.max  + ' ms', r.heartbeat.nitro.max  + ' ms', '')}

================================================================================
  RECONNECT RECOVERY — close → new connect → first message  (n=${N.reconnectRuns})
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.reconnect.rn.mean + ' ms', r.reconnect.nitro.mean + ' ms', su(r.reconnect.rn.mean, r.reconnect.nitro.mean))}
${row('p50',   r.reconnect.rn.p50  + ' ms', r.reconnect.nitro.p50  + ' ms', '')}
${row('p95',   r.reconnect.rn.p95  + ' ms', r.reconnect.nitro.p95  + ' ms', '')}
${row('Min',   r.reconnect.rn.min  + ' ms', r.reconnect.nitro.min  + ' ms', '')}
${row('Max',   r.reconnect.rn.max  + ' ms', r.reconnect.nitro.max  + ' ms', '')}

================================================================================
  BATCH SUBSCRIPTION — ${N.batchTokens}-token subscribe → first response  (n=${N.batchRuns})
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.batchSub.rn.mean + ' ms', r.batchSub.nitro.mean + ' ms', su(r.batchSub.rn.mean, r.batchSub.nitro.mean))}
${row('p50',   r.batchSub.rn.p50  + ' ms', r.batchSub.nitro.p50  + ' ms', '')}
${row('p95',   r.batchSub.rn.p95  + ' ms', r.batchSub.nitro.p95  + ' ms', '')}
${row('Min',   r.batchSub.rn.min  + ' ms', r.batchSub.nitro.min  + ' ms', '')}
${row('Max',   r.batchSub.rn.max  + ' ms', r.batchSub.nitro.max  + ' ms', '')}

================================================================================
  CHARTS — Graph initial load (history series → first chart paint)
  ${N.chartPoints}-point price series  n=${N.chartRuns} runs
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.chartLoad.rn.mean + ' ms', r.chartLoad.nitro.mean + ' ms', su(r.chartLoad.rn.mean, r.chartLoad.nitro.mean))}
${row('p50',   r.chartLoad.rn.p50  + ' ms', r.chartLoad.nitro.p50  + ' ms', '')}
${row('p95',   r.chartLoad.rn.p95  + ' ms', r.chartLoad.nitro.p95  + ' ms', '')}
${row('Min',   r.chartLoad.rn.min  + ' ms', r.chartLoad.nitro.min  + ' ms', '')}
${row('Max',   r.chartLoad.rn.max  + ' ms', r.chartLoad.nitro.max  + ' ms', '')}

================================================================================
  PERPS — Live price stream (HyperLiquid allMids)  ${N.perpsPriceMsgs} msgs
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Total time',  r.perpsPrices.rn.totalMs + ' ms', r.perpsPrices.nitro.totalMs + ' ms', '')}
${row('Msgs / sec',  r.perpsPrices.rn.msgsPerSec, r.perpsPrices.nitro.msgsPerSec, su(r.perpsPrices.nitro.msgsPerSec, r.perpsPrices.rn.msgsPerSec))}

================================================================================
  PERPS — Order book depth burst (HyperLiquid l2Book)
  Per-message average over ${N.perpsBookMsgs}-msg burst  (${N.perpsBookRuns} runs)
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.perpsBook.rn.mean + ' ms', r.perpsBook.nitro.mean + ' ms', su(r.perpsBook.rn.mean, r.perpsBook.nitro.mean))}
${row('p50',   r.perpsBook.rn.p50  + ' ms', r.perpsBook.nitro.p50  + ' ms', '')}
${row('p95',   r.perpsBook.rn.p95  + ' ms', r.perpsBook.nitro.p95  + ' ms', '')}
${row('Min',   r.perpsBook.rn.min  + ' ms', r.perpsBook.nitro.min  + ' ms', '')}
${row('Max',   r.perpsBook.rn.max  + ' ms', r.perpsBook.nitro.max  + ' ms', '')}

================================================================================
  RTDS CRYPTO — Time-to-first-price  n=${N.rtdsRuns} runs
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Mean',  r.rtdsTtfd.rn.mean + ' ms', r.rtdsTtfd.nitro.mean + ' ms', su(r.rtdsTtfd.rn.mean, r.rtdsTtfd.nitro.mean))}
${row('p50',   r.rtdsTtfd.rn.p50  + ' ms', r.rtdsTtfd.nitro.p50  + ' ms', '')}
${row('p95',   r.rtdsTtfd.rn.p95  + ' ms', r.rtdsTtfd.nitro.p95  + ' ms', '')}
${row('Min',   r.rtdsTtfd.rn.min  + ' ms', r.rtdsTtfd.nitro.min  + ' ms', '')}
${row('Max',   r.rtdsTtfd.rn.max  + ' ms', r.rtdsTtfd.nitro.max  + ' ms', '')}

================================================================================
  RTDS CRYPTO — Price stream throughput  ${N.rtdsStreamMsgs} msgs
================================================================================

${row('Metric', 'RN WebSocket', 'NitroWebSocket', 'Speedup')}
${row('─'.repeat(32), '─'.repeat(12), '─'.repeat(12), '─'.repeat(8))}
${row('Total time',  r.rtdsStream.rn.totalMs + ' ms', r.rtdsStream.nitro.totalMs + ' ms', '')}
${row('Msgs / sec',  r.rtdsStream.rn.msgsPerSec, r.rtdsStream.nitro.msgsPerSec, su(r.rtdsStream.nitro.msgsPerSec, r.rtdsStream.rn.msgsPerSec))}

================================================================================
  SUMMARY
================================================================================

  Scenario                          RN WebSocket    NitroWebSocket   Speedup
  ──────────────────────────────    ────────────    ──────────────   ───────
  Cold-start latency (mean)         ${String(r.coldStart.rn.mean + ' ms').padEnd(14)}  ${String(r.coldStart.nitro.mean + ' ms').padEnd(14)} ${su(r.coldStart.rn.mean, r.coldStart.nitro.mean)}
  Price stream (msg/s)              ${String(r.priceStream.rn.msgsPerSec + ' msg/s').padEnd(14)}  ${String(r.priceStream.nitro.msgsPerSec + ' msg/s').padEnd(14)} ${(r.priceStream.nitro.msgsPerSec / Math.max(1, r.priceStream.rn.msgsPerSec)).toFixed(2)}×
  Orderbook per-msg (mean)          ${String(r.orderbook.rn.mean + ' ms').padEnd(14)}  ${String(r.orderbook.nitro.mean + ' ms').padEnd(14)} ${su(r.orderbook.rn.mean, r.orderbook.nitro.mean)}
  Heartbeat RTT (mean)              ${String(r.heartbeat.rn.mean + ' ms').padEnd(14)}  ${String(r.heartbeat.nitro.mean + ' ms').padEnd(14)} ${su(r.heartbeat.rn.mean, r.heartbeat.nitro.mean)}
  Reconnect recovery (mean)         ${String(r.reconnect.rn.mean + ' ms').padEnd(14)}  ${String(r.reconnect.nitro.mean + ' ms').padEnd(14)} ${su(r.reconnect.rn.mean, r.reconnect.nitro.mean)}
  Batch subscription (mean)         ${String(r.batchSub.rn.mean + ' ms').padEnd(14)}  ${String(r.batchSub.nitro.mean + ' ms').padEnd(14)} ${su(r.batchSub.rn.mean, r.batchSub.nitro.mean)}

================================================================================
  FEATURE SHOWCASE — speed gained per app surface
  (winner + amount Nitro saves/gains; "ms" = lower is better)
================================================================================

  Feature                    UI surface                 Winner Gain
  ─────────────────────────  ─────────────────────────  ────── ──────────────────
${feat('Predict prices', 'Price ticker (1st data)', r.coldStart.rn.mean, r.coldStart.nitro.mean, 'ms')}
${feat('Predict prices', 'Live price stream', r.priceStream.rn.msgsPerSec, r.priceStream.nitro.msgsPerSec, 'msg/s')}
${feat('Predict orderbook', 'Depth view (per update)', r.orderbook.rn.mean, r.orderbook.nitro.mean, 'ms')}
${feat('Predict homepage', 'Batch subscribe (1st data)', r.batchSub.rn.mean, r.batchSub.nitro.mean, 'ms')}
${feat('Charts', 'Graph initial load', r.chartLoad.rn.mean, r.chartLoad.nitro.mean, 'ms')}
${feat('Perps prices', 'Markets list (stream)', r.perpsPrices.rn.msgsPerSec, r.perpsPrices.nitro.msgsPerSec, 'msg/s')}
${feat('Perps orderbook', 'Depth view (per update)', r.perpsBook.rn.mean, r.perpsBook.nitro.mean, 'ms')}
${feat('RTDS crypto', 'Price (1st data)', r.rtdsTtfd.rn.mean, r.rtdsTtfd.nitro.mean, 'ms')}
${feat('RTDS crypto', 'Price stream', r.rtdsStream.rn.msgsPerSec, r.rtdsStream.nitro.msgsPerSec, 'msg/s')}

  How to read this:
    • "ms" rows  → time to first data / per-update latency. Positive ms saved
      = users see prices/charts/books that many ms sooner with Nitro.
    • "msg/s" rows → sustained stream rate. Higher = smoother live updates
      under load (fewer dropped/queued frames).
    • Nitro's edge is biggest on HIGH-FREQUENCY streams (orderbook, live
      prices). For one-off first-data fetches the bridge can be as fast.

  ⚠ Measured against a localhost echo server in the simulator. Real servers add
    network latency (paid by BOTH), which compresses every ratio toward 1×; a
    physical device makes the bridge costlier, favouring Nitro. Use these for
    RELATIVE per-feature comparison, not absolute production latency.

================================================================================
  END OF IN-APP BENCHMARK REPORT
================================================================================
`.trimStart();

  log('Benchmark complete.');
  return report;
}
