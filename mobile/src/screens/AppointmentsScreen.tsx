/**
 * Appointments Management Screen
 * Status filter counts, search, pull-to-refresh, WhatsApp/call actions, and consultation triggers.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Linking,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Badge, Button, Input, EmptyState } from '../components';
import { RootStackParamList, Appointment, AppointmentStatus } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

type FilterType = 'all' | AppointmentStatus;

export const AppointmentsScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const { appointments, updateStatus } = useClinicData();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    HapticService.light();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const counts = useMemo(() => {
    const map: Record<FilterType, number> = {
      all: appointments.length,
      scheduled: 0,
      waiting: 0,
      in_consultation: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const a of appointments) {
      map[a.status] = (map[a.status] || 0) + 1;
    }
    return map;
  }, [appointments]);

  const filterTabs: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'waiting', label: 'Waiting' },
    { id: 'in_consultation', label: 'In Consult' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments.filter((apt) => {
      const matchesFilter = activeFilter === 'all' ? true : apt.status === activeFilter;
      if (!matchesFilter) return false;
      if (!q) return true;
      return (
        apt.patientName.toLowerCase().includes(q) ||
        apt.patientPhone.includes(q) ||
        (apt.tokenNumber && apt.tokenNumber.toString().includes(q)) ||
        (apt.chiefComplaint && apt.chiefComplaint.toLowerCase().includes(q))
      );
    });
  }, [appointments, activeFilter, searchQuery]);

  const renderAppointmentItem = ({ item }: { item: Appointment }) => (
    <Card
      onPress={() => {
        if (item.status === 'in_consultation' || item.status === 'waiting') {
          navigation.navigate('ConsultationRoom', {
            appointmentId: item.id,
            patientId: item.patientId,
          });
        } else {
          navigation.navigate('PatientDetail', { patientId: item.patientId });
        }
      }}
      style={styles.card}
      accessibilityLabel={`${item.patientName}, token ${item.tokenNumber || 'none'}, ${item.status}`}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.tokenPill, { backgroundColor: colors.primaryLight }]}>
          <Text style={[typography.badge, typography.tabular, { color: colors.primary }]}>
            TOKEN #{item.tokenNumber || '—'}
          </Text>
        </View>
        <View style={styles.headerBadges}>
          <Badge
            label={item.paymentStatus === 'paid' ? 'PAID' : `₹${item.fee}`}
            variant={item.paymentStatus === 'paid' ? 'paid' : 'default'}
            size="sm"
            style={{ marginRight: spacing.xs }}
          />
          <Badge label={item.status.replace('_', ' ')} variant={item.status} size="sm" />
        </View>
      </View>

      <View style={styles.patientInfoRow}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text numberOfLines={1} style={[typography.h3, { color: colors.textPrimary }]}>
            {item.patientName}
          </Text>
          <Text numberOfLines={1} style={[typography.caption, { color: colors.textSecondary }]}>
            {item.patientAge} yrs • {item.patientGender} • {item.patientPhone}
          </Text>
        </View>

        <View style={styles.contactButtons}>
          <Pressable
            onPress={() => {
              HapticService.light();
              const cleanDigits = item.patientPhone.replace(/\D/g, '');
              Linking.openURL(`https://wa.me/${cleanDigits}`).catch(() => {});
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={({ pressed }) => [
              styles.phoneBtn,
              { backgroundColor: colors.accentLight, opacity: pressed ? 0.75 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.patientName} on WhatsApp`}
          >
            <Ionicons name="logo-whatsapp" size={17} color={colors.accent} />
          </Pressable>
          <Pressable
            onPress={() => {
              HapticService.light();
              Linking.openURL(`tel:${item.patientPhone}`);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
            style={({ pressed }) => [
              styles.phoneBtn,
              {
                backgroundColor: colors.surfaceSecondary,
                marginLeft: spacing.xs,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Call ${item.patientName}`}
          >
            <Ionicons name="call-outline" size={17} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      {item.chiefComplaint ? (
        <View style={[styles.complaintBox, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            <Text style={{ fontWeight: '600', color: colors.textPrimary }}>Complaint: </Text>
            {item.chiefComplaint}
          </Text>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.timeSlotRow}>
          <Ionicons
            name={item.type === 'video' ? 'videocam-outline' : 'time-outline'}
            size={15}
            color={colors.textMuted}
          />
          <Text
            style={[
              typography.captionMedium,
              typography.tabular,
              styles.timeText,
              { color: colors.textSecondary },
            ]}
          >
            {item.timeSlot}
          </Text>
        </View>

        <View style={styles.actionRow}>
          {(item.status === 'waiting' || item.status === 'scheduled') && (
            <Button
              title="Start Consult"
              size="sm"
              variant="primary"
              onPress={() => {
                updateStatus({ id: item.id, status: 'in_consultation' });
                navigation.navigate('ConsultationRoom', {
                  appointmentId: item.id,
                  patientId: item.patientId,
                });
              }}
            />
          )}
          {item.status === 'in_consultation' && (
            <Button
              title="Resume"
              size="sm"
              variant="accent"
              onPress={() =>
                navigation.navigate('ConsultationRoom', {
                  appointmentId: item.id,
                  patientId: item.patientId,
                })
              }
            />
          )}
          {item.status === 'completed' && item.paymentStatus !== 'paid' && (
            <Button
              title="Collect Bill"
              size="sm"
              variant="outline"
              onPress={() =>
                navigation.navigate('BillingModal', {
                  appointmentId: item.id,
                  patientId: item.patientId,
                })
              }
            />
          )}
        </View>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Appointments"
        subtitle={`Today • ${filteredAppointments.length} showing`}
        rightAction={
          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('NewAppointmentModal', {});
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add new appointment"
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        }
      />

      {/* Search Input */}
      <View style={styles.searchWrapper}>
        <Input
          placeholder="Search name, phone, token, or complaint..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          returnKeyType="search"
          containerStyle={{ marginVertical: 0 }}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterTabs.map((tab) => {
            const isSelected = activeFilter === tab.id;
            const count = counts[tab.id] ?? 0;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  HapticService.selection();
                  setActiveFilter(tab.id);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    typography.captionMedium,
                    typography.tabular,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                  ]}
                >
                  {tab.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Appointment List */}
      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointmentItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing.xxxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No Appointments Found"
            description={
              searchQuery
                ? `No matches for "${searchQuery}". Try clearing your search.`
                : 'There are no appointments in this status right now.'
            }
            actionTitle={searchQuery ? 'Clear Search' : 'Book Appointment'}
            onAction={() => {
              if (searchQuery) setSearchQuery('');
              else navigation.navigate('NewAppointmentModal', {});
            }}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  filterBar: {
    paddingVertical: spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.xxs,
  },
  contactButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  complaintBox: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
  },
  timeSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    marginLeft: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
