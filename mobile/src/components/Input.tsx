/**
 * Accessible Text Input Component
 * Features label, error messaging, helper text, focus state, clear button, and accessible touch targets.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  TextInputProps,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { HapticService } from '../services/haptics';
import { spacing, radii, typography, touchTarget } from '../theme';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  clearable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputRef?: React.RefObject<TextInput | null>;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  clearable,
  containerStyle,
  inputRef,
  secureTextEntry,
  value,
  onChangeText,
  ...textInputProps
}) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isSecure = secureTextEntry && !isPasswordVisible;
  const showClear =
    clearable !== false &&
    !secureTextEntry &&
    !rightIcon &&
    typeof value === 'string' &&
    value.length > 0 &&
    typeof onChangeText === 'function';

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            typography.captionMedium,
            styles.label,
            { color: error ? colors.destructive : isFocused ? colors.primary : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: colors.surface,
            borderColor: error
              ? colors.destructive
              : isFocused
              ? colors.primary
              : colors.border,
            borderWidth: isFocused || error ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? colors.primary : colors.textMuted}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          {...textInputProps}
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isSecure}
          accessibilityLabel={textInputProps.accessibilityLabel || label || textInputProps.placeholder}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            typography.body,
            {
              color: colors.textPrimary,
            },
            textInputProps.style,
          ]}
        />

        {secureTextEntry ? (
          <Pressable
            onPress={() => {
              HapticService.selection();
              setIsPasswordVisible(!isPasswordVisible);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.rightAction}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : showClear ? (
          <Pressable
            onPress={() => {
              HapticService.light();
              onChangeText?.('');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.rightAction}
            accessibilityRole="button"
            accessibilityLabel="Clear text"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole={onRightIconPress ? 'button' : undefined}
            style={styles.rightAction}
          >
            <Ionicons name={rightIcon} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.destructive} />
          <Text style={[typography.caption, styles.errorText, { color: colors.destructive }]}>
            {error}
          </Text>
        </View>
      ) : helperText ? (
        <Text style={[typography.caption, styles.helperText, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  label: {
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    minHeight: touchTarget.minHeight,
    paddingHorizontal: spacing.md,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    paddingHorizontal: 0,
  },
  rightAction: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    marginLeft: spacing.xs,
    flex: 1,
  },
  helperText: {
    marginTop: spacing.xs,
  },
});
