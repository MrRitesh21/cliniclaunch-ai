/**
 * Clinic Operations & Settings Screen
 * Manages billing, scanner, push notifications, biometric lock, and theme mode.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Header, Card, Button, Badge } from '../components';
import { RootStackParamList } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';
import { NotificationService } from '../services/notifications';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const MoreScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { colors, mode, setMode } = useTheme();
  const { doctor, logout, biometricAvailable, biometricEnabled, toggleBiometrics } = useAuth();
  const [pushBusy, setPushBusy] = useState(false);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of ClinicX?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    HapticService.light();
    try {
      const token = await NotificationService.registerForPushNotifications();
      await NotificationService.scheduleLocalNotification(
        'ClinicX Alert Active',
        'Real-time appointment and queue push alerts are working on this device.',
        1
      );
      HapticService.success();
      Alert.alert(
        'Notifications Ready',
        token
          ? 'FCM/Expo device token registered and test alert scheduled.'
          : 'Local notification test scheduled. Use a physical device for remote FCM push tokens.'
      );
    } catch {
      Alert.alert('Notifications', 'Could not schedule test alert on this device.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Clinic & Settings" subtitle="Practice Operations" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Doctor Profile Card */}
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={[typography.h2, { color: '#FFFFFF' }]}>
                {doctor?.name?.charAt(0) || 'D'}
              </Text>
            </View>
            <View style={styles.profileDetails}>
              <View style={styles.profileTitleRow}>
                <Text numberOfLines={1} style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}>
                  Dr. {doctor?.name || 'Rohan Sharma'}
                </Text>
                <Badge label="OPD LIVE" variant="accent" size="sm" />
              </View>
              <Text numberOfLines={1} style={[typography.captionMedium, { color: colors.primary, marginTop: 2 }]}>
                {doctor?.specialization || 'Cardiology & General Medicine'}
              </Text>
              <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {doctor?.clinicName || 'Apollo Clinic'} • {doctor?.registrationNumber || 'MCI-2018-98421'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Clinic Management Modules */}
        <Text style={[typography.captionMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
          CLINIC MODULES
        </Text>

        <Card style={styles.card}>
          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('BillingModal', {});
            }}
            accessibilityRole="button"
            accessibilityLabel="Billing and Invoicing"
            style={({ pressed }) => [
              styles.menuItem,
              { borderBottomColor: colors.borderSubtle, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="receipt-outline" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Billing & Invoicing
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Generate bills, track payments, share UPI QR
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('ScannerModal', {});
            }}
            accessibilityRole="button"
            accessibilityLabel="Document and Prescription Scanner"
            style={({ pressed }) => [
              styles.menuItem,
              { borderBottomColor: colors.borderSubtle, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.secondaryLight }]}>
              <Ionicons name="scan-outline" size={20} color={colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Document & Lab Scanner
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                Optical scan of paper prescriptions and lab sheets
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.menuItem, styles.lastRow]}>
            <View style={[styles.menuIcon, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="logo-whatsapp" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                WhatsApp Automation
              </Text>
              <Text style={[typography.caption, { color: colors.accent }]}>
                Active • Queue alerts & appointment confirmations live
              </Text>
            </View>
          </View>
        </Card>

        {/* Preferences & Security */}
        <Text style={[typography.captionMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
          APPEARANCE & SECURITY
        </Text>

        <Card style={styles.card}>
          {/* 3-Way Appearance Mode Selector */}
          <View style={[styles.appearanceBlock, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.appearanceHeader}>
              <View style={[styles.menuIcon, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="contrast-outline" size={20} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                  Appearance
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Match device or pick light / dark consultation theme
                </Text>
              </View>
            </View>
            <View style={[styles.segmentedTrack, { backgroundColor: colors.surfaceSecondary }]}>
              {(['system', 'light', 'dark'] as const).map((opt) => {
                const selected = mode === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      HapticService.selection();
                      setMode(opt);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    style={[
                      styles.segmentItem,
                      selected && { backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[
                        typography.captionMedium,
                        {
                          color: selected ? colors.primary : colors.textSecondary,
                          textTransform: 'capitalize',
                        },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={handleTestPush}
            disabled={pushBusy}
            accessibilityRole="button"
            accessibilityLabel="Verify push notifications"
            style={({ pressed }) => [
              styles.menuItem,
              {
                borderBottomColor: biometricAvailable ? colors.borderSubtle : 'transparent',
                borderBottomWidth: biometricAvailable ? 1 : 0,
                opacity: pressed || pushBusy ? 0.75 : 1,
              },
            ]}
          >
            <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                Push Alerts (FCM)
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {pushBusy ? 'Checking permissions...' : 'Tap to register device & test alert'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          {biometricAvailable && (
            <View style={[styles.toggleRow, styles.lastRow]}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="finger-print-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                  Biometric App Lock
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Require Face ID or Fingerprint on launch
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={(val) => toggleBiometrics(val)}
                trackColor={{ false: '#CBD5E1', true: colors.primary }}
              />
            </View>
          )}
        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out of ClinicX"
          variant="destructive"
          size="lg"
          icon={<Ionicons name="log-out-outline" size={20} color="#FFFFFF" />}
          onPress={handleLogout}
          style={styles.logoutBtn}
        />

        <Text style={[typography.caption, styles.versionText, { color: colors.textMuted }]}>
          ClinicX Mobile v1.0.0 • Native iOS & Android
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  profileCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  profileDetails: {
    flex: 1,
  },
  sectionTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xxs,
  },
  card: {
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  appearanceBlock: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
  },
  appearanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  logoutBtn: {
    marginTop: spacing.xl,
  },
  versionText: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
