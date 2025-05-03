import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface TimeSelectorProps {
  onTimeSelected: (time: number) => void;
}

const TimeSelector: React.FC<TimeSelectorProps> = ({ onTimeSelected }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTime, setSelectedTime] = useState(10);

  const timeOptions = [5, 10, 15, 20, 30];

  const handleTimeSelect = (time: number) => {
    setSelectedTime(time);
    setIsExpanded(false);
    onTimeSelected(time);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.selector} 
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Icon name="timer" size={24} color="#8CB369" style={styles.icon} />
        <Text style={styles.timeText}>{selectedTime} min</Text>
        <Icon 
          name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
          size={24} 
          color="white" 
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.dropdown}>
          {timeOptions.map((time) => (
            <TouchableOpacity
              key={time}
              style={styles.option}
              onPress={() => handleTimeSelect(time)}
            >
              <Text style={styles.optionText}>{time} min</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    padding: 15,
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  icon: {
    marginRight: 10,
  },
  timeText: {
    color: 'white',
    fontSize: 18,
    flex: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#3A3A3A',
    borderRadius: 8,
    marginTop: 4,
    zIndex: 1000,
  },
  option: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  optionText: {
    color: 'white',
    fontSize: 16,
  },
});

export default TimeSelector; 