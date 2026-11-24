/**
 * React Query Hooks for Clinic Data (Appointments, Queue, Patients, Stats)
 * Uses shared React Query cache so mutations synchronize across all tabs and modals.
 */
import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockAppointments, mockPatients, mockQueue } from '../services/mockData';
import { Appointment, Patient, QueueItem, ClinicStats } from '../types';
import { HapticService } from '../services/haptics';

const KEYS = {
  appointments: ['clinic', 'appointments'] as const,
  patients: ['clinic', 'patients'] as const,
  queue: ['clinic', 'queue'] as const,
};

export function useClinicData() {
  const queryClient = useQueryClient();

  const appointmentsQuery = useQuery<Appointment[]>({
    queryKey: KEYS.appointments,
    queryFn: async () => queryClient.getQueryData<Appointment[]>(KEYS.appointments) ?? mockAppointments,
    initialData: mockAppointments,
    staleTime: Infinity,
  });

  const patientsQuery = useQuery<Patient[]>({
    queryKey: KEYS.patients,
    queryFn: async () => queryClient.getQueryData<Patient[]>(KEYS.patients) ?? mockPatients,
    initialData: mockPatients,
    staleTime: Infinity,
  });

  const queueQuery = useQuery<QueueItem[]>({
    queryKey: KEYS.queue,
    queryFn: async () => queryClient.getQueryData<QueueItem[]>(KEYS.queue) ?? mockQueue,
    initialData: mockQueue,
    staleTime: Infinity,
  });

  const appointments = appointmentsQuery.data ?? mockAppointments;
  const patients = patientsQuery.data ?? mockPatients;
  const queue = queueQuery.data ?? mockQueue;

  const stats: ClinicStats = useMemo(
    () => ({
      todayAppointments: appointments.length,
      waitingInQueue: queue.filter((q) => q.status === 'waiting').length,
      consultationsCompleted: appointments.filter((a) => a.status === 'completed').length,
      todayRevenue: appointments
        .filter((a) => a.paymentStatus === 'paid')
        .reduce((sum, a) => sum + a.fee, 0),
    }),
    [appointments, queue]
  );

  // Call Next Patient in Queue Mutation
  const callNextMutation = useMutation({
    mutationFn: async () => {
      const currentQueue = queryClient.getQueryData<QueueItem[]>(KEYS.queue) ?? queue;
      const currentApts = queryClient.getQueryData<Appointment[]>(KEYS.appointments) ?? appointments;

      const currentInConsult = currentQueue.find((q) => q.status === 'in_consultation');
      const nextWaiting = currentQueue.find((q) => q.status === 'waiting');

      const updatedQueue = currentQueue.map((item) => {
        if (currentInConsult && item.id === currentInConsult.id) {
          return { ...item, status: 'completed' as const };
        }
        if (nextWaiting && item.id === nextWaiting.id) {
          return { ...item, status: 'in_consultation' as const };
        }
        return item;
      });

      const updatedApts = currentApts.map((a) => {
        if (currentInConsult && a.id === currentInConsult.appointmentId) {
          return { ...a, status: 'completed' as const };
        }
        if (nextWaiting && a.id === nextWaiting.appointmentId) {
          return { ...a, status: 'in_consultation' as const };
        }
        return a;
      });

      queryClient.setQueryData<QueueItem[]>(KEYS.queue, updatedQueue);
      queryClient.setQueryData<Appointment[]>(KEYS.appointments, updatedApts);

      return nextWaiting;
    },
    onSuccess: () => {
      HapticService.success();
    },
  });

  // Update Appointment Status Mutation
  const updateAppointmentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Appointment['status'] }) => {
      const currentApts = queryClient.getQueryData<Appointment[]>(KEYS.appointments) ?? appointments;
      const currentQueue = queryClient.getQueryData<QueueItem[]>(KEYS.queue) ?? queue;

      queryClient.setQueryData<Appointment[]>(
        KEYS.appointments,
        currentApts.map((a) => (a.id === id ? { ...a, status } : a))
      );

      const mappedQueueStatus: QueueItem['status'] =
        status === 'in_consultation'
          ? 'in_consultation'
          : status === 'completed'
          ? 'completed'
          : status === 'cancelled' || status === 'no_show'
          ? 'skipped'
          : 'waiting';

      queryClient.setQueryData<QueueItem[]>(
        KEYS.queue,
        currentQueue.map((q) =>
          q.appointmentId === id ? { ...q, status: mappedQueueStatus } : q
        )
      );
    },
    onSuccess: () => {
      HapticService.light();
    },
  });

  // Mark Appointment Payment Status
  const updatePaymentMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      paymentStatus,
      fee,
    }: {
      appointmentId: string;
      paymentStatus: Appointment['paymentStatus'];
      fee?: number;
    }) => {
      const currentApts = queryClient.getQueryData<Appointment[]>(KEYS.appointments) ?? appointments;
      queryClient.setQueryData<Appointment[]>(
        KEYS.appointments,
        currentApts.map((a) =>
          a.id === appointmentId
            ? { ...a, paymentStatus, fee: fee ?? a.fee }
            : a
        )
      );
    },
  });

  // Add Patient Mutation
  const addPatientMutation = useMutation({
    mutationFn: async (newPatient: Omit<Patient, 'id' | 'totalVisits'>) => {
      const currentPatients = queryClient.getQueryData<Patient[]>(KEYS.patients) ?? patients;
      const patient: Patient = {
        ...newPatient,
        id: `pat-${Date.now()}`,
        totalVisits: 1,
        lastVisit: new Date().toISOString().split('T')[0],
      };
      queryClient.setQueryData<Patient[]>(KEYS.patients, [patient, ...currentPatients]);
      return patient;
    },
    onSuccess: () => {
      HapticService.success();
    },
  });

  // Add Walk-in / Appointment Mutation
  const addAppointmentMutation = useMutation({
    mutationFn: async (newApt: Omit<Appointment, 'id' | 'tokenNumber'>) => {
      const currentQueue = queryClient.getQueryData<QueueItem[]>(KEYS.queue) ?? queue;
      const currentApts = queryClient.getQueryData<Appointment[]>(KEYS.appointments) ?? appointments;

      const maxToken = currentQueue.reduce((max, q) => Math.max(max, q.tokenNumber), 10);
      const nextToken = maxToken + 1;
      const apt: Appointment = {
        ...newApt,
        id: `apt-${Date.now()}`,
        tokenNumber: nextToken,
      };
      const qItem: QueueItem = {
        id: `q-${Date.now()}`,
        appointmentId: apt.id,
        patientId: apt.patientId,
        patientName: apt.patientName,
        tokenNumber: nextToken,
        status: 'waiting',
        checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        estimatedWaitMinutes: 15 * (currentQueue.filter((q) => q.status === 'waiting').length + 1),
        chiefComplaint: apt.chiefComplaint,
      };

      queryClient.setQueryData<Appointment[]>(KEYS.appointments, [apt, ...currentApts]);
      queryClient.setQueryData<QueueItem[]>(KEYS.queue, [...currentQueue, qItem]);
      return apt;
    },
    onSuccess: () => {
      HapticService.success();
    },
  });

  return {
    appointments,
    isLoadingAppointments: appointmentsQuery.isLoading,
    patients,
    isLoadingPatients: patientsQuery.isLoading,
    queue,
    isLoadingQueue: queueQuery.isLoading,
    stats,
    callNext: callNextMutation.mutateAsync,
    isCallingNext: callNextMutation.isPending,
    updateStatus: updateAppointmentStatusMutation.mutateAsync,
    updatePayment: updatePaymentMutation.mutateAsync,
    addPatient: addPatientMutation.mutateAsync,
    addAppointment: addAppointmentMutation.mutateAsync,
  };
}
