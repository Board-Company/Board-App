import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

interface MoveHistoryProps {
  moves: string[];
  /** Local games use light overlay; friend / dark screens use dark. */
  variant?: 'light' | 'dark';
  /** `overlay` = pinned to bottom (local). `inline` = flows in layout (friend, online). */
  layout?: 'overlay' | 'inline';
}

const MoveHistory: React.FC<MoveHistoryProps> = ({ moves, variant = 'light', layout = 'overlay' }) => {
  const theme = useMemo(() => {
    if (variant === 'dark') {
      return {
        container: styles.historyContainerDark,
        title: styles.historyTitleDark,
        moveNumber: styles.moveNumberDark,
        moveText: styles.moveHistoryTextDark,
      };
    }
    return {
      container: styles.historyContainerLight,
      title: styles.historyTitleLight,
      moveNumber: styles.moveNumberLight,
      moveText: styles.moveHistoryTextLight,
    };
  }, [variant]);

  const renderMoveHistory = () => {
    const moveElements = [];
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1] || '';
      moveElements.push(
        <View key={i} style={styles.moveHistoryItem}>
          <Text style={theme.moveNumber}>{moveNumber}.</Text>
          <Text style={theme.moveText}>{whiteMove}</Text>
          <Text style={theme.moveText}>{blackMove}</Text>
        </View>,
      );
    }
    return moveElements;
  };

  const containerStyle = [
    theme.container,
    layout === 'overlay' ? styles.historyOverlay : styles.historyInline,
  ];

  return (
    <View style={containerStyle}>
      <Text style={theme.title}>Move History</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.movesList}
      >
        {renderMoveHistory()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  historyOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  historyInline: {
    position: 'relative',
    marginTop: spacing.sm,
  },
  historyContainerLight: {
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.lightBorder,
  },
  historyContainerDark: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceRaised,
  },
  historyTitleLight: {
    color: colors.black,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  historyTitleDark: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  movesList: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
  },
  moveHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  moveNumberLight: {
    color: colors.info,
    fontSize: 14,
    marginRight: spacing.xs,
  },
  moveNumberDark: {
    color: colors.accent,
    fontSize: 14,
    marginRight: spacing.xs,
  },
  moveHistoryTextLight: {
    color: colors.black,
    fontSize: 14,
    marginRight: spacing.sm,
  },
  moveHistoryTextDark: {
    color: colors.textPrimary,
    fontSize: 14,
    marginRight: spacing.sm,
  },
});

export default React.memo(MoveHistory);
