/**
 * Safe-Area Screen Header Component
 * Provides back navigation, title hierarchy, and right actions.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { HapticService } from '../services/haptics';
import { spacing, typography, touchTarget } from '../theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          backgroundColor: colors.surface,
          borderBottomColor: colors.borderSubtle,
        },
        style,
      ]}
    >
      <View style={styles.contentRow}>
        {showBack ? (
          <Pressable
            onPress={() => {
              HapticService.light();
              onBack?.();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.65 }]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
        ) : null}

        <View style={styles.titleContainer}>
          <Text
            numberOfLines={1}
            style={[typography.h3, { color: colors.textPrimary }]}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              numberOfLines={1}
              style={[typography.caption, { color: colors.textMuted }]}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {rightAction ? (
          <View style={styles.rightContainer}>{rightAction}</View>
        ) : (
          showBack && <View style={styles.backButtonPlaceholder} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget.minHeight,
  },
  backButton: {
    width: touchTarget.minWidth,
    height: touchTarget.minHeight,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonPlaceholder: {
    width: touchTarget.minWidth,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
