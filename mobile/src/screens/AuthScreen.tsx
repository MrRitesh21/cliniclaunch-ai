/**
 * Doctor Authentication Screen with Inline Validation, Biometrics & Quick Access
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Button, Input, Card } from '../components';
import { spacing, typography } from '../theme';

export const AuthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { login, loginWithBiometrics, biometricAvailable } = useAuth();

  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('rohan.sharma@clinicx.in');
  const [password, setPassword] = useState('••••••••');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    setFormError(undefined);
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setEmailError('Enter a valid clinic email address');
      return;
    }
    setEmailError(undefined);
    setIsSubmitting(true);
    const success = await login(trimmed, password);
    setIsSubmitting(false);
    if (!success) {
      setFormError('Invalid credentials. Please verify your email and password.');
    }
  };

  const handleBiometricLogin = async () => {
    setFormError(undefined);
    await loginWithBiometrics();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <Ionicons name="medical" size={36} color="#FFFFFF" />
          </View>
          <Text style={[typography.h1, styles.brandTitle, { color: colors.textPrimary }]}>
            ClinicX
          </Text>
          <Text style={[typography.body, styles.brandSubtitle, { color: colors.textSecondary }]}>
            Doctor & Practice Management OS
          </Text>
        </View>

        {/* Login Card */}
        <Card variant="elevated" style={styles.card}>
          <Text style={[typography.h3, styles.cardTitle, { color: colors.textPrimary }]}>
            Doctor Sign In
          </Text>
          <Text style={[typography.callout, styles.cardDesc, { color: colors.textMuted }]}>
            Access your appointments, patient EMR records, and live reception queue.
          </Text>

          {formError ? (
            <View style={[styles.bannerError, { backgroundColor: colors.destructiveLight }]}>
              <Ionicons name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[typography.captionMedium, { color: colors.destructive, marginLeft: 6, flex: 1 }]}>
                {formError}
              </Text>
            </View>
          ) : null}

          <Input
            label="Clinic Email"
            placeholder="doctor@clinicx.in"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (emailError) setEmailError(undefined);
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            leftIcon="mail-outline"
          />

          <Input
            inputRef={passwordRef}
            label="Password"
            placeholder="Enter password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            leftIcon="lock-closed-outline"
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={isSubmitting}
            size="lg"
            style={styles.signInButton}
          />

          {biometricAvailable && (
            <Button
              title="Unlock with Biometrics"
              variant="outline"
              size="lg"
              onPress={handleBiometricLogin}
              icon={<Ionicons name="finger-print-outline" size={22} color={colors.primary} />}
              style={styles.biometricButton}
            />
          )}
        </Card>

        {/* Demo Fast Access */}
        <View style={styles.demoBox}>
          <Text style={[typography.captionMedium, { color: colors.textMuted, textAlign: 'center' }]}>
            QUICK DEMO ACCESS
          </Text>
          <Button
            title="Continue as Dr. Rohan Sharma"
            variant="ghost"
            size="sm"
            onPress={() => login('rohan.sharma@clinicx.in')}
            style={styles.demoButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    flexGrow: 1,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  brandTitle: {
    textAlign: 'center',
  },
  brandSubtitle: {
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  card: {
    padding: spacing.xl,
  },
  cardTitle: {
    marginBottom: spacing.xxs,
  },
  cardDesc: {
    marginBottom: spacing.md,
  },
  bannerError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  signInButton: {
    marginTop: spacing.lg,
  },
  biometricButton: {
    marginTop: spacing.md,
  },
  demoBox: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  demoButton: {
    marginTop: spacing.xs,
  },
});
