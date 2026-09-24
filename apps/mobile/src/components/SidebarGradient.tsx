import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@imf/assets';

const { deep, mid, darkest, yellowGlow, redGlow } = colors.gradient.sidebar;

type Props = {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

/** Stacked gradient matching web sidebar (linear 145° + yellow/red glows). */
export function SidebarGradient({ style, children }: Props) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[deep, mid, darkest]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[yellowGlow, 'transparent']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.55, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', redGlow]}
        start={{ x: 0.3, y: 0.3 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
});
