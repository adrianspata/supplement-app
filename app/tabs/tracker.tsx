import { useState, useCallback, useMemo } from "react";
import { Alert, StyleSheet, Text, View, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../../lib/supabase";
import { getUserStack, getLogsForDateRange, toggleDailyLog } from "../../lib/stack";
import { UserStackItem, DailyStackLog } from "../../lib/types";
import { ProductRow } from "../../src/components/ProductRow";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { syncNotifications } from "../../lib/notifications";

export default function Tracker() {
  const [stack, setStack] = useState<UserStackItem[]>([]);
  const [logs, setLogs] = useState<Record<string, DailyStackLog>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userPreferences } = useAuth();
  const preferredTime = userPreferences?.reminder_time;

  const getTodayString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    return new Date(today.getTime() - offset).toISOString().split('T')[0];
  };

  const getWeekDates = useCallback(() => {
    const today = new Date();
    const day = today.getDay(); // 0 is Sun, 1 is Mon
    const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diffToMon);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const offset = d.getTimezoneOffset() * 60000;
      dates.push(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  const weekDates = useMemo(() => getWeekDates(), [getWeekDates]);
  const todayString = getTodayString();

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = weekDates[0];
      const endDate = weekDates[6];

      const [userStack, weeklyLogs] = await Promise.all([
        getUserStack(user.id),
        getLogsForDateRange(user.id, startDate, endDate)
      ]);

      setStack(userStack);
      
      const logsMap: Record<string, DailyStackLog> = {};
      weeklyLogs.forEach(log => {
        logsMap[`${log.log_date}_${log.stack_item_id}`] = log;
      });
      setLogs(logsMap);
    } catch (error: any) {
      console.error("Failed to load tracker data", error);
      Alert.alert("Error", "Could not load today's stack.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      
      if (user?.id) {
        syncNotifications(user.id);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggle = async (item: UserStackItem) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const logKey = `${todayString}_${item.id}`;
    const currentLog = logs[logKey];
    const isCurrentlyTaken = currentLog?.taken ?? false;
    const newTakenState = !isCurrentlyTaken;

    setLogs(prev => ({
      ...prev,
      [logKey]: {
        ...prev[logKey],
        taken: newTakenState
      } as DailyStackLog
    }));

    try {
      await toggleDailyLog(
        user.id,
        item.id,
        item.product_id,
        todayString,
        newTakenState
      );
      
      syncNotifications(user.id);
    } catch (error: any) {
      console.error("Toggle error", error);
      Alert.alert("Error", "Could not save progress. Please try again.");
      setLogs(prev => ({
        ...prev,
        [logKey]: {
          ...prev[logKey],
          taken: isCurrentlyTaken
        } as DailyStackLog
      }));
    }
  };

  const totalCount = stack.length;
  
  // Progress calculations
  const todayTakenCount = stack.filter(item => logs[`${todayString}_${item.id}`]?.taken).length;
  
  const weeklyProgress = weekDates.map(date => {
    const takenCountForDate = stack.filter(item => logs[`${date}_${item.id}`]?.taken).length;
    const percentage = totalCount > 0 ? (takenCountForDate / totalCount) * 100 : 0;
    return {
      date,
      dayLabel: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }), // Mon, Tue
      percentage,
      isToday: date === todayString,
      takenCountForDate,
    };
  });

  const getCurrentTimeBlock = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  };
  const currentBlock = getCurrentTimeBlock();

  const blockItems = stack.filter(item => item.timing === currentBlock);
  const blockTotal = blockItems.length;
  const blockTaken = blockItems.filter(item => logs[`${todayString}_${item.id}`]?.taken).length;
  const blockRemaining = blockTotal - blockTaken;
  const remainingCount = totalCount - todayTakenCount;

  const renderReminderCard = () => {
    if (totalCount === 0) return null;

    let message = "";
    
    if (blockTotal > 0) {
      if (blockRemaining === 0) {
        message = `${currentBlock.charAt(0).toUpperCase() + currentBlock.slice(1)} stack complete ✓`;
      } else if (blockTaken === 0) {
        message = `${blockTotal} supplement${blockTotal > 1 ? 's' : ''} scheduled this ${currentBlock}`;
      } else {
        message = `${blockRemaining} supplement${blockRemaining > 1 ? 's' : ''} remaining this ${currentBlock}`;
      }
    } else {
      if (remainingCount === 0) {
        message = "All daily supplements complete ✓";
      } else {
        message = `${remainingCount} supplement${remainingCount > 1 ? 's' : ''} remaining today`;
      }
    }

    return (
      <View style={styles.reminderCard}>
        <Text style={styles.reminderEmoji}>{blockRemaining === 0 && (blockTotal > 0 || remainingCount === 0) ? '✨' : '⏰'}</Text>
        <Text style={styles.reminderText}>{message}</Text>
      </View>
    );
  };

  const renderSection = (title: string, timing: string) => {
    const items = stack.filter(item => item.timing === timing);
    if (items.length === 0) return null;
    
    const isPreferred = timing === preferredTime;

    return (
      <View style={styles.section} key={timing}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {isPreferred && (
            <View style={styles.preferredBadge}>
              <Text style={styles.preferredBadgeText}>★ Preferred</Text>
            </View>
          )}
        </View>
        {items.map(item => {
          if (!item.product) return null;
          const logKey = `${todayString}_${item.id}`;
          const isTaken = logs[logKey]?.taken ?? false;

          return (
            <ProductRow
              key={item.id}
              product={item.product}
              compact
              onPress={() => handleToggle(item)}
              rightAccessory={
                <View style={[styles.checkbox, isTaken && styles.checkboxChecked]}>
                  {isTaken && <Text style={styles.checkmark}>✓</Text>}
                </View>
              }
              style={isTaken ? styles.rowTaken : undefined}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Today's Stack</Text>
        <Text style={styles.screenSubtitle}>
          {totalCount === 0 
            ? "Your stack is empty. Add products from the Cabinet."
            : `${todayTakenCount} of ${totalCount} completed today`}
        </Text>
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderReminderCard()}
        
        {totalCount > 0 && (
          <View style={styles.weeklyCard}>
            <Text style={styles.weeklyTitle}>Weekly Progress</Text>
            <View style={styles.weeklyRow}>
              {weeklyProgress.map((day) => (
                <View key={day.date} style={styles.weeklyDay}>
                  <Text style={[styles.weeklyDayLabel, day.isToday && styles.weeklyDayLabelToday]}>
                    {day.dayLabel}
                  </Text>
                  <View style={styles.weeklyBarBackground}>
                    <View 
                      style={[
                        styles.weeklyBarFill, 
                        { height: `${day.percentage}%` },
                        day.isToday && styles.weeklyBarFillToday
                      ]} 
                    />
                  </View>
                  <Text style={[styles.weeklyDayCount, day.isToday && styles.weeklyDayCountToday]}>
                    {day.takenCountForDate}/{totalCount}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {totalCount > 0 ? (
          <>
            {renderSection("Morning", "morning")}
            {renderSection("Afternoon", "afternoon")}
            {renderSection("Evening", "evening")}
            {renderSection("As Needed", "as_needed")}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateEmoji}>📋</Text>
            <Text style={styles.emptyStateTitle}>No supplements yet</Text>
            <Text style={styles.emptyStateText}>
              Build your stack to start tracking daily supplements.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FAF9F6" },
  screenHeader: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 16 },
  screenTitle: { fontSize: 34, fontWeight: "800", color: "#1C1C1E", letterSpacing: -1 },
  screenSubtitle: { fontSize: 15, color: "#8E8E93", marginTop: 4 },

  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  weeklyCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  weeklyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 16,
  },
  weeklyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 90,
  },
  weeklyDay: {
    alignItems: "center",
    flex: 1,
  },
  weeklyDayLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 8,
  },
  weeklyDayLabelToday: {
    color: "#1C1C1E",
    fontWeight: "800",
  },
  weeklyBarBackground: {
    width: 8,
    height: 50,
    backgroundColor: "#F2F2F7",
    borderRadius: 4,
    justifyContent: "flex-end",
  },
  weeklyBarFill: {
    width: "100%",
    backgroundColor: "#C7C7CC",
    borderRadius: 4,
  },
  weeklyBarFillToday: {
    backgroundColor: "#1C1C1E",
  },
  weeklyDayCount: {
    fontSize: 9,
    fontWeight: "600",
    color: "#8E8E93",
    marginTop: 6,
  },
  weeklyDayCountToday: {
    color: "#1C1C1E",
    fontWeight: "800",
  },

  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  preferredBadge: {
    marginLeft: 12,
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  preferredBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  reminderEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  reminderText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#1C1C1E",
  },

  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E5EA",
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#1C1C1E",
    borderColor: "#1C1C1E",
  },
  checkmark: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },

  rowTaken: {
    opacity: 0.6,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  emptyStateEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 22,
  },
});