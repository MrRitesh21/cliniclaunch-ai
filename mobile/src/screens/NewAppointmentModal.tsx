/**
 * New Appointment & Walk-In Registration Modal
 * Supports preselected patientId, inline patient search, visit type icons, and fee presets.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Input, Button } from '../components';
import { RootStackParamList } from '../types';
import { HapticService } from '../services/haptics';
import { spacing, typography, radii } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'NewAppointmentModal'>;

const FEE_PRESETS = ['500', '800', '1000', '1500'];

export const NewAppointmentModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();
  const { doctor } = useAuth();
  const { patients, addAppointment } = useClinicData();

  const initialPatientId = route.params?.patientId || patients[0]?.id || '';
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [patientSearch, setPatientSearch] = useState('');
  const [complaint, setComplaint] = useState('');
  const [type, setType] = useState<'in_person' | 'video' | 'walk_in'>('walk_in');
  const [fee, setFee] = useState('800');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visiblePatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.phone.includes(q)
    );
  }, [patients, patientSearch]);

  const selectedPatient =
    patients.find((p) => p.id === selectedPatientId) || visiblePatients[0] || patients[0];

  const handleBook = async () => {
    if (!selectedPatient) {
      Alert.alert('Required', 'Please select or register a patient first.');
      return;
    }

    setIsSubmitting(true);
    const created = await addAppointment({
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      patientPhone: selectedPatient.phone,
      patientAge: selectedPatient.age,
      patientGender: selectedPatient.gender,
      doctorId: doctor?.id || 'doc-101',
      doctorName: doctor?.name || 'Rohan Sharma',
      clinicId: doctor?.clinicId || 'clinic-apollo-delhi',
      dateTime: new Date().toISOString(),
      timeSlot: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      status: 'waiting',
      chiefComplaint: complaint.trim() || 'General checkup',
      fee: parseInt(fee, 10) || 800,
      paymentStatus: 'pending',
    });
    setIsSubmitting(false);

    Alert.alert(
      'Queue Token Generated',
      `Token #${created.tokenNumber} issued for ${selectedPatient.name}. Added to live queue.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Header
        title="Book Appointment / Walk-in"
        subtitle="Issues Live Queue Token"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <Button
            title="+ Patient"
            size="sm"
            variant="ghost"
            onPress={() => navigation.navigate('NewPatientModal')}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Patient Selector */}
        <Card style={styles.card}>
          <Text style={[typography.captionMedium, styles.label, { color: colors.textSecondary }]}>
            SELECT PATIENT
          </Text>

          <Input
            placeholder="Filter patients by name or phone..."
            value={patientSearch}
            onChangeText={setPatientSearch}
            leftIcon="search-outline"
            containerStyle={{ marginBottom: spacing.xs }}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientScroll}>
            {visiblePatients.map((p) => {
              const isSelected = selectedPatient?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    HapticService.selection();
                    setSelectedPatientId(p.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.patientChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.captionMedium,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedPatient && (
            <View style={[styles.selectedInfo, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                {selectedPatient.name}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                {selectedPatient.age} yrs • {selectedPatient.gender} • {selectedPatient.phone}
              </Text>
            </View>
          )}
        </Card>

        {/* Visit Type */}
        <Card style={styles.card}>
          <Text style={[typography.captionMedium, styles.label, { color: colors.textSecondary }]}>
            VISIT TYPE
          </Text>
          <View style={styles.typeRow}>
            {(
              [
                { id: 'walk_in', label: 'Walk-In', icon: 'walk-outline' as const },
                { id: 'in_person', label: 'Scheduled', icon: 'calendar-outline' as const },
                { id: 'video', label: 'Video Call', icon: 'videocam-outline' as const },
              ] as const
            ).map((item) => {
              const isSelected = type === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    HapticService.selection();
                    setType(item.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={isSelected ? '#FFFFFF' : colors.primary}
                    style={{ marginBottom: 3 }}
                  />
                  <Text
                    style={[
                      typography.captionMedium,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Complaint & Fee */}
        <Card style={styles.card}>
          <Input
            label="Chief Complaint / Reason for Visit"
            placeholder="e.g. Fever, persistent cough, report review..."
            value={complaint}
            onChangeText={setComplaint}
          />

          <Text style={[typography.captionMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
            QUICK FEE PRESETS
          </Text>
          <View style={styles.feePresetRow}>
            {FEE_PRESETS.map((preset) => {
              const active = fee === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => {
                    HapticService.selection();
                    setFee(preset);
                  }}
                  style={[
                    styles.feeChip,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.surfaceSecondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.captionMedium, typography.tabular, { color: active ? colors.primary : colors.textPrimary }]}>
                    ₹{preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Consultation Fee (₹)"
            placeholder="800"
            value={fee}
            onChangeText={setFee}
            keyboardType="numeric"
            clearable={false}
          />
        </Card>

        <Button
          title="Confirm & Generate Queue Token"
          size="lg"
          variant="primary"
          loading={isSubmitting}
          onPress={handleBook}
          style={styles.submitBtn}
        />
      </ScrollView>
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
  card: {
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
  },
  patientScroll: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  patientChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  selectedInfo: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
  },
  typeBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xxs,
  },
  feePresetRow: {
    flexDirection: 'row',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  feeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});
