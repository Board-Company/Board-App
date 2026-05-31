import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { EngineStatusTone } from '../../services/engineAnalysis';

type Props = {
  evalText: string;
  advantage?: string;
  whiteShare?: number;
  depth: number | null;
  loading?: boolean;
  error?: string | null;
  /** Short context label, e.g. "Live eval" or "Stockfish" */
  label?: string;
  statusLine?: string;
  statusTone?: EngineStatusTone;
  /** compact = single row; review = full Analysis card with eval bar */
  variant?: 'compact' | 'review';
  targetDepth?: number;
};

const toneColors: Record<EngineStatusTone, string> = {
  ok: '#8CB369',
  warn: '#E8B84A',
  error: '#E84855',
  neutral: '#AAB79B',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const EngineEvalBar = ({
  evalText,
  advantage = '',
  whiteShare = 50,
  depth,
  loading,
  error,
  label = 'Engine',
  statusLine,
  statusTone = 'neutral',
  variant = 'compact',
  targetDepth,
}: Props) => {
  const share = clamp(whiteShare, 0, 100);
  const depthLabel =
    depth != null && !error
      ? `d${depth}${targetDepth != null && depth < targetDepth ? ` / d${targetDepth}` : ''}`
      : targetDepth != null
        ? `d${targetDepth}`
        : null;

  if (variant === 'review') {
    return (
      <View style={styles.reviewCard}>
        <Text style={styles.reviewTitle}>Analysis</Text>
        <Text style={styles.reviewSubtitle}>{label}</Text>
        {statusLine ? (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: toneColors[statusTone] }]} />
            <Text style={[styles.statusLine, { color: toneColors[statusTone] }]}>{statusLine}</Text>
          </View>
        ) : null}
        <View style={styles.reviewHeader}>
          <View style={styles.reviewEvalRow}>
            {loading ? (
              <ActivityIndicator size="small" color="#8CB369" style={styles.spinner} />
            ) : null}
            <Text style={styles.reviewEvalValue}>{error ? '—' : evalText}</Text>
          </View>
          <Text style={styles.reviewAdvantage}>{error ? 'Engine unavailable' : advantage}</Text>
        </View>
        <View style={styles.barLabels}>
          <Text style={styles.barPlayerLabel}>Black</Text>
          {depthLabel ? <Text style={styles.depthInline}>{depthLabel}</Text> : null}
          <Text style={styles.barPlayerLabel}>White</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barBlack, { width: `${100 - share}%` }]} />
          <View style={[styles.barWhite, { width: `${share}%` }]} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!error && !statusLine && loading ? (
          <Text style={styles.reviewHint}>Stockfish is analyzing this position…</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {loading ? <ActivityIndicator size="small" color="#8CB369" style={styles.spinner} /> : null}
        <Text style={styles.eval}>{error ? '—' : evalText}</Text>
        {depthLabel && !error ? <Text style={styles.depth}>{depthLabel}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#333333',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#435C33',
  },
  label: {
    color: '#8CB369',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  spinner: { marginRight: 4 },
  eval: { color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  depth: { color: '#C8D5B9', fontSize: 14, marginLeft: 'auto' },
  error: { color: '#E84855', fontSize: 11, marginTop: 6 },
  reviewCard: {
    backgroundColor: '#333333',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#435C33',
  },
  reviewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  reviewSubtitle: {
    color: '#8CB369',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
  statusLine: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 12,
  },
  reviewEvalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewEvalValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  reviewAdvantage: {
    color: '#8CB369',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  barPlayerLabel: { color: '#C8D5B9', fontSize: 12, fontWeight: '700' },
  depthInline: { color: '#AAB79B', fontSize: 12, fontWeight: '600' },
  barTrack: {
    width: '100%',
    height: 18,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#4A4A4A',
    flexDirection: 'row',
  },
  barWhite: { height: '100%', backgroundColor: '#F2F2F2' },
  barBlack: { height: '100%', backgroundColor: '#1A1A1A' },
  reviewHint: {
    color: '#AAB79B',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});

export default EngineEvalBar;
