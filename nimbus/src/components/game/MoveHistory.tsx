import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface MoveHistoryProps {
  moves: string[];
}

const MoveHistory: React.FC<MoveHistoryProps> = ({ moves }) => {
  const renderMoveHistory = () => {
    const moveElements = [];
    for (let i = 0; i < moves.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = moves[i];
      const blackMove = moves[i + 1] || '';
      moveElements.push(
        <View key={i} style={styles.moveHistoryItem}>
          <Text style={styles.moveNumber}>{moveNumber}.</Text>
          <Text style={styles.moveHistoryText}>{whiteMove}</Text>
          <Text style={styles.moveHistoryText}>{blackMove}</Text>
        </View>
      );
    }
    return moveElements;
  };

  return (
    <View style={styles.historyContainer}>
      <Text style={styles.historyTitle}>Move History</Text>
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
  historyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  historyTitle: {
    color: 'black',
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
  moveNumber: {
    color: '#4A90E2',
    fontSize: 14,
    marginRight: 4,
  },
  moveHistoryText: {
    color: 'black',
    fontSize: 14,
    marginRight: 8,
  },
});

export default React.memo(MoveHistory); 
