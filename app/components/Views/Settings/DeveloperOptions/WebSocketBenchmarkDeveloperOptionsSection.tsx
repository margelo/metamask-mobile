import React, { useCallback, useRef, useState } from 'react';
import { Share, TextInput, View } from 'react-native';
import RNFS from 'react-native-fs';
import {
  Button,
  ButtonVariant,
  ButtonSize,
  Text,
  TextVariant,
  TextColor,
} from '@metamask/design-system-react-native';
import { useTheme } from '../../../../util/theme';
import { useStyles } from '../../../../component-library/hooks';
import styleSheet from './DeveloperOptions.styles';
import {
  DEFAULT_BENCHMARK_CONFIG,
  ENDPOINT_PRESETS,
  runWebSocketBenchmark,
  getBenchmarkImplementations,
  type EndpointPreset,
  type ReportMode,
} from '../../../../core/WebSocketBenchmark/index';

const MAX_LOG_LINES = 200;

/**
 * Dev-only harness that benchmarks React Native's bridge-based WebSocket against
 * the native NitroWebSocket (JSI) using the real implementations, on-device,
 * against a real echo endpoint. Results are rendered inline and can be written
 * to a .txt file + shared.
 */
export default function WebSocketBenchmarkDeveloperOptionsSection() {
  const theme = useTheme();
  const { styles } = useStyles(styleSheet, { theme });

  const [presetId, setPresetId] = useState<string>(ENDPOINT_PRESETS[0].id);
  const [echoUrl, setEchoUrl] = useState(ENDPOINT_PRESETS[0].url);
  const [reportMode, setReportMode] = useState<ReportMode>('delta');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [reportText, setReportText] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const reportRef = useRef<string | null>(null);

  const selectedPreset: EndpointPreset =
    ENDPOINT_PRESETS.find((p) => p.id === presetId) ?? ENDPOINT_PRESETS[0];

  const handleSelectPreset = useCallback((preset: EndpointPreset) => {
    setPresetId(preset.id);
    setEchoUrl(preset.url);
  }, []);

  const appendProgress = useCallback((message: string) => {
    setProgress((prev) => {
      const next = [...prev, message];
      return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
    });
  }, []);

  const writeReportToFile = useCallback(async (text: string) => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
    const fileName = `websocket-benchmark-${timestamp}.txt`;
    const destPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.writeFile(destPath, text, 'utf8');
    return destPath;
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress([]);
    setReportText(null);
    setSavedPath(null);
    reportRef.current = null;

    try {
      const config = {
        ...DEFAULT_BENCHMARK_CONFIG,
        echoUrl: echoUrl.trim(),
        mode: selectedPreset.mode,
        reportMode,
        subscribeMessage: selectedPreset.subscribeMessage,
        endpointNote: selectedPreset.note,
      };
      const implementations = getBenchmarkImplementations();

      appendProgress(
        `Starting ${config.mode} benchmark against ${config.echoUrl}…`,
      );
      const report = await runWebSocketBenchmark(
        implementations,
        config,
        appendProgress,
      );

      reportRef.current = report.text;
      setReportText(report.text);
      // Console output so it's visible in Metro / device logs too.
      // eslint-disable-next-line no-console
      console.log('\n' + report.text);

      try {
        const path = await writeReportToFile(report.text);
        setSavedPath(path);
        appendProgress(`Results written to: ${path}`);
      } catch (fileError) {
        const message =
          fileError instanceof Error ? fileError.message : String(fileError);
        appendProgress(`Failed to write results file: ${message}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appendProgress(`Benchmark failed: ${message}`);
    } finally {
      setIsRunning(false);
    }
  }, [
    appendProgress,
    echoUrl,
    isRunning,
    reportMode,
    selectedPreset,
    writeReportToFile,
  ]);

  const handleShare = useCallback(async () => {
    const text = reportRef.current;
    if (!text) return;
    try {
      if (savedPath) {
        await Share.share({ url: `file://${savedPath}`, message: text });
      } else {
        await Share.share({ message: text });
      }
    } catch {
      // User dismissed the share sheet, or sharing is unavailable.
    }
  }, [savedPath]);

  return (
    <>
      <Text
        color={TextColor.TextDefault}
        variant={TextVariant.HeadingLg}
        style={styles.heading}
      >
        WebSocket Benchmark
      </Text>
      <Text
        color={TextColor.TextAlternative}
        variant={TextVariant.BodyMd}
        style={styles.desc}
      >
        Compares React Native&apos;s bridge-based WebSocket against the native
        NitroWebSocket (JSI) on this device. Pick a real Predict/RTDS endpoint
        for production-representative numbers, or the echo server for synthetic
        round-trips. Realistic mode reports absolute ms saved (p50/p95/p99)
        instead of ratios. Results are saved to a .txt file you can share.
      </Text>

      <Text
        color={TextColor.TextDefault}
        variant={TextVariant.BodyMd}
        style={styles.heading}
      >
        Endpoint
      </Text>
      {ENDPOINT_PRESETS.map((preset) => (
        <Button
          key={preset.id}
          variant={
            preset.id === presetId
              ? ButtonVariant.Primary
              : ButtonVariant.Secondary
          }
          size={ButtonSize.Md}
          onPress={() => handleSelectPreset(preset)}
          isDisabled={isRunning}
          isFullWidth
          style={styles.accessory}
        >
          {preset.label}
        </Button>
      ))}
      {selectedPreset.note ? (
        <Text
          color={TextColor.TextAlternative}
          variant={TextVariant.BodySm}
          style={styles.desc}
        >
          {selectedPreset.note}
        </Text>
      ) : null}

      <TextInput
        value={echoUrl}
        onChangeText={setEchoUrl}
        editable={!isRunning}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="wss://…"
        placeholderTextColor={theme.colors.text.muted}
        style={styles.urlInput}
      />

      <Text
        color={TextColor.TextDefault}
        variant={TextVariant.BodyMd}
        style={styles.heading}
      >
        Reporting
      </Text>
      <Button
        variant={
          reportMode === 'delta'
            ? ButtonVariant.Primary
            : ButtonVariant.Secondary
        }
        size={ButtonSize.Md}
        onPress={() => setReportMode('delta')}
        isDisabled={isRunning}
        isFullWidth
        style={styles.accessory}
      >
        Realistic — ms saved (p50/p95/p99)
      </Button>
      <Button
        variant={
          reportMode === 'ratio'
            ? ButtonVariant.Primary
            : ButtonVariant.Secondary
        }
        size={ButtonSize.Md}
        onPress={() => setReportMode('ratio')}
        isDisabled={isRunning || selectedPreset.mode === 'subscribe'}
        isFullWidth
        style={styles.accessory}
      >
        Ratio — speedup × (echo only)
      </Button>

      <Button
        variant={ButtonVariant.Primary}
        size={ButtonSize.Lg}
        onPress={handleRun}
        isDisabled={isRunning}
        isFullWidth
        style={styles.accessory}
      >
        {isRunning ? 'Running…' : 'Run benchmark'}
      </Button>

      <Button
        variant={ButtonVariant.Secondary}
        size={ButtonSize.Lg}
        onPress={handleShare}
        isDisabled={isRunning || !reportText}
        isFullWidth
        style={styles.accessory}
      >
        Share results (.txt)
      </Button>

      {savedPath ? (
        <Text
          color={TextColor.TextAlternative}
          variant={TextVariant.BodySm}
          style={styles.desc}
        >
          Saved: {savedPath}
        </Text>
      ) : null}

      {progress.length > 0 ? (
        <View style={styles.panel}>
          {progress.map((line, index) => (
            <Text
              // eslint-disable-next-line react/no-array-index-key
              key={`${index}-${line}`}
              color={TextColor.TextAlternative}
              variant={TextVariant.BodyXs}
            >
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {reportText ? (
        <View style={styles.panel}>
          <Text color={TextColor.TextDefault} variant={TextVariant.BodyXs}>
            {reportText}
          </Text>
        </View>
      ) : null}
    </>
  );
}
