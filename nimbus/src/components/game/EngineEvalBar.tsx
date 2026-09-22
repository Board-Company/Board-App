import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { EngineStatusTone } from '../../services/engineAnalysis';
import { colors } from '../../theme';

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
  /** compact = single row; review = full Analysis card; side = vertical bar beside the board */
  variant?: 'compact' | 'review' | 'side';
  targetDepth?: number;
  /** For side bar: flip so White is at the top (when playing Black). */
  flipped?: boolean;
  barHeight?: number;
};

const toneColors: Record<EngineStatusTone, string> = {
  ok: colors.accent,
  warn: colors.caution,
  error: colors.danger,
  neutral: colors.textMuted,
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
  flipped = false,
  barHeight = 280,
}: Props) => {
  const share = clamp(whiteShare, 0, 100);
  const blackShare = 100 - share;
  const depthLabel =
    depth != null && !error
      ? `d${depth}${targetDepth != null && depth < targetDepth ? ` / d${targetDepth}` : ''}`
      : targetDepth != null
        ? `d${targetDepth}`
        : null;

  if (variant === 'side') {
    const topShare = flipped ? share : blackShare;
    const bottomShare = flipped ? blackShare : share;
    const topColor = flipped ? colors.textPrimary : colors.backgroundSunken;
    const bottomColor = flipped ? colors.backgroundSunken : colors.textPrimary;
    const evalOnWhite = share >= 50;
    const evalAtBottom = flipped ? !evalOnWhite : evalOnWhite;
    const evalColor = evalOnWhite ? colors.backgroundBlack : colors.textPrimary;
    return (
      <View style={[styles.sideWrap, { height: barHeight }]}>
        <View style={styles.sideTrack}>
          <View style={[styles.sideSegment, { flex: Math.max(topShare, 0.8), backgroundColor: topColor }]} />
          <View style={[styles.sideSegment, { flex: Math.max(bottomShare, 0.8), backgroundColor: bottomColor }]} />
          <View
            pointerEvents="none"
            style={[styles.sideEvalInBar, evalAtBottom ? styles.sideEvalBottom : styles.sideEvalTop]}
          >
            {loading ? <ActivityIndicator size="small" color={evalColor} /> : null}
            <Text style={[styles.sideEvalInBarText, { color: evalColor }]}>{error ? '—' : evalText}</Text>
            {depthLabel ? <Text style={[styles.sideDepthInBar, { color: evalColor }]}>{depthLabel}</Text> : null}
          </View>
        </View>
      </View>
    );
  }

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
              <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} />
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
        {loading ? <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} /> : null}
        <Text style={styles.eval}>{error ? '—' : evalText}</Text>
        {depthLabel && !error ? <Text style={styles.depth}>{depthLabel}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  spinner: { marginRight: 4 },
  eval: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
  depth: { color: colors.textSecondary, fontSize: 14, marginLeft: 'auto' },
  error: { color: colors.danger, fontSize: 11, marginTop: 6 },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  reviewSubtitle: {
    color: colors.accent,
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
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  reviewAdvantage: {
    color: colors.accent,
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
  barPlayerLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  depthInline: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  barTrack: {
    width: '100%',
    height: 18,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.backgroundBlack,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    flexDirection: 'row',
  },
  barWhite: { height: '100%', backgroundColor: colors.textPrimary },
  barBlack: { height: '100%', backgroundColor: colors.backgroundSunken },
  reviewHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  sideWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTrack: {
    flex: 1,
    width: 22,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.backgroundBlack,
    borderWidth: 1,
    borderColor: colors.borderMuted,
  },
  sideSegment: {
    width: '100%',
  },
  sideEvalInBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
  },
  sideEvalTop: { top: 6 },
  sideEvalBottom: { bottom: 6 },
  sideEvalInBarText: {
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sideDepthInBar: {
    fontSize: 8,
    fontWeight: '700',
    opacity: 0.75,
  },
});

export default EngineEvalBar;
