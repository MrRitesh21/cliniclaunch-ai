/**
 * Patient Detail & Clinical Profile Screen
 * Full EMR view: demographics, vitals summary, allergies, chronic conditions, timeline & quick actions.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Button, Badge } from '../components';
import { RootStackParamList } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'PatientDetail'>;

export const PatientDetailScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();
  const { patients, appointments } = useClinicData();

  const patient = patients.find((p) => p.id === route.params.patientId);

  if (!patient) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="Patient Profile" showBack onBack={() => navigation.goBack()} />
        <View style={styles.notFoundContainer}>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            Patient record not found.
          </Text>
        </View>
      </View>
    );
  }

  const patientAppointments = appointments.filter((a) => a.patientId === patient.id);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title={patient.name}
        subtitle={`${patient.age} yrs • ${patient.gender}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => {
                HapticService.light();
                const digits = patient.phone.replace(/\D/g, '');
                Linking.openURL(`https://wa.me/${digits}`).catch(() => {});
              }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`WhatsApp ${patient.name}`}
              style={({ pressed }) => [
                styles.callHeaderBtn,
                { backgroundColor: colors.accentLight, marginRight: spacing.xs, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="logo-whatsapp" size={18} color={colors.accent} />
            </Pressable>
            <Pressable
              onPress={() => {
                HapticService.light();
                Linking.openURL(`tel:${patient.phone}`);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Call ${patient.name}`}
              style={({ pressed }) => [
                styles.callHeaderBtn,
                { backgroundColor: colors.primaryLight, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="call" size={18} color={colors.primary} />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Core Summary Card */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.avatarRow}>
            <View style={[styles.largeAvatar, { backgroundColor: colors.primaryLight }]}>
              <Text style={[typography.h1, { color: colors.primary }]}>
                {patient.name.substring(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                {patient.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {patient.phone}
              </Text>
              {patient.email ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {patient.email}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.vitalsRow, { borderColor: colors.borderSubtle }]}>
            <View style={styles.vitalItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>BLOOD</Text>
              <Text style={[typography.bodyBold, { color: colors.textPrimary, marginTop: 2 }]}>
                {patient.bloodGroup || '—'}
              </Text>
            </View>
            <View style={[styles.vitalDivider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.vitalItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>VISITS</Text>
              <Text style={[typography.bodyBold, typography.tabular, { color: colors.textPrimary, marginTop: 2 }]}>
                {patient.totalVisits}
              </Text>
            </View>
            <View style={[styles.vitalDivider, { backgroundColor: colors.borderSubtle }]} />
            <View style={styles.vitalItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>LAST VISIT</Text>
              <Text style={[typography.bodyBold, typography.tabular, { color: colors.textPrimary, marginTop: 2 }]}>
                {patient.lastVisit || 'First'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Primary Action Buttons */}
        <View style={styles.actionButtonsRow}>
          <Button
            title="Start Consult"
            size="md"
            variant="primary"
            icon={<Ionicons name="medkit-outline" size={18} color="#FFFFFF" />}
            onPress={() => {
              const activeApt = patientAppointments.find(
                (a) => a.status === 'in_consultation' || a.status === 'waiting'
              );
              navigation.navigate('ConsultationRoom', {
                appointmentId: activeApt?.id || 'new-walkin-apt',
                patientId: patient.id,
              });
            }}
            style={{ flex: 1, marginRight: spacing.xs }}
          />

          <Button
            title="Book Visit"
            size="md"
            variant="outline"
            icon={<Ionicons name="calendar-outline" size={18} color={colors.primary} />}
            onPress={() => navigation.navigate('NewAppointmentModal', { patientId: patient.id })}
            style={{ flex: 1, marginLeft: spacing.xs }}
          />
        </View>

        <View style={styles.secondaryButtonsRow}>
          <Button
            title="Scan Reports"
            size="sm"
            variant="secondary"
            icon={<Ionicons name="scan-outline" size={16} color={colors.secondary} />}
            onPress={() => navigation.navigate('ScannerModal', {})}
            style={{ flex: 1, marginRight: spacing.xs }}
          />
          <Button
            title="Create Bill"
            size="sm"
            variant="secondary"
            icon={<Ionicons name="receipt-outline" size={16} color={colors.secondary} />}
            onPress={() => navigation.navigate('BillingModal', { patientId: patient.id })}
            style={{ flex: 1, marginLeft: spacing.xs }}
          />
        </View>

        {/* Clinical History & Allergies */}
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.sectionHeader, { color: colors.textPrimary }]}>
            Medical Profile
          </Text>

          <Text style={[typography.captionMedium, styles.subHeader, { color: colors.textSecondary }]}>
            KNOWN ALLERGIES
          </Text>
          {patient.allergies && patient.allergies.length > 0 ? (
            <View style={styles.tagsContainer}>
              {patient.allergies.map((allergy, index) => (
                <View key={index} style={[styles.allergyBadge, { backgroundColor: colors.destructiveLight }]}>
                  <Ionicons name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[typography.captionMedium, { color: colors.destructive, marginLeft: 4 }]}>
                    {allergy}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              No known drug or environmental allergies reported.
            </Text>
          )}

          <Text style={[typography.captionMedium, styles.subHeader, { color: colors.textSecondary, marginTop: spacing.md }]}>
            CHRONIC CONDITIONS & HISTORY
          </Text>
          {patient.medicalHistory && patient.medicalHistory.length > 0 ? (
            <View style={styles.tagsContainer}>
              {patient.medicalHistory.map((condition, index) => (
                <View key={index} style={[styles.conditionBadge, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[typography.captionMedium, { color: colors.textPrimary }]}>
                    {condition}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              No chronic conditions recorded.
            </Text>
          )}
        </Card>

        {/* Visits & Prescriptions Timeline */}
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.sectionHeader, { color: colors.textPrimary }]}>
            Visits & Prescriptions ({patientAppointments.length})
          </Text>

          {patientAppointments.length > 0 ? (
            patientAppointments.map((apt, idx) => (
              <View
                key={apt.id}
                style={[
                  styles.timelineItem,
                  {
                    borderBottomColor: colors.borderSubtle,
                    borderBottomWidth: idx === patientAppointments.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <View style={styles.timelineLeft}>
                  <Text style={[typography.bodyBold, typography.tabular, { color: colors.textPrimary }]}>
                    {apt.timeSlot.split(' - ')[0]}
                  </Text>
                  <Text style={[typography.caption, typography.tabular, { color: colors.textMuted }]}>
                    {apt.dateTime.split('T')[0]}
                  </Text>
                </View>

                <View style={styles.timelineRight}>
                  <View style={styles.timelineTitleRow}>
                    <Text numberOfLines={1} style={[typography.subtitle, { color: colors.textPrimary, flex: 1 }]}>
                      {apt.chiefComplaint || 'General Checkup'}
                    </Text>
                    <Badge label={apt.status.replace('_', ' ')} variant={apt.status} size="sm" />
                  </View>
                  <Text style={[typography.caption, typography.tabular, { color: colors.textSecondary, marginTop: 2 }]}>
                    Dr. {apt.doctorName} • Fee: ₹{apt.fee} ({apt.paymentStatus})
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              No previous visit records found.
            </Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: spacing.lg,
  },
  card: {
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  largeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  vitalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  vitalItem: {
    alignItems: 'center',
    flex: 1,
  },
  vitalDivider: {
    width: 1,
    height: 26,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  subHeader: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  allergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  conditionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  timelineLeft: {
    minWidth: 88,
    marginRight: spacing.sm,
  },
  timelineRight: {
    flex: 1,
  },
  timelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
