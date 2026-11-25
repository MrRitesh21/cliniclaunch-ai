/**
 * Authentication Context for ClinicX Mobile
 * Supports Supabase Auth, Biometrics (Face ID/Touch ID), and Offline Mode
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { BiometricService } from '../services/biometrics';
import { HapticService } from '../services/haptics';
import { DoctorProfile } from '../types';
import { mockDoctor } from '../services/mockData';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  doctor: DoctorProfile | null;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  loginWithBiometrics: () => Promise<boolean>;
  toggleBiometrics: (enable: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AUTH_USER_STORAGE_KEY = '@clinicx_auth_doctor';

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  doctor: null,
  biometricAvailable: false,
  biometricEnabled: false,
  login: async () => false,
  loginWithBiometrics: async () => false,
  toggleBiometrics: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [doctor, setDoctor] = useState<DoctorProfile | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = async () => {
    try {
      // 1. Check biometrics hardware
      const bioInfo = await BiometricService.checkAvailability();
      const hasBio = bioInfo.hasHardware && bioInfo.isEnrolled;
      setBiometricAvailable(hasBio);

      const isBioOn = await BiometricService.isEnabled();
      setBiometricEnabled(isBioOn);

      // 2. Check cached doctor session (verify live Supabase session when configured)
      const cached = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (cached) {
        if (isSupabaseConfigured) {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData?.session?.user) {
            await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
            return;
          }
        }

        const parsedDoctor = JSON.parse(cached) as DoctorProfile;
        setDoctor(parsedDoctor);

        // If biometric is enabled, prompt user to unlock
        if (hasBio && isBioOn) {
          const success = await BiometricService.authenticate('Unlock ClinicX Doctor Portal');
          if (success) {
            setIsAuthenticated(true);
            HapticService.success();
          } else {
            // Stay unauthenticated so user can enter password or retry
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(true);
        }
      }
    } catch (err) {
      await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY).catch(() => {});
      console.warn('Auth check fallback', err);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedPassword = (password || '').trim();
    if (!normalizedEmail || !trimmedPassword) {
      HapticService.error();
      return false;
    }

    try {
      setIsLoading(true);
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: trimmedPassword,
        });
        if (error || !data?.user) {
          HapticService.error();
          return false;
        }
        const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
        const doc: DoctorProfile = {
          ...mockDoctor,
          id: data.user.id,
          email: data.user.email || normalizedEmail,
          name:
            typeof meta.full_name === 'string' && meta.full_name.trim()
              ? meta.full_name
              : typeof meta.name === 'string' && meta.name.trim()
                ? meta.name
                : mockDoctor.name,
          clinicName:
            typeof meta.clinic_name === 'string' && meta.clinic_name.trim()
              ? meta.clinic_name
              : mockDoctor.clinicName,
        };
        await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(doc));
        setDoctor(doc);
        setIsAuthenticated(true);
        HapticService.success();
        return true;
      }

      // Offline preview demo mode (only allowed when Supabase env vars are unconfigured)
      if (normalizedEmail !== mockDoctor.email.toLowerCase()) {
        HapticService.error();
        return false;
      }

      const doc: DoctorProfile = {
        ...mockDoctor,
        email: normalizedEmail,
      };

      await AsyncStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(doc));
      setDoctor(doc);
      setIsAuthenticated(true);
      HapticService.success();
      return true;
    } catch {
      HapticService.error();
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithBiometrics = async (): Promise<boolean> => {
    try {
      const cached = await AsyncStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (!cached) {
        HapticService.error();
        return false;
      }

      if (isSupabaseConfigured) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session?.user) {
          await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
          HapticService.error();
          return false;
        }
      }

      const success = await BiometricService.authenticate('Log in to ClinicX');
      if (!success) {
        HapticService.error();
        return false;
      }

      const doc = JSON.parse(cached) as DoctorProfile;
      setDoctor(doc);
      setIsAuthenticated(true);
      HapticService.success();
      return true;
    } catch {
      await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY).catch(() => {});
      HapticService.error();
      return false;
    }
  };

  const toggleBiometrics = async (enable: boolean) => {
    await BiometricService.setEnabled(enable);
    setBiometricEnabled(enable);
    HapticService.light();
  };

  const logout = async () => {
    HapticService.medium();
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut().catch(() => {});
      }
      await AsyncStorage.removeItem(AUTH_USER_STORAGE_KEY);
    } finally {
      setDoctor(null);
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        doctor,
        biometricAvailable,
        biometricEnabled,
        login,
        loginWithBiometrics,
        toggleBiometrics,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
