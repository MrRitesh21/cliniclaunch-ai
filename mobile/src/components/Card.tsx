/**
 * Theme-aware Card Component
 * Supports static containers and interactive pressable cards with subtle spring & haptic feedback.
 */
import React, { useRef } from 'react';
import {
  Animated,
  View,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { HapticService } from '../services/haptics';
import { spacing, radii, shadows } from '../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'subtle';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  variant = 'default',
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scaleAnim, {
      toValue: value,
      useNativeDriver: true,
      speed: 50,
      bounciness: 3,
    }).start();
  };

  const baseCardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: variant === 'elevated' ? colors.surfaceElevated : colors.surface,
      borderColor: variant === 'subtle' ? colors.borderSubtle : colors.border,
      borderWidth: variant === 'subtle' ? 1 : 1,
    },
    variant === 'elevated' && shadows.elevated,
    variant === 'default' && shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Pressable
          onPress={() => {
            HapticService.light();
            onPress();
          }}
          onPressIn={() => animateTo(0.985)}
          onPressOut={() => animateTo(1)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          style={({ pressed }) => [
            baseCardStyle,
            pressed && {
              borderColor: colors.primaryBorder,
              opacity: 0.94,
            },
          ]}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={baseCardStyle} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginVertical: spacing.xs,
  },
});
