/**
 * Billing & Invoicing Modal
 * Generates bills, updates clinic revenue state, supports fee presets, and shares WhatsApp UPI receipts.
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
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Input, Button } from '../components';
import { RootStackParamList, Invoice } from '../types';
import { ShareService } from '../services/sharing';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'BillingModal'>;

const CONSULT_PRESETS = ['500', '800', '1000', '1500'];

export const BillingModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();
  const { patients, appointments, updatePayment } = useClinicData();

  const appointment = appointments.find((a) => a.id === route.params?.appointmentId);
  const [selectedPatientId, setSelectedPatientId] = useState(
    route.params?.patientId || appointment?.patientId || patients[0]?.id || ''
  );
  const patient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  const [consultFee, setConsultFee] = useState(String(appointment?.fee || 800));
  const [labFee, setLabFee] = useState('0');
  const [pharmacyFee, setPharmacyFee] = useState('0');
  const [paymentMode, setPaymentMode] = useState<'upi' | 'cash' | 'card'>('upi');
  const [isPaid, setIsPaid] = useState(true);

  const total =
    (parseInt(consultFee, 10) || 0) +
    (parseInt(labFee, 10) || 0) +
    (parseInt(pharmacyFee, 10) || 0);

  const handleGenerateInvoice = async () => {
    HapticService.success();
    if (appointment) {
      await updatePayment({
        appointmentId: appointment.id,
        paymentStatus: isPaid ? 'paid' : 'pending',
        fee: total,
      });
    }

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${Math.floor(100000 + Math.random() * 900000)}`,
      appointmentId: appointment?.id,
      patientId: patient?.id || 'pat-1',
      patientName: patient?.name || 'Patient',
      patientPhone: patient?.phone || '+919876543210',
      date: new Date().toLocaleDateString('en-IN'),
      items: [
        { description: 'Physician Consultation Fee', amount: parseInt(consultFee, 10) || 800, quantity: 1 },
        ...(parseInt(labFee, 10) > 0
          ? [{ description: 'Diagnostic / Lab Test Fee', amount: parseInt(labFee, 10), quantity: 1 }]
          : []),
        ...(parseInt(pharmacyFee, 10) > 0
          ? [{ description: 'Prescribed Medications', amount: parseInt(pharmacyFee, 10), quantity: 1 }]
          : []),
      ],
      totalAmount: total,
      paidAmount: isPaid ? total : 0,
      status: isPaid ? 'paid' : 'pending',
      paymentMode,
    };

    Alert.alert(
      'Invoice Generated',
      `Invoice #${invoice.invoiceNumber} for ₹${total.toLocaleString('en-IN')} created successfully.`,
      [
        {
          text: 'Send on WhatsApp',
          onPress: async () => {
            await ShareService.shareInvoiceViaWhatsApp(
              invoice.patientPhone,
              invoice,
              'clinicx@icici'
            );
            navigation.goBack();
          },
        },
        {
          text: 'Done',
          onPress: () => navigation.goBack(),
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
        title="Generate Invoice"
        subtitle={`Patient: ${patient?.name || 'Walk-in'}`}
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Optional Patient Switcher when opened directly */}
        {!route.params?.patientId && patients.length > 0 && (
          <Card style={styles.card}>
            <Text style={[typography.captionMedium, styles.label, { color: colors.textSecondary }]}>
              BILL TO PATIENT
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {patients.map((p) => {
                const selected = p.id === selectedPatientId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      HapticService.selection();
                      setSelectedPatientId(p.id);
                    }}
                    style={[
                      styles.patientChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceSecondary,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[typography.captionMedium, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>
                      {p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Card>
        )}

        {/* Bill Breakdown Card */}
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.sectionHeader, { color: colors.textPrimary }]}>
            Charges Breakdown
          </Text>

          <View style={styles.presetRow}>
            {CONSULT_PRESETS.map((amt) => {
              const active = consultFee === amt;
              return (
                <Pressable
                  key={amt}
                  onPress={() => {
                    HapticService.selection();
                    setConsultFee(amt);
                  }}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: active ? colors.primaryLight : colors.surfaceSecondary,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[typography.captionMedium, typography.tabular, { color: active ? colors.primary : colors.textPrimary }]}>
                    ₹{amt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Input
            label="Doctor Consultation Fee (₹)"
            value={consultFee}
            onChangeText={setConsultFee}
            keyboardType="numeric"
            clearable={false}
          />

          <Input
            label="Lab & Diagnostic Investigations (₹)"
            value={labFee}
            onChangeText={setLabFee}
            placeholder="0"
            keyboardType="numeric"
            clearable={false}
          />

          <Input
            label="Pharmacy & Medicine Dispensing (₹)"
            value={pharmacyFee}
            onChangeText={setPharmacyFee}
            placeholder="0"
            keyboardType="numeric"
            clearable={false}
          />

          <View style={[styles.totalBar, { backgroundColor: colors.primaryLight }]}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              Total Payable
            </Text>
            <Text style={[typography.h2, typography.tabular, { color: colors.primary }]}>
              ₹{total.toLocaleString('en-IN')}
            </Text>
          </View>
        </Card>

        {/* Payment Mode */}
        <Card style={styles.card}>
          <Text style={[typography.captionMedium, styles.label, { color: colors.textSecondary }]}>
            PAYMENT METHOD
          </Text>
          <View style={styles.modeRow}>
            {(
              [
                { id: 'upi', label: 'UPI / QR', icon: 'qr-code-outline' as const },
                { id: 'cash', label: 'Cash', icon: 'cash-outline' as const },
                { id: 'card', label: 'Card', icon: 'card-outline' as const },
              ] as const
            ).map((mode) => {
              const isSelected = paymentMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  onPress={() => {
                    HapticService.selection();
                    setPaymentMode(mode.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.modeBtn,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={mode.icon}
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
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              HapticService.selection();
              setIsPaid(!isPaid);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isPaid }}
            style={styles.statusToggleRow}
          >
            <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
              Mark as Received (Paid)
            </Text>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: isPaid ? colors.accent : 'transparent',
                  borderColor: isPaid ? colors.accent : colors.border,
                },
              ]}
            >
              {isPaid && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
            </View>
          </Pressable>
        </Card>

        <Button
          title={`Confirm Invoice (₹${total.toLocaleString('en-IN')})`}
          size="lg"
          variant="primary"
          onPress={handleGenerateInvoice}
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
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  label: {
    marginBottom: spacing.xs,
  },
  patientChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  modeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xxs,
  },
  statusToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});
