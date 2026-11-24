/**
 * Active Consultation Room Screen
 * Captures vitals with clinical range alerts, symptom quick-chips, observations, and sticky Rx/Finish bar.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Button, Input, Badge } from '../components';
import { RootStackParamList } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'ConsultationRoom'>;

const SYMPTOM_CHIPS = [
  'Fever',
  'Dry Cough',
  'Body Ache',
  'Headache',
  'Sore Throat',
  'Fatigue',
  'BP Check',
  'Follow-up',
];

export const ConsultationRoomScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();
  const { patients, appointments, updateStatus } = useClinicData();

  const appointment = appointments.find((a) => a.id === route.params.appointmentId);
  const patient = patients.find((p) => p.id === route.params.patientId) || {
    id: route.params.patientId,
    name: appointment?.patientName || 'Patient',
    age: appointment?.patientAge || 30,
    gender: appointment?.patientGender || ('male' as const),
    phone: appointment?.patientPhone || '',
    bloodGroup: 'B+',
    allergies: [],
  };

  const [bp, setBp] = useState('120/80');
  const [pulse, setPulse] = useState('74');
  const [temperature, setTemperature] = useState('98.6');
  const [weight, setWeight] = useState('68');
  const [spo2, setSpo2] = useState('99');
  const [notes, setNotes] = useState(appointment?.chiefComplaint || '');

  // Vital range checks for immediate visual triage
  const vitalAlerts = useMemo(() => {
    const alerts: string[] = [];
    const sys = parseInt(bp.split('/')[0] || '0', 10);
    const hr = parseInt(pulse || '0', 10);
    const temp = parseFloat(temperature || '0');
    const sat = parseInt(spo2 || '100', 10);

    if (sys >= 140) alerts.push(`Elevated BP (${bp})`);
    if (hr > 100 || (hr > 0 && hr < 55)) alerts.push(`Abnormal HR (${pulse} bpm)`);
    if (temp >= 99.5) alerts.push(`Fever (${temperature}°F)`);
    if (sat > 0 && sat < 95) alerts.push(`Low SpO2 (${spo2}%)`);
    return alerts;
  }, [bp, pulse, temperature, spo2]);

  const toggleSymptomChip = (symptom: string) => {
    HapticService.selection();
    const parts = notes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = parts.some((p) => p.toLowerCase() === symptom.toLowerCase());
    if (exists) {
      setNotes(parts.filter((p) => p.toLowerCase() !== symptom.toLowerCase()).join(', '));
    } else {
      setNotes(parts.length > 0 ? `${parts.join(', ')}, ${symptom}` : symptom);
    }
  };

  const parsedVitals = {
    bloodPressure: bp || '120/80',
    heartRate: parseInt(pulse, 10) || 74,
    temperature: temperature ? `${temperature}°F` : '98.6°F',
    weightKg: parseFloat(weight) || undefined,
    spo2: parseInt(spo2, 10) || undefined,
  };

  const handleFinishConsult = () => {
    HapticService.success();
    if (appointment) {
      updateStatus({ id: appointment.id, status: 'completed' });
    }
    Alert.alert(
      'Consultation Finished',
      `Examination for ${patient.name} has been marked complete. Would you like to generate the bill now?`,
      [
        {
          text: 'Dashboard',
          onPress: () => navigation.navigate('MainTabs'),
        },
        {
          text: 'Generate Bill',
          onPress: () => {
            navigation.navigate('BillingModal', {
              appointmentId: appointment?.id,
              patientId: patient.id,
            });
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Header
        title="Consultation Room"
        subtitle={`Token #${appointment?.tokenNumber || '—'} • ${patient.name}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <Button
            title="Profile"
            size="sm"
            variant="ghost"
            onPress={() => navigation.navigate('PatientDetail', { patientId: patient.id })}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Clinical Banner */}
        <Card variant="elevated" style={styles.patientBanner}>
          <View style={styles.patientBannerRow}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
              <Text style={[typography.h3, { color: colors.primary }]}>
                {patient.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.patientDetails}>
              <View style={styles.bannerTopRow}>
                <Text numberOfLines={1} style={[typography.h3, { color: colors.textPrimary, flex: 1 }]}>
                  {patient.name}
                </Text>
                {patient.bloodGroup ? (
                  <Badge label={patient.bloodGroup} variant="primary" size="sm" />
                ) : null}
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {patient.age} yrs • {patient.gender} {patient.phone ? `• ${patient.phone}` : ''}
              </Text>
              {patient.allergies && patient.allergies.length > 0 && (
                <View style={[styles.allergyWarning, { backgroundColor: colors.destructiveLight }]}>
                  <Ionicons name="warning" size={13} color={colors.destructive} />
                  <Text style={[typography.captionMedium, { color: colors.destructive, marginLeft: 4 }]}>
                    Allergy: {patient.allergies.join(', ')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Patient Vitals Entry */}
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              Vitals & Biometrics
            </Text>
            {vitalAlerts.length > 0 && (
              <Badge label={`${vitalAlerts.length} ALERT`} variant="cancelled" size="sm" />
            )}
          </View>

          {vitalAlerts.length > 0 && (
            <View style={[styles.alertBanner, { backgroundColor: colors.warningLight }]}>
              <Ionicons name="pulse" size={16} color={colors.warning} />
              <Text style={[typography.captionMedium, { color: colors.warning, marginLeft: 6, flex: 1 }]}>
                Out of range: {vitalAlerts.join(' • ')}
              </Text>
            </View>
          )}

          <View style={styles.vitalsGrid}>
            <View style={styles.vitalInputBox}>
              <Input
                label="BP (mmHg)"
                value={bp}
                onChangeText={setBp}
                placeholder="120/80"
                keyboardType="numbers-and-punctuation"
                clearable={false}
              />
            </View>
            <View style={styles.vitalInputBox}>
              <Input
                label="Pulse (bpm)"
                value={pulse}
                onChangeText={setPulse}
                placeholder="72"
                keyboardType="numeric"
                clearable={false}
              />
            </View>
          </View>

          <View style={styles.vitalsGrid}>
            <View style={styles.vitalInputBox}>
              <Input
                label="Temp (°F)"
                value={temperature}
                onChangeText={setTemperature}
                placeholder="98.6"
                keyboardType="decimal-pad"
                clearable={false}
              />
            </View>
            <View style={styles.vitalInputBox}>
              <Input
                label="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                placeholder="70"
                keyboardType="decimal-pad"
                clearable={false}
              />
            </View>
            <View style={styles.vitalInputBox}>
              <Input
                label="SpO2 (%)"
                value={spo2}
                onChangeText={setSpo2}
                placeholder="99"
                keyboardType="numeric"
                clearable={false}
              />
            </View>
          </View>
        </Card>

        {/* Clinical Notes & Quick Symptom Chips */}
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.sectionHeader, { color: colors.textPrimary }]}>
            Complaints & Clinical Notes
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
          >
            {SYMPTOM_CHIPS.map((sym) => {
              const active = notes.toLowerCase().includes(sym.toLowerCase());
              return (
                <Pressable
                  key={sym}
                  onPress={() => toggleSymptomChip(sym)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.symptomChip,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.surfaceSecondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.captionMedium,
                      { color: active ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {active ? `✓ ${sym}` : `+ ${sym}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Input
            placeholder="Document chief complaints, examination findings, symptoms..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            clearable={false}
            style={styles.notesInput}
          />
        </Card>

        <Button
          title="Scan Lab Report / Previous Rx"
          size="md"
          variant="outline"
          icon={<Ionicons name="scan-outline" size={18} color={colors.primary} />}
          onPress={() => navigation.navigate('ScannerModal', {})}
          style={styles.scanBtn}
        />
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View
        style={[
          styles.stickyFooter,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderSubtle,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <Button
          title="Write Rx"
          size="lg"
          variant="primary"
          icon={<Ionicons name="document-text-outline" size={19} color="#FFFFFF" />}
          onPress={() =>
            navigation.navigate('PrescriptionBuilder', {
              appointmentId: appointment?.id || 'apt-temp',
              patientId: patient.id,
              vitals: parsedVitals,
              notes,
            })
          }
          style={{ flex: 1.2, marginRight: spacing.sm }}
        />
        <Button
          title="Finish"
          size="lg"
          variant="accent"
          icon={<Ionicons name="checkmark-done" size={19} color="#FFFFFF" />}
          onPress={handleFinishConsult}
          style={{ flex: 0.9 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  patientBanner: {
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  patientBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  patientDetails: {
    flex: 1,
  },
  allergyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginTop: 6,
  },
  card: {
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vitalInputBox: {
    flex: 1,
    marginHorizontal: spacing.xxs,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  symptomChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  notesInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  scanBtn: {
    marginTop: spacing.sm,
  },
  stickyFooter: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
