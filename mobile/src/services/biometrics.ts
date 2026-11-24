/**
 * Biometric Authentication Service (Face ID / Touch ID / Fingerprint)
 */
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = '@clinicx_biometrics_enabled';

export const BiometricService = {
  /**
   * Check if the device hardware supports biometrics and has enrolled records
   */
  async checkAvailability(): Promise<{
    hasHardware: boolean;
    isEnrolled: boolean;
    supportedTypes: LocalAuthentication.AuthenticationType[];
  }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      return {
        hasHardware,
        isEnrolled,
        supportedTypes,
      };
    } catch {
      return {
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
      };
    }
  },

  /**
   * Prompt the user for biometric authorization
   */
  async authenticate(promptMessage: string = 'Unlock ClinicX with Biometrics'): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use PIN or Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      return result.success;
    } catch {
      return false;
    }
  },

  /**
   * Check if biometrics is turned on by the user in app settings
   */
  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch {
      return false;
    }
  },

  /**
   * Enable or disable biometrics in settings
   */
  async setEnabled(enable: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enable ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to save biometric preference', err);
    }
  },
};
