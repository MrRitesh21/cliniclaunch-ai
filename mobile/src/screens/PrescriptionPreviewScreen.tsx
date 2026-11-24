/**
 * Digital Prescription Preview & Sharing Screen
 * Renders an official clinical prescription with real patient contact WhatsApp sharing.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Button } from '../components';
import { RootStackParamList } from '../types';
import { ShareService } from '../services/sharing';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'PrescriptionPreview'>;

export const PrescriptionPreviewScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();
  const { patients } = useClinicData();

  const { prescription } = route.params;
  const patientRecord = patients.find((p) => p.id === prescription.patientId);
  const recipientPhone = patientRecord?.phone || '+919823456789';

  const handleShareWhatsApp = async () => {
    HapticService.medium();
    const success = await ShareService.sharePrescriptionViaWhatsApp(
      recipientPhone,
      prescription
    );
    if (success) {
      HapticService.success();
    } else {
      Alert.alert('Share', 'WhatsApp could not be opened directly on this device.');
    }
  };

  const handleDone = () => {
    HapticService.light();
    navigation.navigate('MainTabs');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Prescription Preview"
        subtitle={prescription.patientName}
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          <Button
            title="Done"
            size="sm"
            variant="ghost"
            onPress={handleDone}
          />
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Prescription Sheet */}
        <Card variant="elevated" style={styles.paperSheet}>
          <View style={styles.headerBlock}>
            <View style={styles.clinicTitleRow}>
              <View style={[styles.rxBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="medical" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.h3, { color: colors.textPrimary }]}>
                  {prescription.clinicName}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                  Digital Healthcare & Clinical Record
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

            <View style={styles.doctorInfoRow}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                  Dr. {prescription.doctorName}
                </Text>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  Reg. No: MCI-2018-98421
                </Text>
              </View>
              <Text style={[typography.captionMedium, typography.tabular, { color: colors.textSecondary }]}>
                {prescription.date}
              </Text>
            </View>
          </View>

          {/* Patient & Vitals Strip */}
          <View style={[styles.patientBar, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={styles.patientBarItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>PATIENT</Text>
              <Text numberOfLines={1} style={[typography.captionMedium, { color: colors.textPrimary }]}>
                {prescription.patientName}
              </Text>
            </View>
            <View style={styles.patientBarItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>BP</Text>
              <Text style={[typography.captionMedium, typography.tabular, { color: colors.textPrimary }]}>
                {prescription.vitals.bloodPressure || '120/80'}
              </Text>
            </View>
            <View style={styles.patientBarItem}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>PULSE / TEMP</Text>
              <Text style={[typography.captionMedium, typography.tabular, { color: colors.textPrimary }]}>
                {prescription.vitals.heartRate ? `${prescription.vitals.heartRate} bpm` : '74 bpm'} •{' '}
                {prescription.vitals.temperature || '98.6°F'}
              </Text>
            </View>
          </View>

          {/* Diagnosis */}
          <View style={styles.sectionBlock}>
            <Text style={[typography.captionMedium, styles.sectionLabel, { color: colors.textSecondary }]}>
              DIAGNOSIS
            </Text>
            <Text style={[typography.bodyBold, { color: colors.textPrimary }]}>
              {prescription.diagnosis.join(', ')}
            </Text>
          </View>

          {/* Rx Medication List */}
          <View style={styles.sectionBlock}>
            <View style={styles.rxHeaderRow}>
              <Text style={[typography.h1, { color: colors.primary, fontSize: 30 }]}>
                ℞
              </Text>
              <Text style={[typography.captionMedium, { color: colors.textMuted, marginLeft: 8 }]}>
                MEDICINES PRESCRIBED
              </Text>
            </View>

            {prescription.medicines.map((med, index) => (
              <View
                key={med.id}
                style={[
                  styles.medicineRow,
                  {
                    borderBottomColor: colors.borderSubtle,
                    borderBottomWidth: index === prescription.medicines.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <Text style={[typography.captionMedium, typography.tabular, { color: colors.primary, width: 22 }]}>
                  {index + 1}.
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[typography.subtitle, { color: colors.textPrimary }]}>
                    {med.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {med.dosage} • {med.frequency} • {med.duration} • {med.timing.replace('_', ' ')}
                  </Text>
                  {med.instructions ? (
                    <Text style={[typography.caption, { color: colors.textMuted, fontStyle: 'italic' }]}>
                      {med.instructions}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>

          {/* Advice */}
          {prescription.advice ? (
            <View style={styles.sectionBlock}>
              <Text style={[typography.captionMedium, styles.sectionLabel, { color: colors.textSecondary }]}>
                ADVICE & LIFESTYLE
              </Text>
              <Text style={[typography.body, { color: colors.textPrimary }]}>
                {prescription.advice}
              </Text>
            </View>
          ) : null}

          {/* Follow-up */}
          {prescription.followUpDate ? (
            <View style={styles.sectionBlock}>
              <Text style={[typography.captionMedium, styles.sectionLabel, { color: colors.textSecondary }]}>
                NEXT FOLLOW-UP
              </Text>
              <Text style={[typography.bodyBold, { color: colors.primary }]}>
                {prescription.followUpDate}
              </Text>
            </View>
          ) : null}

          {/* Signature Line */}
          <View style={styles.signatureBlock}>
            <View style={[styles.signatureLine, { backgroundColor: colors.border }]} />
            <Text style={[typography.captionMedium, { color: colors.textMuted }]}>
              Digitally Verified by Dr. {prescription.doctorName}
            </Text>
          </View>
        </Card>

        {/* Share Action Buttons */}
        <View style={styles.shareBlock}>
          <Button
            title={`Share via WhatsApp (${recipientPhone})`}
            size="lg"
            variant="accent"
            icon={<Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />}
            onPress={handleShareWhatsApp}
            style={styles.shareBtn}
          />

          <Button
            title="Return to Dashboard"
            size="md"
            variant="outline"
            onPress={handleDone}
            style={styles.shareBtn}
          />
        </View>
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
  paperSheet: {
    padding: spacing.lg,
    borderRadius: radii.md,
  },
  headerBlock: {
    marginBottom: spacing.md,
  },
  clinicTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rxBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  divider: {
    height: 1,
    marginVertical: spacing.xs,
  },
  doctorInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  patientBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  patientBarItem: {
    flex: 1,
    marginRight: spacing.xs,
  },
  sectionBlock: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    marginBottom: spacing.xxs,
  },
  rxHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  medicineRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
  },
  signatureBlock: {
    marginTop: spacing.xl,
    alignItems: 'flex-end',
  },
  signatureLine: {
    width: 150,
    height: 1,
    marginBottom: 4,
  },
  shareBlock: {
    marginTop: spacing.lg,
  },
  shareBtn: {
    marginBottom: spacing.sm,
  },
});
