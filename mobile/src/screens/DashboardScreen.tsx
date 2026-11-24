/**
 * Dashboard / Home Screen
 * Displays real-time clinic KPIs, live consultation status, queue caller, and quick actions.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Card, Button, Badge, StatCard, LivePulseDot, EmptyState } from '../components';
import { RootStackParamList, Appointment } from '../types';
import { HapticService } from '../services/haptics';
import { spacing, typography, radii, shadows } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export const DashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const { doctor } = useAuth();
  const {
    appointments,
    queue,
    stats,
    callNext,
    isCallingNext,
  } = useClinicData();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    HapticService.light();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const activeAppointment = useMemo(
    () => appointments.find((a) => a.status === 'in_consultation'),
    [appointments]
  );
  const nextWaiting = useMemo(
    () => queue.find((q) => q.status === 'waiting'),
    [queue]
  );

  const greeting = getTimeGreeting();
  const doctorFirstName = doctor?.name?.split(' ')[0] || 'Doctor';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + spacing.sm,
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            HapticService.light();
            navigation.navigate('MoreTab' as any);
          }}
          accessibilityRole="button"
          accessibilityLabel="Open clinic profile and settings"
          style={({ pressed }) => [styles.doctorIdentity, pressed && { opacity: 0.75 }]}
        >
          <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={[typography.subtitle, { color: colors.primary }]}>
              {doctorFirstName.charAt(0).toUpperCase()}
            </Text>
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: colors.accent, borderColor: colors.surface },
              ]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[typography.captionMedium, { color: colors.textMuted }]}>
              {greeting} • {doctor?.clinicName || 'Apollo Clinic'}
            </Text>
            <Text numberOfLines={1} style={[typography.h3, { color: colors.textPrimary }]}>
              Dr. {doctor?.name || 'Rohan Sharma'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.headerRightActions}>
          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('ScannerModal', {});
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Scan document or prescription"
          >
            <Ionicons name="scan-outline" size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('NewAppointmentModal', {});
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.primary,
                marginLeft: spacing.sm,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Book new appointment"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* KPI Stats Grid */}
        <View style={styles.statsRow}>
          <StatCard
            label="Today's Visits"
            value={stats.todayAppointments}
            icon="calendar-outline"
            colorVariant="primary"
            onPress={() => navigation.navigate('AppointmentsTab' as any)}
          />
          <StatCard
            label="Waiting Queue"
            value={stats.waitingInQueue}
            icon="people-outline"
            colorVariant="warning"
            onPress={() => navigation.navigate('QueueTab' as any)}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            label="Completed"
            value={stats.consultationsCompleted}
            icon="checkmark-done-circle-outline"
            colorVariant="accent"
            onPress={() => navigation.navigate('AppointmentsTab' as any)}
          />
          <StatCard
            label="Today's Revenue"
            value={`₹${stats.todayRevenue.toLocaleString('en-IN')}`}
            icon="wallet-outline"
            colorVariant="secondary"
            onPress={() => navigation.navigate('BillingModal', {})}
          />
        </View>

        {/* Live Active Consultation Room Card */}
        {activeAppointment ? (
          <Card
            variant="elevated"
            style={[
              styles.activeCard,
              {
                borderColor: colors.primaryBorder,
                borderLeftWidth: 4,
                borderLeftColor: colors.primary,
              },
            ]}
          >
            <View style={styles.activeHeader}>
              <View style={[styles.livePill, { backgroundColor: colors.destructiveLight }]}>
                <LivePulseDot color={colors.destructive} size={7} style={{ marginRight: 6 }} />
                <Text style={[styles.livePillText, { color: colors.destructive }]}>
                  NOW CONSULTING
                </Text>
              </View>
              <Badge
                label={`TOKEN #${activeAppointment.tokenNumber ?? '—'}`}
                variant="in_consultation"
              />
            </View>

            <Text style={[typography.h3, styles.activePatientName, { color: colors.textPrimary }]}>
              {activeAppointment.patientName}
            </Text>
            <Text style={[typography.callout, { color: colors.textSecondary, marginTop: 2 }]}>
              {activeAppointment.patientAge}y • {activeAppointment.patientGender} •{' '}
              {activeAppointment.chiefComplaint || 'General Consultation'}
            </Text>

            <View style={styles.activeActions}>
              <Button
                title="Open Consultation"
                size="md"
                variant="primary"
                icon={<Ionicons name="medkit-outline" size={18} color="#FFFFFF" />}
                onPress={() =>
                  navigation.navigate('ConsultationRoom', {
                    appointmentId: activeAppointment.id,
                    patientId: activeAppointment.patientId,
                  })
                }
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Write Rx"
                size="md"
                variant="outline"
                icon={<Ionicons name="document-text-outline" size={17} color={colors.primary} />}
                onPress={() =>
                  navigation.navigate('PrescriptionBuilder', {
                    appointmentId: activeAppointment.id,
                    patientId: activeAppointment.patientId,
                  })
                }
              />
            </View>
          </Card>
        ) : null}

        {/* Live Queue Next Caller */}
        <Card variant="default" style={styles.queueCallerCard}>
          <View style={styles.queueCallerHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.queueTitleRow}>
                <Text style={[typography.captionMedium, { color: colors.textMuted }]}>
                  NEXT IN WAITING QUEUE
                </Text>
                {stats.waitingInQueue > 0 && (
                  <View style={[styles.waitingPill, { backgroundColor: colors.warningLight }]}>
                    <Text style={[typography.badge, typography.tabular, { color: colors.warning }]}>
                      {stats.waitingInQueue} WAITING
                    </Text>
                  </View>
                )}
              </View>
              {nextWaiting ? (
                <Text style={[typography.subtitle, { color: colors.textPrimary, marginTop: 4 }]}>
                  Token #{nextWaiting.tokenNumber} • {nextWaiting.patientName}
                </Text>
              ) : (
                <Text style={[typography.body, { color: colors.textMuted, marginTop: 4 }]}>
                  All waiting patients have been attended
                </Text>
              )}
              {nextWaiting?.chiefComplaint ? (
                <Text numberOfLines={1} style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  {nextWaiting.chiefComplaint} • ~{nextWaiting.estimatedWaitMinutes}m wait
                </Text>
              ) : null}
            </View>
          </View>

          {nextWaiting && (
            <Button
              title="Call Next Patient"
              variant="accent"
              size="md"
              loading={isCallingNext}
              icon={<Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />}
              onPress={async () => {
                const called = await callNext();
                if (called) {
                  navigation.navigate('ConsultationRoom', {
                    appointmentId: called.appointmentId,
                    patientId: called.patientId,
                  });
                }
              }}
              style={styles.callNextBtn}
            />
          )}
        </Card>

        {/* Quick Action Grid */}
        <Text style={[typography.h3, styles.sectionTitle, { color: colors.textPrimary }]}>
          Quick Actions
        </Text>
        <View style={styles.quickGrid}>
          {[
            {
              title: 'New Booking',
              subtitle: 'Walk-in or slot',
              icon: 'calendar-sharp' as const,
              bg: colors.primaryLight,
              fg: colors.primary,
              onPress: () => navigation.navigate('NewAppointmentModal', {}),
            },
            {
              title: 'Add Patient',
              subtitle: 'Create EMR record',
              icon: 'person-add' as const,
              bg: colors.accentLight,
              fg: colors.accent,
              onPress: () => navigation.navigate('NewPatientModal'),
            },
            {
              title: 'Scan Rx / Lab',
              subtitle: 'Camera & OCR',
              icon: 'document-text' as const,
              bg: colors.secondaryLight,
              fg: colors.secondary,
              onPress: () => navigation.navigate('ScannerModal', {}),
            },
            {
              title: 'Create Invoice',
              subtitle: 'UPI & billing',
              icon: 'receipt-outline' as const,
              bg: colors.warningLight,
              fg: colors.warning,
              onPress: () => navigation.navigate('BillingModal', {}),
            },
          ].map((tile) => (
            <Pressable
              key={tile.title}
              onPress={() => {
                HapticService.light();
                tile.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={`${tile.title}: ${tile.subtitle}`}
              style={({ pressed }) => [
                styles.quickTile,
                shadows.subtle,
                {
                  backgroundColor: colors.surface,
                  borderColor: pressed ? colors.primaryBorder : colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: tile.bg }]}>
                <Ionicons name={tile.icon} size={22} color={tile.fg} />
              </View>
              <Text style={[typography.bodyBold, styles.tileText, { color: colors.textPrimary }]}>
                {tile.title}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                {tile.subtitle}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Today's Schedule Preview */}
        <View style={styles.scheduleHeaderRow}>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            Today's Schedule
          </Text>
          <Pressable
            onPress={() => {
              HapticService.selection();
              navigation.navigate('AppointmentsTab' as any);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="View all appointments"
            style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[typography.captionMedium, { color: colors.primary }]}>
              View All ({appointments.length})
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} style={{ marginLeft: 2 }} />
          </Pressable>
        </View>

        {appointments.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No Appointments Today"
            description="Schedule a visit or register a walk-in patient to begin today's clinic."
            actionTitle="New Appointment"
            onAction={() => navigation.navigate('NewAppointmentModal', {})}
          />
        ) : (
          appointments.slice(0, 4).map((apt: Appointment) => (
            <Card
              key={apt.id}
              onPress={() => {
                if (apt.status === 'in_consultation' || apt.status === 'waiting') {
                  navigation.navigate('ConsultationRoom', {
                    appointmentId: apt.id,
                    patientId: apt.patientId,
                  });
                } else {
                  navigation.navigate('PatientDetail', { patientId: apt.patientId });
                }
              }}
              style={styles.aptCard}
              accessibilityLabel={`${apt.patientName}, ${apt.timeSlot}, status ${apt.status}`}
            >
              <View style={styles.aptRow}>
                <View style={[styles.aptTimeBox, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons
                    name={apt.type === 'video' ? 'videocam-outline' : 'time-outline'}
                    size={15}
                    color={colors.primary}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      typography.captionMedium,
                      typography.tabular,
                      { color: colors.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {apt.timeSlot.split(' - ')[0]}
                  </Text>
                </View>

                <View style={styles.aptDetails}>
                  <Text numberOfLines={1} style={[typography.subtitle, { color: colors.textPrimary }]}>
                    {apt.patientName}
                  </Text>
                  <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted }]}>
                    {apt.tokenNumber ? `#${apt.tokenNumber} • ` : ''}
                    {apt.chiefComplaint || 'General Consultation'}
                  </Text>
                </View>

                <Badge label={apt.status.replace('_', ' ')} variant={apt.status} size="sm" />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  doctorIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  activeCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
  },
  activeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radii.full,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activePatientName: {
    marginTop: spacing.xs,
  },
  activeActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueCallerCard: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.xs,
    padding: spacing.md,
  },
  queueCallerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waitingPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  callNextBtn: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    marginHorizontal: spacing.xs,
  },
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginHorizontal: spacing.xs,
  },
  quickTile: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tileText: {
    fontSize: 14,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.xs,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  aptCard: {
    marginVertical: spacing.xs,
    marginHorizontal: spacing.xs,
    padding: spacing.md,
  },
  aptRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aptTimeBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    minWidth: 72,
  },
  aptDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
});
