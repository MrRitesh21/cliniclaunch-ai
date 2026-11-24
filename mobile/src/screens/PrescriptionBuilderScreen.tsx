/**
 * Digital Prescription (Rx) Builder Screen
 * Quick-add clinical presets, frequency/timing pills, real vitals handoff, and preview.
 */
import React, { useState } from 'react';
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
import { Header, Card, Button, Input } from '../components';
import { RootStackParamList, MedicineItem, Prescription } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'PrescriptionBuilder'>;

const DIAGNOSIS_PRESETS = [
  'Viral Upper Respiratory Infection',
  'Acute Gastritis',
  'Essential Hypertension',
  'Type 2 Diabetes Mellitus',
  'Allergic Rhinitis',
];

const QUICK_DRUGS = [
  { name: 'Paracetamol 650mg', dosage: '650mg', freq: '1-0-1', dur: '3 days', timing: 'after_food' as const },
  { name: 'Azithromycin 500mg', dosage: '500mg', freq: '1-0-0', dur: '3 days', timing: 'after_food' as const },
  { name: 'Pan-D Capsule', dosage: '40mg', freq: '1-0-0', dur: '5 days', timing: 'before_food' as const },
  { name: 'Levocetirizine 5mg', dosage: '5mg', freq: '0-0-1', dur: '5 days', timing: 'after_food' as const },
];

const FREQ_OPTIONS = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', 'SOS'];
const DURATION_OPTIONS = ['3 days', '5 days', '7 days', '14 days'];
const TIMING_OPTIONS: { id: MedicineItem['timing']; label: string }[] = [
  { id: 'after_food', label: 'After Food' },
  { id: 'before_food', label: 'Before Food' },
  { id: 'with_food', label: 'With Food' },
  { id: 'anytime', label: 'Anytime' },
];

