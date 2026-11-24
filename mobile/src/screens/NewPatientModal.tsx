/**
 * Register New Patient Modal
 * Inline validation, accessible radio groups, and KeyboardAvoidingView support.
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Input, Button } from '../components';
import { RootStackParamList } from '../types';
import { HapticService } from '../services/haptics';
import { spacing, typography, radii } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const NewPatientModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const { addPatient } = useClinicData();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [allergies, setAllergies] = useState('');
  const [history, setHistory] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string; age?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

  const handleSubmit = async () => {
    const nextErrors: { name?: string; phone?: string; age?: string } = {};
    if (!name.trim()) nextErrors.name = 'Patient name is required';
    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      nextErrors.phone = 'Enter a valid phone number';
    }
    const parsedAge = parseInt(age, 10);
    if (!age.trim() || Number.isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
      nextErrors.age = 'Valid age required';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      HapticService.error();
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    await addPatient({
      name: name.trim(),
      phone: phone.trim(),
      age: parsedAge,
      gender,
      bloodGroup,
      allergies: allergies ? allergies.split(',').map((a) => a.trim()).filter(Boolean) : [],
      medicalHistory: history ? history.split(',').map((h) => h.trim()).filter(Boolean) : [],
    });
    setIsSubmitting(false);

    Alert.alert('Registration Successful', `${name.trim()} has been added to ClinicX directory.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <Header
        title="Register New Patient"
        subtitle="Creates permanent EMR record"
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
        <Card style={styles.card}>
          <Text style={[typography.h3, styles.cardHeader, { color: colors.textPrimary }]}>
            Demographics
          </Text>

          <Input
            label="Full Name *"
            placeholder="e.g. Ramesh Kumar"
            value={name}
            onChangeText={(val) => {
              setName(val);
              if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
            }}
            error={errors.name}
            leftIcon="person-outline"
          />

          <Input
            label="Phone Number *"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={(val) => {
              setPhone(val);
              if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
            }}
            error={errors.phone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />

          <View style={styles.row}>
            <View style={{ flex: 0.8, marginRight: spacing.xs }}>
              <Input
                label="Age (Yrs) *"
                placeholder="32"
                value={age}
                onChangeText={(val) => {
                  setAge(val);
                  if (errors.age) setErrors((e) => ({ ...e, age: undefined }));
                }}
                error={errors.age}
                keyboardType="numeric"
                clearable={false}
              />
            </View>

            <View style={{ flex: 1.2, marginLeft: spacing.xs }}>
              <Text style={[typography.captionMedium, styles.genderLabel, { color: colors.textSecondary }]}>
                GENDER
              </Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((g) => {
                  const isSelected = gender === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => {
                        HapticService.selection();
                        setGender(g);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.genderBtn,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSecondary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typography.captionMedium,
                          { color: isSelected ? '#FFFFFF' : colors.textPrimary, textTransform: 'capitalize' },
                        ]}
                      >
                        {g}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <Text style={[typography.captionMedium, styles.sectionSubhead, { color: colors.textSecondary }]}>
            BLOOD GROUP
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bloodScroll}>
            {bloodGroups.map((bg) => {
              const isSelected = bloodGroup === bg;
              return (
                <Pressable
                  key={bg}
                  onPress={() => {
                    HapticService.selection();
                    setBloodGroup(bg);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.bloodChip,
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
                    {bg}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>

        <Card style={styles.card}>
          <Text style={[typography.h3, styles.cardHeader, { color: colors.textPrimary }]}>
            Clinical Background
          </Text>

          <Input
            label="Known Drug / Food Allergies"
            placeholder="e.g. Penicillin, Sulfa, Peanuts"
            helperText="Separate multiple allergies with commas"
            value={allergies}
            onChangeText={setAllergies}
          />

          <Input
            label="Pre-existing Conditions / History"
            placeholder="e.g. Hypertension, Diabetes Type 2, Asthma"
            helperText="Separate multiple conditions with commas"
            value={history}
            onChangeText={setHistory}
          />
        </Card>

        <Button
          title="Save & Register Patient"
          size="lg"
          variant="primary"
          loading={isSubmitting}
          onPress={handleSubmit}
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
  cardHeader: {
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  genderLabel: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  genderRow: {
    flexDirection: 'row',
    height: 44,
    alignItems: 'center',
  },
  genderBtn: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    marginHorizontal: 2,
  },
  sectionSubhead: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  bloodScroll: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  bloodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
});
