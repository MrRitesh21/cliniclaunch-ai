/**
 * Medical Document & Prescription Scanner Modal
 * Document type selector, camera/gallery upload, animated OCR loading state, and EMR attachment.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Header, Card, Button } from '../components';
import { RootStackParamList } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, 'ScannerModal'>;
type DocType = 'lab_report' | 'prescription' | 'imaging';

export const ScannerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteParams>();
  const { colors } = useTheme();

  const [docType, setDocType] = useState<DocType>('lab_report');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState<string | null>(null);

  const takePhoto = async () => {
    HapticService.light();
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to scan clinical reports.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        processScannedImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Camera Error', 'Could not access device camera.');
    }
  };

  const pickImage = async () => {
    HapticService.light();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        processScannedImage(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Gallery Error', 'Could not access photo library.');
    }
  };

  const processScannedImage = (uri: string) => {
    setImageUri(uri);
    setIsProcessing(true);
    HapticService.medium();

    setTimeout(() => {
      setIsProcessing(false);
      setExtractedSummary(
        docType === 'prescription'
          ? 'Scanned Prior Rx:\n• Tab. Telmisartan 40mg (1-0-0)\n• Tab. Metformin 500mg (1-0-1)\n• Follow-up noted for lipid profile'
          : docType === 'imaging'
          ? 'Scanned Imaging Report:\n• Chest X-Ray PA View\n• Clear lung fields bilaterally\n• Normal cardiothoracic ratio'
          : 'Scanned CBC Report:\n• Hemoglobin: 13.8 g/dL (Normal)\n• Platelets: 240,000 /mcL\n• WBC Count: 7,400 /mcL\n• ESR: 12 mm/hr (Normal)'
      );
      HapticService.success();
    }, 900);
  };

  const handleSaveToRecord = () => {
    HapticService.success();
    if (route.params?.onScanComplete && imageUri) {
      route.params.onScanComplete(imageUri);
    }
    Alert.alert(
      'Document Attached',
      'The document has been securely attached to the patient medical record.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Document & Lab Scanner"
        subtitle="Digitize physical paper records"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Category Chips */}
        <View style={styles.typeBar}>
          {(
            [
              { id: 'lab_report', label: 'Lab Report' },
              { id: 'prescription', label: 'Prior Rx' },
              { id: 'imaging', label: 'X-Ray / Scan' },
            ] as const
          ).map((item) => {
            const active = docType === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  HapticService.selection();
                  setDocType(item.id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[typography.captionMedium, { color: active ? '#FFFFFF' : colors.textSecondary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!imageUri ? (
          <View style={styles.captureOptions}>
            <Card variant="elevated" style={styles.optionCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="camera-outline" size={38} color={colors.primary} />
              </View>
              <Text style={[typography.h3, styles.optionTitle, { color: colors.textPrimary }]}>
                Scan with Camera
              </Text>
              <Text style={[typography.body, styles.optionDesc, { color: colors.textMuted }]}>
                Align the report or prescription inside the frame for instant optical scan.
              </Text>
              <Button
                title="Launch Camera"
                variant="primary"
                size="md"
                icon={<Ionicons name="camera" size={18} color="#FFFFFF" />}
                onPress={takePhoto}
                style={styles.actionBtn}
              />
            </Card>

            <Card variant="subtle" style={styles.optionCard}>
              <View style={[styles.iconCircle, { backgroundColor: colors.secondaryLight }]}>
                <Ionicons name="images-outline" size={36} color={colors.secondary} />
              </View>
              <Text style={[typography.h3, styles.optionTitle, { color: colors.textPrimary }]}>
                Upload from Gallery
              </Text>
              <Text style={[typography.body, styles.optionDesc, { color: colors.textMuted }]}>
                Select an existing photo, lab report, or scan from device photos.
              </Text>
              <Button
                title="Choose from Photos"
                variant="outline"
                size="md"
                onPress={pickImage}
                style={styles.actionBtn}
              />
            </Card>
          </View>
        ) : (
          <View style={styles.previewContainer}>
            <Card style={styles.imageCard}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
              <Button
                title="Retake Scan"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setImageUri(null);
                  setExtractedSummary(null);
                }}
                style={{ marginTop: spacing.xs }}
              />
            </Card>

            {isProcessing ? (
              <Card style={styles.processingCard}>
                <ActivityIndicator size="small" color={colors.primary} style={{ marginBottom: spacing.xs }} />
                <Text style={[typography.bodyBold, { color: colors.primary, textAlign: 'center' }]}>
                  Analyzing clinical document...
                </Text>
              </Card>
            ) : extractedSummary ? (
              <Card variant="elevated" style={styles.ocrCard}>
                <View style={styles.ocrHeader}>
                  <Ionicons name="sparkles" size={18} color={colors.accent} />
                  <Text style={[typography.subtitle, { color: colors.textPrimary, marginLeft: 6 }]}>
                    Extracted Clinical Summary
                  </Text>
                </View>
                <Text style={[typography.body, styles.ocrText, { color: colors.textPrimary }]}>
                  {extractedSummary}
                </Text>
              </Card>
            ) : null}

            <Button
              title="Save to Patient Record"
              size="lg"
              variant="accent"
              disabled={isProcessing}
              icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
              onPress={handleSaveToRecord}
              style={styles.saveBtn}
            />
          </View>
        )}
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
  typeBar: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xxs,
  },
  captureOptions: {
    paddingVertical: spacing.xs,
  },
  optionCard: {
    alignItems: 'center',
    padding: spacing.xl,
    marginVertical: spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  optionTitle: {
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  optionDesc: {
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 260,
  },
  actionBtn: {
    minWidth: 185,
  },
  previewContainer: {
    paddingVertical: spacing.xs,
  },
  imageCard: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 260,
    borderRadius: radii.md,
  },
  processingCard: {
    marginVertical: spacing.sm,
    padding: spacing.lg,
    alignItems: 'center',
  },
  ocrCard: {
    marginVertical: spacing.sm,
    padding: spacing.md,
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ocrText: {
    lineHeight: 22,
  },
  saveBtn: {
    marginTop: spacing.md,
  },
});
