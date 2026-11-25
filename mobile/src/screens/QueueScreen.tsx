/**
 * Live Patient Queue & Token Calling Screen
 * Real-time queue coordination, token caller, skip/no-show handling, and pull-to-refresh.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useClinicData } from '../hooks/useClinicData';
import { Header, Card, Button, Badge, EmptyState, LivePulseDot } from '../components';
import { RootStackParamList, QueueItem } from '../types';
import { spacing, typography, radii } from '../theme';
import { HapticService } from '../services/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export const QueueScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { colors } = useTheme();
  const { queue, callNext, isCallingNext, updateStatus } = useClinicData();
  const [refreshing, setRefreshing] = useState(false);

  const currentServing = queue.find((q) => q.status === 'in_consultation');
  const waitingPatients = queue.filter((q) => q.status === 'waiting');

  const onRefresh = () => {
    HapticService.light();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCallNext = async () => {
    const nextPatient = await callNext();
    if (nextPatient) {
      HapticService.success();
      navigation.navigate('ConsultationRoom', {
        appointmentId: nextPatient.appointmentId,
        patientId: nextPatient.patientId,
      });
    } else {
      Alert.alert('Queue Empty', 'No more patients currently waiting.');
    }
  };

  const handleSkipPatient = (item: QueueItem) => {
    Alert.alert(
      'Skip Token?',
      `Mark Token #${item.tokenNumber} (${item.patientName}) as No Show / Skipped?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip Token',
          style: 'destructive',
          onPress: () => updateStatus({ id: item.appointmentId, status: 'no_show' }),
        },
      ]
    );
  };

  const renderQueueItem = useCallback(({ item, index }: { item: QueueItem; index: number }) => (
    <Card
      onPress={() => navigation.navigate('PatientDetail', { patientId: item.patientId })}
      style={styles.queueCard}
      accessibilityLabel={`Token ${item.tokenNumber}, ${item.patientName}, estimated wait ${item.estimatedWaitMinutes} minutes`}
    >
      <View style={styles.queueRow}>
        <View style={[styles.tokenBox, { backgroundColor: colors.primaryLight }]}>
          <Text style={[typography.h3, typography.tabular, { color: colors.primary }]}>
            #{item.tokenNumber}
          </Text>
        </View>

        <View style={styles.queueDetails}>
          <View style={styles.nameBadgeRow}>
            <Text numberOfLines={1} style={[typography.subtitle, { color: colors.textPrimary, flexShrink: 1 }]}>
              {item.patientName}
            </Text>
            {index === 0 && (
              <Badge label="NEXT UP" variant="primary" size="sm" style={{ marginLeft: spacing.xs }} />
            )}
          </View>
          <Text style={[typography.caption, typography.tabular, { color: colors.textSecondary }]}>
            In: {item.checkInTime} • Est: {item.estimatedWaitMinutes} mins
          </Text>
          {item.chiefComplaint ? (
            <Text numberOfLines={1} style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {item.chiefComplaint}
            </Text>
          ) : null}
        </View>

        <View style={styles.rowActions}>
          <Pressable
            onPress={() => handleSkipPatient(item)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Skip token ${item.tokenNumber}`}
            style={({ pressed }) => [
              styles.skipBtn,
              { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="close-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Button
            title="Call In"
            size="sm"
            variant="primary"
            onPress={() => {
              updateStatus({ id: item.appointmentId, status: 'in_consultation' });
              navigation.navigate('ConsultationRoom', {
                appointmentId: item.appointmentId,
                patientId: item.patientId,
              });
            }}
          />
        </View>
      </View>
    </Card>
  ), [navigation, colors, updateStatus, handleSkipPatient]);

  const queueKeyExtractor = useCallback((item: QueueItem) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header
        title="Live Queue"
        subtitle={`${waitingPatients.length} patient${waitingPatients.length === 1 ? '' : 's'} waiting`}
        rightAction={
          <Pressable
            onPress={() => {
              HapticService.light();
              navigation.navigate('NewAppointmentModal', {});
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Add walk-in patient to queue"
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: colors.primaryLight, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
          </Pressable>
        }
      />

      {/* Now Serving Hero Display */}
      <View style={styles.nowServingContainer}>
        <Card
          variant="elevated"
          style={[
            styles.nowServingCard,
            currentServing && { borderColor: colors.primaryBorder },
          ]}
        >
          <View style={styles.servingHeaderRow}>
            <View style={[styles.liveBadge, { backgroundColor: colors.destructiveLight }]}>
              <LivePulseDot color={colors.destructive} size={6} style={{ marginRight: 6 }} />
              <Text style={[styles.liveText, { color: colors.destructive }]}>NOW SERVING</Text>
            </View>
            {currentServing && (
              <Badge label="IN CONSULTATION" variant="in_consultation" size="sm" />
            )}
          </View>

          {currentServing ? (
            <View style={styles.servingContent}>
              <Text style={[typography.h1, typography.tabular, styles.tokenLarge, { color: colors.primary }]}>
                Token #{currentServing.tokenNumber}
              </Text>
              <Text style={[typography.h3, { color: colors.textPrimary }]}>
                {currentServing.patientName}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Checked in at {currentServing.checkInTime}
                {currentServing.chiefComplaint ? ` • ${currentServing.chiefComplaint}` : ''}
              </Text>

              <View style={styles.servingButtons}>
                <Button
                  title="Open Consultation"
                  size="md"
                  variant="primary"
                  onPress={() =>
                    navigation.navigate('ConsultationRoom', {
                      appointmentId: currentServing.appointmentId,
                      patientId: currentServing.patientId,
                    })
                  }
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
                <Button
                  title="Finish"
                  size="md"
                  variant="outline"
                  onPress={() => {
                    updateStatus({ id: currentServing.appointmentId, status: 'completed' });
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={styles.emptyServing}>
              <Text style={[typography.bodyBold, { color: colors.textMuted }]}>
                Consultation room is ready
              </Text>
              <Button
                title="Call Next Patient"
                size="lg"
                variant="accent"
                loading={isCallingNext}
                icon={<Ionicons name="megaphone-outline" size={20} color="#FFFFFF" />}
                onPress={handleCallNext}
                style={styles.emptyCallNextBtn}
              />
            </View>
          )}
        </Card>
      </View>

      {/* Next Up Header */}
      <View style={styles.listHeaderRow}>
        <Text style={[typography.h3, { color: colors.textPrimary }]}>
          Waiting List ({waitingPatients.length})
        </Text>
        {currentServing && waitingPatients.length > 0 && (
          <Button
            title="Call Next"
            size="sm"
            variant="accent"
            loading={isCallingNext}
            onPress={handleCallNext}
          />
        )}
      </View>

      {/* Waiting Queue List */}
      <FlatList
        data={waitingPatients}
        keyExtractor={queueKeyExtractor}
        renderItem={renderQueueItem}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
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
            icon="checkmark-circle-outline"
            title="Queue is Clear"
            description="All patients have been consulted or the reception queue is currently empty."
            actionTitle="Add Walk-In"
            onAction={() => navigation.navigate('NewAppointmentModal', {})}
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
  nowServingContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xs,
  },
  nowServingCard: {
    padding: spacing.lg,
  },
  servingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: radii.full,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  servingContent: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  tokenLarge: {
    fontSize: 34,
    lineHeight: 40,
    marginBottom: spacing.xxs,
  },
  servingButtons: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    width: '100%',
  },
  emptyServing: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyCallNextBtn: {
    marginTop: spacing.md,
    minWidth: 210,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  queueCard: {
    marginVertical: spacing.xs,
    padding: spacing.md,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tokenBox: {
    width: 50,
    height: 50,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  queueDetails: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skipBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
});
