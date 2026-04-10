import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  /** Default: all edges so content stays out of notches, status bar, and home indicator. */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

export default function ScreenSafeArea({
  children,
  edges = ['top', 'right', 'bottom', 'left'],
  style,
}: Props) {
  return (
    <SafeAreaView style={[styles.fill, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
