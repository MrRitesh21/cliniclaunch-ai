/**
 * Root Stack Navigator with Modal and Screen Transitions
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../types';

// Navigators & Screens
import { MainTabNavigator } from './MainTabNavigator';
import { AuthScreen } from '../screens/AuthScreen';
import { ConsultationRoomScreen } from '../screens/ConsultationRoomScreen';
import { PatientDetailScreen } from '../screens/PatientDetailScreen';
import { PrescriptionBuilderScreen } from '../screens/PrescriptionBuilderScreen';
import { PrescriptionPreviewScreen } from '../screens/PrescriptionPreviewScreen';
import { NewAppointmentModal } from '../screens/NewAppointmentModal';
import { NewPatientModal } from '../screens/NewPatientModal';
import { BillingModal } from '../screens/BillingModal';
import { ScannerModal } from '../screens/ScannerModal';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null; // Or splash/loader
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="ConsultationRoom" component={ConsultationRoomScreen} />
          <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
          <Stack.Screen name="PrescriptionBuilder" component={PrescriptionBuilderScreen} />
          <Stack.Screen name="PrescriptionPreview" component={PrescriptionPreviewScreen} />

          {/* Native Modals */}
          <Stack.Group screenOptions={{ presentation: 'modal' }}>
            <Stack.Screen name="NewAppointmentModal" component={NewAppointmentModal} />
            <Stack.Screen name="NewPatientModal" component={NewPatientModal} />
            <Stack.Screen name="BillingModal" component={BillingModal} />
            <Stack.Screen name="ScannerModal" component={ScannerModal} />
          </Stack.Group>
        </>
      )}
    </Stack.Navigator>
  );
};
