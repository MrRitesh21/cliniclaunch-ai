/**
 * ClinicX Mobile Domain & Navigation Types
 */

export type AppointmentStatus =
  | 'scheduled'
  | 'waiting'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus = 'paid' | 'pending' | 'partially_paid' | 'refunded';

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  allergies?: string[];
  medicalHistory?: string[];
  lastVisit?: string;
  totalVisits: number;
  email?: string;
  address?: string;
  avatarUrl?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientAge: number;
  patientGender: 'male' | 'female' | 'other';
  doctorId: string;
  doctorName: string;
  clinicId: string;
  dateTime: string;
  timeSlot: string;
  type: 'in_person' | 'video' | 'walk_in';
  status: AppointmentStatus;
  tokenNumber?: number;
  chiefComplaint?: string;
  notes?: string;
  fee: number;
  paymentStatus: PaymentStatus;
}

export interface QueueItem {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  tokenNumber: number;
  status: 'waiting' | 'in_consultation' | 'completed' | 'skipped';
  checkInTime: string;
  estimatedWaitMinutes: number;
  chiefComplaint?: string;
}

export interface MedicineItem {
  id: string;
  name: string;
  dosage: string; // e.g. "500mg"
  frequency: string; // e.g. "1-0-1" or "Twice daily"
  duration: string; // e.g. "5 days"
  timing: 'before_food' | 'after_food' | 'with_food' | 'anytime';
  instructions?: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  clinicName: string;
  date: string;
  vitals: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: string;
    weightKg?: number;
    spo2?: number;
  };
  symptoms: string[];
  diagnosis: string[];
  medicines: MedicineItem[];
  labTests: string[];
  advice: string;
  followUpDate?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  appointmentId?: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  date: string;
  items: {
    description: string;
    amount: number;
    quantity: number;
  }[];
  totalAmount: number;
  paidAmount: number;
  status: PaymentStatus;
  paymentMode?: 'cash' | 'upi' | 'card' | 'net_banking';
}

export interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  specialization: string;
  qualification: string;
  registrationNumber: string;
  clinicId: string;
  clinicName: string;
  avatarUrl?: string;
  phone: string;
}

export interface ClinicStats {
  todayAppointments: number;
  waitingInQueue: number;
  consultationsCompleted: number;
  todayRevenue: number;
}

// Navigation Param Lists
export type RootStackParamList = {
  Auth: undefined;
  MainTabs: undefined;
  ConsultationRoom: { appointmentId: string; patientId: string };
  PatientDetail: { patientId: string };
  PrescriptionBuilder: {
    appointmentId: string;
    patientId: string;
    vitals?: Prescription['vitals'];
    notes?: string;
  };
  PrescriptionPreview: { prescription: Prescription };
  NewAppointmentModal: { patientId?: string };
  NewPatientModal: undefined;
  BillingModal: { appointmentId?: string; patientId?: string };
  ScannerModal: { onScanComplete?: (uri: string) => void };
};

export type MainTabParamList = {
  DashboardTab: undefined;
  AppointmentsTab: undefined;
  PatientsTab: undefined;
  QueueTab: undefined;
  MoreTab: undefined;
};
