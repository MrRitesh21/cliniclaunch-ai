/**
 * Dashboard Metric & KPI Card Component
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Card } from './Card';
import { spacing, radii, typography } from '../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  colorVariant?: 'primary' | 'accent' | 'warning' | 'secondary';
  subtext?: string;
  onPress?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  colorVariant = 'primary',
  subtext,
  onPress,
}) => {
  const { colors } = useTheme();

  let iconBg = colors.primaryLight;
  let iconColor = colors.primary;

  if (colorVariant === 'accent') {
    iconBg = colors.accentLight;
    iconColor = colors.accent;
  } else if (colorVariant === 'warning') {
    iconBg = colors.warningLight;
    iconColor = colors.warning;
  } else if (colorVariant === 'secondary') {
    iconBg = colors.secondaryLight;
    iconColor = colors.secondary;
  }

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={`${label}: ${value}${subtext ? `, ${subtext}` : ''}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        {subtext ? (
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
            {subtext}
          </Text>
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[typography.h2, typography.tabular, styles.value, { color: colors.textPrimary }]}
      >
        {value}
      </Text>
      <Text numberOfLines={1} style={[typography.captionMedium, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    marginHorizontal: spacing.xs,
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    marginVertical: spacing.xxs,
  },
});
