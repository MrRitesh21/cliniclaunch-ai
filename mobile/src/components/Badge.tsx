/**
 * Status Badge Component
 * Used for appointment statuses, queue tokens, and tags.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radii, typography } from '../theme';
import { AppointmentStatus, PaymentStatus } from '../types';

interface BadgeProps {
  label: string;
  variant?: AppointmentStatus | PaymentStatus | 'primary' | 'accent' | 'default';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  style,
}) => {
  const { colors } = useTheme();

  let bg = colors.surfaceSecondary;
  let text = colors.textSecondary;

  switch (variant) {
    case 'waiting':
    case 'pending':
    case 'partially_paid':
      bg = colors.statusWaitingBg;
      text = colors.statusWaitingText;
      break;
    case 'in_consultation':
    case 'scheduled':
      bg = colors.statusInConsultBg;
      text = colors.statusInConsultText;
      break;
    case 'completed':
    case 'paid':
    case 'accent':
      bg = colors.statusCompletedBg;
      text = colors.statusCompletedText;
      break;
    case 'cancelled':
    case 'no_show':
    case 'refunded':
      bg = colors.statusCancelledBg;
      text = colors.statusCancelledText;
      break;
    case 'primary':
      bg = colors.primaryLight;
      text = colors.primary;
      break;
    default:
      bg = colors.surfaceSecondary;
      text = colors.textSecondary;
  }

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical: isSmall ? 2 : spacing.xxs,
          paddingHorizontal: isSmall ? spacing.xs : spacing.sm,
        },
        style,
      ]}
    >
      <Text
        style={[
          typography.badge,
          {
            color: text,
            fontSize: isSmall ? 10 : 11,
          },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
