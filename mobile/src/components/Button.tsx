/**
 * Accessible Native Button Component
 * Built with Pressable, spring scale feedback, Haptic feedback, and WCAG AA contrast.
 */
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { HapticService } from '../services/haptics';
import { spacing, radii, touchTarget, typography } from '../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  haptic?: 'light' | 'medium' | 'heavy' | 'none';
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconRight,
  style,
  textStyle,
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isInteractive = !disabled && !loading;

  const animateTo = (value: number) => {
    Animated.spring(scaleAnim, {
      toValue: value,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePress = () => {
    if (!isInteractive) return;
    if (haptic === 'light') HapticService.light();
    else if (haptic === 'medium') HapticService.medium();
    else if (haptic === 'heavy') HapticService.heavy();
    onPress();
  };

  let bg = colors.primary;
  let text = colors.onPrimary;
  let border = 'transparent';

  if (variant === 'secondary') {
    bg = colors.secondaryLight;
    text = colors.secondary;
  } else if (variant === 'accent') {
    bg = colors.accent;
    text = colors.onAccent;
  } else if (variant === 'outline') {
    bg = 'transparent';
    text = colors.primary;
    border = colors.primaryBorder;
  } else if (variant === 'destructive') {
    bg = colors.destructive;
    text = colors.onDestructive;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    text = colors.primary;
  }

  let height = touchTarget.minHeight;
  let paddingHorizontal = spacing.lg;
  let fontSize = typography.bodyBold.fontSize;

  if (size === 'sm') {
    height = 38;
    paddingHorizontal = spacing.md;
    fontSize = 13;
  } else if (size === 'lg') {
    height = 52;
    paddingHorizontal = spacing.xxl;
    fontSize = 16;
  }

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => isInteractive && animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        disabled={!isInteractive}
        hitSlop={size === 'sm' ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: !isInteractive, busy: loading }}
        style={({ pressed }) => [
          styles.base,
          {
            height,
            paddingHorizontal,
            backgroundColor: disabled ? (colors.isDark ? '#1E293B' : '#E2E8F0') : bg,
            borderColor: disabled ? 'transparent' : border,
            borderWidth: variant === 'outline' ? 1.5 : 0,
            opacity: pressed && isInteractive ? 0.88 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={text} size="small" />
        ) : (
          <>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text
              numberOfLines={1}
              style={[
                typography.bodyBold,
                {
                  color: disabled ? (colors.isDark ? '#64748B' : '#64748B') : text,
                  fontSize,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
            {iconRight && <View style={styles.iconRightContainer}>{iconRight}</View>}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconRightContainer: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
