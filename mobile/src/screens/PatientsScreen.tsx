/**
 * Patients Directory Screen
 * Searchable patient master list with clinical quick filters, allergy warnings, and pull-to-refresh.
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
import { Header, Card, Input, EmptyState, Badge } from '../components';
import { RootStackParamList, Patient } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type PatientFilter = 'all' | 'allergies' | 'frequent';

export const PatientsScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const { patients } = useClinicData();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<PatientFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    HapticService.light();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const counts = useMemo(
    () => ({
      all: patients.length,
      allergies: patients.filter((p) => p.allergies && p.allergies.length > 0).length,
      frequent: patients.filter((p) => p.totalVisits >= 3).length,
    }),
    [patients]
  );

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return patients.filter((p) => {
      if (filter === 'allergies' && (!p.allergies || p.allergies.length === 0)) return false;
      if (filter === 'frequent' && p.totalVisits < 3) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.medicalHistory && p.medicalHistory.some((m) => m.toLowerCase().includes(q))) ||
        (p.allergies && p.allergies.some((a) => a.toLowerCase().includes(q)))
      );
    });
  }, [patients, searchQuery, filter]);

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const renderPatientItem = ({ item }: { item: Patient }) => (
    <Card
      onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
      style={styles.card}
      accessibilityLabel={`${item.name}, ${item.age} years, ${item.totalVisits} visits`}
    >
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
          <Text style={[typography.h3, { color: colors.primary }]}>
            {getInitials(item.name)}
          </Text>
        </View>

        <View style={styles.details}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={[typography.subtitle, { color: colors.textPrimary, flex: 1 }]}>
              {item.name}
            </Text>
            {item.bloodGroup ? (
              <Badge label={item.bloodGroup} variant="primary" size="sm" style={{ marginLeft: spacing.xs }} />
            ) : null}
          </View>
          <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
            {item.age} yrs • {item.gender} • {item.phone}
          </Text>
          <Text style={[typography.caption, typography.tabular, { color: colors.textMuted, marginTop: 2 }]}>
            {item.totalVisits} visit{item.totalVisits === 1 ? '' : 's'} • Last: {item.lastVisit || 'First visit'}
          </Text>

          {item.allergies && item.allergies.length > 0 && (
            <View style={[styles.allergyTag, { backgroundColor: colors.destructiveLight }]}>
              <Ionicons name="warning-outline" size={12} color={colors.destructive} />
              <Text
                numberOfLines={1}
                style={[typography.captionMedium, { color: colors.destructive, marginLeft: 4 }]}
              >
                Allergy: {item.allergies.join(', ')}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => {
            HapticService.light();
            Linking.openURL(`tel:${item.phone}`);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={({ pressed }) => [
            styles.phoneBtn,
            { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.75 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Call ${item.name}`}
        >
          <Ionicons name="call-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Patients"
        subtitle={`${filteredPatients.length} registered records`}
        rightAction={
          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('NewPatientModal');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Register new patient"
          >
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View style={styles.searchWrapper}>
        <Input
          placeholder="Search name, phone, allergy, diagnosis..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          returnKeyType="search"
          containerStyle={{ marginVertical: 0 }}
        />
      </View>

      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'allergies', label: `Allergies (${counts.allergies})` },
              { id: 'frequent', label: `Frequent (${counts.frequent})` },
            ] as const
          ).map((chip) => {
            const isSelected = filter === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => {
                  HapticService.selection();
                  setFilter(chip.id);
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
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredPatients}
        keyExtractor={(item) => item.id}
        renderItem={renderPatientItem}
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
            icon="people-outline"
            title="No Patients Found"
            description={
              searchQuery
                ? `No patient matches "${searchQuery}".`
                : 'No patient matches this filter. Register a new patient record.'
            }
            actionTitle={searchQuery ? 'Clear Search' : 'Register Patient'}
            onAction={() => {
              if (searchQuery) setSearchQuery('');
              else navigation.navigate('NewPatientModal');
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  details: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  allergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    marginTop: 6,
  },
});
