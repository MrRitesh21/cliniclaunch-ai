/**
 * Main Tab Navigator (Bottom Tabs)
 * Optimized for iOS & Android with Safe Area insets, live queue badge, and Haptic feedback.
 */
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { HapticService } from '../services/haptics';
import { MainTabParamList } from '../types';
import { typography, radii } from '../theme';

// Screens
import { DashboardScreen } from '../screens/DashboardScreen';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { QueueScreen } from '../screens/QueueScreen';
import { PatientsScreen } from '../screens/PatientsScreen';
import { MoreScreen } from '../screens/MoreScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainTabNavigator: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { stats } = useClinicData();

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          height: 56 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          elevation: 10,
        },
        tabBarLabelStyle: {
          ...typography.captionMedium,
          fontSize: 11,
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.warning,
          color: colors.onWarning,
          fontSize: 10,
          fontWeight: '700',
          minWidth: 18,
          height: 18,
          borderRadius: 9,
        },
      }}
      screenListeners={{
        tabPress: () => {
          HapticService.selection();
        },
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarAccessibilityLabel: 'Home dashboard',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={focused ? 'grid' : 'grid-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="AppointmentsTab"
        component={AppointmentsScreen}
        options={{
          tabBarLabel: 'Schedule',
          tabBarAccessibilityLabel: 'Appointments schedule',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="QueueTab"
        component={QueueScreen}
        options={{
          tabBarLabel: 'Queue',
          tabBarAccessibilityLabel: `Live queue, ${stats.waitingInQueue} waiting`,
          tabBarBadge: stats.waitingInQueue > 0 ? stats.waitingInQueue : undefined,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={focused ? 'people' : 'people-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="PatientsTab"
        component={PatientsScreen}
        options={{
          tabBarLabel: 'Patients',
          tabBarAccessibilityLabel: 'Patients directory',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          tabBarLabel: 'Clinic',
          tabBarAccessibilityLabel: 'Clinic operations and settings',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconPill, focused && { backgroundColor: colors.primaryLight }]}>
              <Ionicons name={focused ? 'medical' : 'medical-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconPill: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