export const PrescriptionBuilderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();
  const { doctor } = useAuth();
  const { patients, appointments } = useClinicData();

  const appointment = appointments.find((a) => a.id === route.params.appointmentId);
  const patient = patients.find((p) => p.id === route.params.patientId);

  const [diagnosis, setDiagnosis] = useState('Viral Upper Respiratory Infection');
  const [advice, setAdvice] = useState(
    'Drink plenty of warm fluids. Adequate bed rest. Steam inhalation twice daily.'
  );
  const [followUp, setFollowUp] = useState('After 5 days');

  const [medicines, setMedicines] = useState<MedicineItem[]>([
    {
      id: 'med-1',
      name: 'Paracetamol 650mg (Dolo)',
      dosage: '650mg',
      frequency: '1-0-1',
      duration: '3 days',
      timing: 'after_food',
      instructions: 'Take when fever or body ache exceeds normal',
    },
    {
      id: 'med-2',
      name: 'Levocetirizine 5mg',
      dosage: '5mg',
      frequency: '0-0-1',
      duration: '5 days',
      timing: 'after_food',
      instructions: 'Take at night before sleeping',
    },
  ]);

  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('500mg');
  const [medFreq, setMedFreq] = useState('1-0-1');
  const [medDuration, setMedDuration] = useState('5 days');
  const [medTiming, setMedTiming] = useState<MedicineItem['timing']>('after_food');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddMedicine = () => {
    if (!medName.trim()) {
      Alert.alert('Required', 'Please enter medicine name.');
      return;
    }

    const newMed: MedicineItem = {
      id: `med-${Date.now()}`,
      name: medName.trim(),
      dosage: medDosage.trim() || 'Standard',
      frequency: medFreq,
      duration: medDuration,
      timing: medTiming,
    };

    setMedicines([...medicines, newMed]);
    setMedName('');
    setShowAddForm(false);
    HapticService.success();
  };

  const handleQuickAddDrug = (drug: (typeof QUICK_DRUGS)[number]) => {
    HapticService.light();
    setMedicines((prev) => [
      ...prev,
      {
        id: `med-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: drug.name,
        dosage: drug.dosage,
        frequency: drug.freq,
        duration: drug.dur,
        timing: drug.timing,
      },
    ]);
  };

  const handleRemoveMedicine = (id: string) => {
    HapticService.light();
    setMedicines(medicines.filter((m) => m.id !== id));
  };

  const handlePreview = () => {
    if (medicines.length === 0) {
      Alert.alert('Prescription Incomplete', 'Please add at least one medication.');
      return;
    }

    const prescription: Prescription = {
      id: `rx-${Date.now()}`,
      appointmentId: appointment?.id || 'apt-1',
      patientId: patient?.id || 'pat-1',
      patientName: patient?.name || appointment?.patientName || 'Patient Name',
      doctorId: doctor?.id || 'doc-101',
      doctorName: doctor?.name || 'Rohan Sharma',
      clinicName: doctor?.clinicName || 'Apollo Clinic & Diagnostic Centre',
      date: new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      vitals: route.params.vitals || {
        bloodPressure: '120/80',
        heartRate: 74,
        temperature: '98.6°F',
        weightKg: 68,
      },
      symptoms: route.params.notes
        ? route.params.notes.split(',').map((s) => s.trim()).filter(Boolean)
        : ['Fever', 'Cough'],
      diagnosis: diagnosis ? [diagnosis] : ['General Consultation'],
      medicines,
      labTests: ['Complete Blood Count (CBC) if symptoms persist'],
      advice,
      followUpDate: followUp,
    };

    navigation.navigate('PrescriptionPreview', { prescription });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Header
        title="Write Prescription"
        subtitle={`Rx for ${patient?.name || appointment?.patientName || 'Patient'}`}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <Button
            title="Preview"
            size="sm"
            variant="primary"
            onPress={handlePreview}
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
        {/* Diagnosis Card */}
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.sectionHeader, { color: colors.textPrimary }]}>
            Primary Diagnosis
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {DIAGNOSIS_PRESETS.map((preset) => {
              const selected = diagnosis === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => {
                    HapticService.selection();
                    setDiagnosis(preset);
                  }}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: selected ? colors.primaryLight : colors.surfaceSecondary,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.captionMedium,
                      { color: selected ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Input
            placeholder="e.g. Acute Pharyngitis, Hypertension..."
            value={diagnosis}
            onChangeText={setDiagnosis}
          />
        </Card>

        {/* Medicines Section */}
        <Card style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              Medicines ({medicines.length})
            </Text>
            <Button
              title={showAddForm ? 'Close' : '+ Custom Drug'}
              size="sm"
              variant="outline"
              onPress={() => setShowAddForm(!showAddForm)}
            />
          </View>

          {/* One-tap common meds */}
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.xs }]}>
            QUICK ADD COMMON RX:
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
            {QUICK_DRUGS.map((drug) => (
              <Pressable
                key={drug.name}
                onPress={() => handleQuickAddDrug(drug)}
                style={({ pressed }) => [
                  styles.presetChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[typography.captionMedium, { color: colors.primary }]}>
                  + {drug.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Add Custom Medicine Form */}
          {showAddForm && (
            <View
              style={[
                styles.addForm,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <Text style={[typography.captionMedium, { color: colors.primary, marginBottom: spacing.xs }]}>
                NEW MEDICATION
              </Text>
              <Input
                label="Medicine Name"
                placeholder="e.g. Amoxicillin 500mg"
                value={medName}
                onChangeText={setMedName}
              />
              <Input
                label="Dosage / Strength"
                placeholder="e.g. 500mg, 5ml"
                value={medDosage}
                onChangeText={setMedDosage}
              />

              <Text style={[typography.captionMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                FREQUENCY
              </Text>
              <View style={styles.pillRow}>
                {FREQ_OPTIONS.map((f) => {
                  const active = medFreq === f;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => {
                        HapticService.selection();
                        setMedFreq(f);
                      }}
                      style={[
                        styles.smallPill,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[typography.captionMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[typography.captionMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                DURATION
              </Text>
              <View style={styles.pillRow}>
                {DURATION_OPTIONS.map((d) => {
                  const active = medDuration === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        HapticService.selection();
                        setMedDuration(d);
                      }}
                      style={[
                        styles.smallPill,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[typography.captionMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[typography.captionMedium, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                TIMING
              </Text>
              <View style={styles.pillRow}>
                {TIMING_OPTIONS.map((t) => {
                  const active = medTiming === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => {
                        HapticService.selection();
                        setMedTiming(t.id);
                      }}
                      style={[
                        styles.smallPill,
                        {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[typography.captionMedium, { color: active ? '#FFFFFF' : colors.textPrimary }]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Button
                title="Add to Prescription"
                size="md"
                variant="primary"
                onPress={handleAddMedicine}
                style={{ marginTop: spacing.md }}
              />
            </View>
          )}

          {/* Medicines List */}
          {medicines.map((med, index) => (
            <View
              key={med.id}
              style={[
                styles.medRow,
                {
                  borderBottomColor: colors.borderSubtle,
                  borderBottomWidth: index === medicines.length - 1 ? 0 : 1,
                },
              ]}
            >
              <View style={[styles.medIndexCircle, { backgroundColor: colors.primaryLight }]}>
                <Text style={[typography.captionMedium, typography.tabular, { color: colors.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.medDetails}>
                <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                  {med.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  {med.frequency} • {med.duration} • {med.timing.replace('_', ' ')}
                </Text>
                {med.instructions ? (
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {med.instructions}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => handleRemoveMedicine(med.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${med.name}`}
              >
                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
              </Pressable>
            </View>
          ))}
        </Card>

        {/* Advice & Instructions */}
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.sectionHeader, { color: colors.textPrimary }]}>
            Advice & Follow-Up
          </Text>
          <Input
            label="Lifestyle / Dietary Advice"
            placeholder="Special instructions, dietary restrictions..."
            value={advice}
            onChangeText={setAdvice}
            multiline
            numberOfLines={3}
            clearable={false}
          />
          <Input
            label="Follow-Up Schedule"
            placeholder="e.g. After 5 days, Next Monday"
            value={followUp}
            onChangeText={setFollowUp}
          />
        </Card>

        <Button
          title="Preview & Share Prescription"
          size="lg"
          variant="primary"
          icon={<Ionicons name="eye-outline" size={20} color="#FFFFFF" />}
          onPress={handlePreview}
          style={styles.previewBtn}
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
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  presetScroll: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  presetChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  addForm: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  smallPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  medIndexCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  medDetails: {
    flex: 1,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  previewBtn: {
    marginTop: spacing.md,
  },
});
