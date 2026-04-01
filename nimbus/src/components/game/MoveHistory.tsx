import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

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
    marginTop: 8,
  },
  historyContainerLight: {
    backgroundColor: 'white',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  historyContainerDark: {
    backgroundColor: '#333333',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#444444',
  },
  historyTitleLight: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  historyTitleDark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  movesList: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  moveHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  moveNumberLight: {
    color: '#4A90E2',
    fontSize: 14,
    marginRight: 4,
  },
  moveNumberDark: {
    color: '#8CB369',
    fontSize: 14,
    marginRight: 4,
  },
  moveHistoryTextLight: {
    color: 'black',
    fontSize: 14,
    marginRight: 8,
  },
  moveHistoryTextDark: {
    color: '#EAEAEA',
    fontSize: 14,
    marginRight: 8,
  },
});

export default React.memo(MoveHistory);
