import { useState, useCallback, useMemo } from "react";
import { Alert, StyleSheet, Text, View, RefreshControl, Pressable } from "react-native";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { supabase } from "../../lib/supabase";
import { getUserStack, getLogsForDateRange, toggleDailyLog } from "../../lib/stack";
import { UserStackItem, DailyStackLog } from "../../lib/types";
import { generateStackInsights } from "../../lib/insights";
import { generateCoachInsights, CoachInsight } from "../../lib/coach";
import { ProductRow } from "../../src/components/ProductRow";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { syncNotifications } from "../../lib/notifications";
import { Ionicons } from "@expo/vector-icons";

export default function Tracker() {
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];

  const [stack, setStack] = useState<UserStackItem[]>([]);
  const [logs, setLogs] = useState<Record<string, DailyStackLog>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coachInsights, setCoachInsights] = useState<CoachInsight[]>([]);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
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
    let currentUser: any = null;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) return;
      currentUser = authData.user;

      const startDate = weekDates[0];
      const endDate = weekDates[6];

      const [userStack, weeklyLogs] = await Promise.all([
        getUserStack(currentUser.id),
        getLogsForDateRange(currentUser.id, startDate, endDate)
      ]);

      setStack(userStack);
      
      const logsMap: Record<string, DailyStackLog> = {};
      weeklyLogs.forEach(log => {
        logsMap[`${log.log_date}_${log.stack_item_id}`] = log;
      });
      setLogs(logsMap);

      const stackInsights = generateStackInsights(userPreferences as any, userStack, weeklyLogs);
      const generatedInsights = generateCoachInsights(stackInsights);
      setCoachInsights(generatedInsights);
      setCurrentInsightIndex(0);
    } catch (error: any) {
      console.error("Failed to load tracker data", error);
      Alert.alert("Error", "Could not load tracker.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      
      if (currentUser?.id) {
        syncNotifications(currentUser.id);
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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return;
    const user = authData.user;

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
      Alert.alert("Error", "Could not save progress.");
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
  const todayTakenCount = stack.filter(item => logs[`${todayString}_${item.id}`]?.taken).length;
  
  const weeklyProgress = weekDates.map(date => {
    const takenCountForDate = stack.filter(item => logs[`${date}_${item.id}`]?.taken).length;
    const percentage = totalCount > 0 ? (takenCountForDate / totalCount) * 100 : 0;
    return {
      date,
      dayLabel: new Date(date).toLocaleDateString('en-US', { weekday: 'narrow' }), // M, T, W, etc.
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
    let isComplete = false;
    
    if (blockTotal > 0) {
      if (blockRemaining === 0) {
        message = `${currentBlock.charAt(0).toUpperCase() + currentBlock.slice(1)} routine completed`;
        isComplete = true;
      } else if (blockTaken === 0) {
        message = `${blockTotal} scheduled for this ${currentBlock}`;
      } else {
        message = `${blockRemaining} remaining this ${currentBlock}`;
      }
    } else {
      if (remainingCount === 0) {
        message = "All routines completed for today";
        isComplete = true;
      } else {
        message = `${remainingCount} supplement${remainingCount > 1 ? 's' : ''} remaining today`;
      }
    }

    return (
      <View style={[styles.reminderCard, { backgroundColor: isComplete ? themeColors.backgroundSelected : themeColors.backgroundElement }]}>
        <Ionicons 
          name={isComplete ? "checkmark-circle" : "time-outline"} 
          size={18} 
          color={isComplete ? themeColors.success : themeColors.textSecondary} 
          style={{ marginRight: 10 }}
        />
        <Text style={[styles.reminderText, { color: themeColors.text }]}>{message}</Text>
      </View>
    );
  };

  const handleNextInsight = () => {
    if (coachInsights.length <= 1) return;
    setCurrentInsightIndex(prev => (prev + 1) % coachInsights.length);
  };

  const renderCoachInsight = () => {
    if (coachInsights.length === 0) return null;
    const insight = coachInsights[currentInsightIndex];

    return (
      <Pressable onPress={handleNextInsight}>
        <SoftCard style={[styles.coachCard, { borderColor: themeColors.border }]}>
          <View style={styles.coachHeader}>
            <View style={styles.coachTitle}>
              <Ionicons name="sparkles" size={14} color={themeColors.text} style={{ marginRight: 6 }} />
              <Text style={[styles.coachLabel, { color: themeColors.text }]}>AI Clinical Insight</Text>
            </View>
            {coachInsights.length > 1 && (
              <Ionicons name="swap-horizontal" size={14} color={themeColors.textMuted} />
            )}
          </View>
          <Text style={[styles.coachTitle, { color: themeColors.text }]}>{insight.title}</Text>
          <Text style={[styles.coachMessage, { color: themeColors.textSecondary }]}>{insight.message}</Text>
        </SoftCard>
      </Pressable>
    );
  };

  const renderSection = (title: string, timing: string) => {
    const items = stack.filter(item => item.timing === timing);
    if (items.length === 0) return null;
    
    const isPreferred = timing === preferredTime;

    return (
      <View style={styles.section} key={timing}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
          {isPreferred && (
            <View style={[styles.preferredBadge, { backgroundColor: themeColors.backgroundSelected }]}>
              <Text style={[styles.preferredBadgeText, { color: themeColors.textSecondary }]}>Preferred</Text>
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
                <View 
                  style={[
                    styles.checkbox, 
                    { borderColor: themeColors.border },
                    isTaken && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                  ]}
                >
                  {isTaken && <Ionicons name="checkmark" size={16} color={themeColors.background} />}
                </View>
              }
              style={[
                {
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.borderMuted,
                  marginBottom: Spacing.sm,
                },
                isTaken && { opacity: 0.5 }
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <PageContainer 
      scrollable 
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.text} />}
    >
      <View style={styles.screenHeader}>
        <Text style={[styles.screenTitle, { color: themeColors.text }]}>Tracker</Text>
        <Text style={[styles.screenSubtitle, { color: themeColors.textSecondary }]}>
          {totalCount === 0 
            ? "Configure schedule in Stack to begin tracking."
            : `${todayTakenCount} of ${totalCount} completed today`}
        </Text>
      </View>

      {renderCoachInsight()}
      {renderReminderCard()}

      {totalCount > 0 && (
        <SoftCard style={styles.weeklyCard}>
          <Text style={[styles.weeklyTitle, { color: themeColors.text }]}>Adherence History</Text>
          <View style={styles.weeklyRow}>
            {weeklyProgress.map((day) => (
              <View key={day.date} style={styles.weeklyDay}>
                <Text style={[styles.weeklyDayLabel, day.isToday && { color: themeColors.text, fontWeight: "700" }]}>
                  {day.dayLabel}
                </Text>
                <View style={[styles.weeklyBarBackground, { backgroundColor: themeColors.backgroundElement }]}>
                  <View 
                    style={[
                      styles.weeklyBarFill, 
                      { 
                        height: `${day.percentage || 4}%`,
                        backgroundColor: day.isToday ? themeColors.text : themeColors.textMuted
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.weeklyDayCount, day.isToday && { color: themeColors.text, fontWeight: "700" }]}>
                  {day.takenCountForDate}
                </Text>
              </View>
            ))}
          </View>
        </SoftCard>
      )}

      {totalCount > 0 ? (
        <View style={{ paddingHorizontal: 24 }}>
          {renderSection("Morning Routine", "morning")}
          {renderSection("Afternoon Routine", "afternoon")}
          {renderSection("Evening Routine", "evening")}
          {renderSection("As Needed", "as_needed")}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: themeColors.backgroundElement }]}>
            <Ionicons name="checkmark-done" size={32} color={themeColors.textSecondary} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: themeColors.text }]}>No Scheduled Items</Text>
          <Text style={[styles.emptyStateText, { color: themeColors.textSecondary }]}>
            Active formulations in your Daily Stack will appear here for daily tracking and optimization.
          </Text>
        </View>
      )}
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: { paddingBottom: 120 },
  screenHeader: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
  screenTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 16, marginTop: 4, fontWeight: "500" },

  coachCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1.5,
  },
  coachHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  coachHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  coachLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  coachTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  coachMessage: {
    fontSize: 14,
    lineHeight: 20,
  },

  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadii.xl,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 20,
  },
  reminderText: {
    fontSize: 14,
    fontWeight: "600",
  },

  weeklyCard: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  weeklyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  weeklyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 100,
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
  weeklyBarBackground: {
    width: 6,
    height: 60,
    borderRadius: 3,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  weeklyBarFill: {
    width: "100%",
    borderRadius: 3,
  },
  weeklyDayCount: {
    fontSize: 10,
    fontWeight: "600",
    color: "#8E8E93",
    marginTop: 6,
  },

  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  preferredBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  preferredBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});