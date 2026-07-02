// Exposes the two REAL WebSocket implementations side-by-side for benchmarking.
//
//   - React Native's bridge-based WebSocket: captured at startup before the
//     global override (see app/core/NitroWebSocketSetup.ts), so we get the
//     original even though global.WebSocket now points at Nitro.
//   - NitroWebSocketAdapter: the native libwebsockets-over-JSI implementation
//     that ships in production.
import {
  NitroWebSocketAdapter,
  ReactNativeWebSocket,
} from '../NitroWebSocketSetup';
import { BenchImplementation, BenchWebSocketCtor } from './types';

/**
 * Returns the implementations that can be benchmarked on this device. The RN
 * bridge implementation is omitted if it could not be captured at startup.
 */
export function getBenchmarkImplementations(): BenchImplementation[] {
  const implementations: BenchImplementation[] = [];

  if (ReactNativeWebSocket) {
    implementations.push({
      label: 'RN WebSocket (bridge)',
      ctor: ReactNativeWebSocket as unknown as BenchWebSocketCtor,
    });
  }

  implementations.push({
    label: 'NitroWebSocket (JSI)',
    ctor: NitroWebSocketAdapter as unknown as BenchWebSocketCtor,
  });

  return implementations;
}
