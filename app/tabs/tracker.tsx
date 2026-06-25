import { useState, useCallback, useMemo, useEffect } from "react";
import { 
  Alert, 
  StyleSheet, 
  Text, 
  View, 
  Pressable, 
  ScrollView, 
  ActivityIndicator,
  Modal
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PageContainer } from "../../src/components/ui/PageContainer";
import { SoftCard } from "../../src/components/ui/SoftCard";
import { Colors, Spacing, BorderRadii, getContentContainerStyle } from "../../src/constants/theme";
import { useColorScheme } from "../../src/hooks/use-color-scheme";
import { supabase } from "../../lib/supabase";
import { getUserStack } from "../../lib/stack";
import { getProtocolLogsForDateRange, markStackItemTaken, unmarkStackItemTaken } from "../../lib/protocol";
import { UserStackItem, DailyProtocolLog } from "../../lib/types";
import { getAdherenceData, AdherenceData, getLocalDateString } from "../../lib/adherence";
import { getTodayCheckIn, upsertTodayCheckIn, getCheckInsForDateRange } from "../../lib/checkins";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../lib/auth-context";
import { Ionicons } from "@expo/vector-icons";

// Extra local check-in types
interface LocalCheckIn {
  mood?: number; // 1-5
  hydration?: number; // cups
  caffeine?: number; // mg
  food?: 'clean' | 'moderate' | 'poor';
  training?: 'none' | 'light' | 'moderate' | 'intense';
  skin?: 'clear' | 'okay' | 'flare-up';
}

export default function TrackerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scheme = useColorScheme();
  const colorScheme = scheme === "dark" ? "dark" : "light";
  const themeColors = Colors[colorScheme];
  const { userPreferences } = useAuth();

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString(0));
  const [stack, setStack] = useState<UserStackItem[]>([]);
  const [logs, setLogs] = useState<Record<string, DailyProtocolLog>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adherence, setAdherence] = useState<AdherenceData | null>(null);

  // Check-in database score states
  const [sleepVal, setSleepVal] = useState<number>(0);
  const [stressVal, setStressVal] = useState<number>(0);
  const [energyVal, setEnergyVal] = useState<number>(0);
  
  // Check-in local metric states
  const [localCheckIn, setLocalCheckIn] = useState<LocalCheckIn>({});

  // Weekly Completion Indicators maps
  const [weeklyCheckinsMap, setWeeklyCheckinsMap] = useState<Record<string, boolean>>({});
  const [weeklySupplementsCompleted, setWeeklySupplementsCompleted] = useState<Record<string, boolean>>({});

  // Unified logging modal state
  const [activeMetric, setActiveMetric] = useState<keyof LocalCheckIn | 'sleep' | 'stress' | 'energy' | null>(null);
  const [tempVal, setTempVal] = useState<any>(null);

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
  const todayString = getLocalDateString(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data?.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadData();
      }
    }, [userId, selectedDate])
  );

  useEffect(() => {
    if (params.openMetric && userId) {
      const metric = params.openMetric as string;
      if (["food", "sleep", "stress"].includes(metric)) {
        openLoggingModal(metric as any);
      }
      router.setParams({ openMetric: undefined });
    }
  }, [params.openMetric, userId]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const startDate = weekDates[0];
      const endDate = weekDates[6];

      // Parallel data fetching
      const [userStack, weeklyLogs, weeklyCheckins, checkInDb, adh] = await Promise.all([
        getUserStack(userId),
        getProtocolLogsForDateRange(userId, startDate, endDate),
        getCheckInsForDateRange(userId, startDate, endDate),
        supabase.from('daily_checkins').select('*').eq('user_id', userId).eq('checkin_date', selectedDate).maybeSingle(),
        getAdherenceData(userId)
      ]);

      setStack(userStack || []);
      setAdherence(adh);

      // Maps logs to state key
      const logsMap: Record<string, DailyProtocolLog> = {};
      (weeklyLogs || []).forEach(log => {
        logsMap[`${log.scheduled_for}_${log.stack_item_id}`] = log;
      });
      setLogs(logsMap);

      // Map DB Check-ins (Sleep, Energy, Stress)
      if (checkInDb.data) {
        setSleepVal(checkInDb.data.sleep_score || 0);
        setStressVal(checkInDb.data.stress_score || 0);
        setEnergyVal(checkInDb.data.energy_score || 0);
      } else {
        setSleepVal(0);
        setStressVal(0);
        setEnergyVal(0);
      }

      // Map Local Check-ins
      const localKey = `@basis_checkin_${userId}_${selectedDate}`;
      const savedLocal = await AsyncStorage.getItem(localKey);
      if (savedLocal) {
        setLocalCheckIn(JSON.parse(savedLocal));
      } else {
        setLocalCheckIn({});
      }

      // Compute weekly checkins mapped for indicators (Supabase only)
      const checkinsMap: Record<string, boolean> = {};
      (weeklyCheckins || []).forEach(ci => {
        if (ci.sleep_score || ci.energy_score || ci.stress_score) {
          checkinsMap[ci.checkin_date] = true;
        }
      });
      setWeeklyCheckinsMap(checkinsMap);

      // Compute supplement completion strip
      const supplementsCompletedMap: Record<string, boolean> = {};
      const activeStack = userStack || [];
      const totalDailySupplementsCount = activeStack.length;

      if (totalDailySupplementsCount > 0) {
        weekDates.forEach(date => {
          const takenCount = activeStack.filter(item => {
            const log = weeklyLogs?.find(l => l.scheduled_for === date && l.stack_item_id === item.id);
            return log?.status === 'taken';
          }).length;
          supplementsCompletedMap[date] = (takenCount === totalDailySupplementsCount);
        });
      }
      setWeeklySupplementsCompleted(supplementsCompletedMap);

    } catch (e) {
      console.error("Failed to load tracker data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggle = async (item: UserStackItem) => {
    if (!userId) return;

    const logKey = `${selectedDate}_${item.id}`;
    const currentLog = logs[logKey];
    const isCurrentlyTaken = currentLog?.status === 'taken';
    const newTakenState = !isCurrentlyTaken;

    setLogs(prev => ({
      ...prev,
      [logKey]: {
        ...prev[logKey],
        status: newTakenState ? 'taken' : 'pending'
      } as DailyProtocolLog
    }));

    try {
      if (newTakenState) {
        await markStackItemTaken(userId, item.id, item.product_id, selectedDate);
      } else {
        await unmarkStackItemTaken(userId, item.id, selectedDate);
      }

      // Update completion maps immediately
      const updatedLogs = await getProtocolLogsForDateRange(userId, weekDates[0], weekDates[6]);
      const logsMap: Record<string, DailyProtocolLog> = {};
      (updatedLogs || []).forEach(log => {
        logsMap[`${log.scheduled_for}_${log.stack_item_id}`] = log;
      });
      setLogs(logsMap);

      const supplementsCompletedMap: Record<string, boolean> = {};
      const totalDailySupplementsCount = stack.length;
      if (totalDailySupplementsCount > 0) {
        weekDates.forEach(date => {
          const takenCount = stack.filter(sItem => {
            const log = updatedLogs?.find(l => l.scheduled_for === date && l.stack_item_id === sItem.id);
            return log?.status === 'taken';
          }).length;
          supplementsCompletedMap[date] = (takenCount === totalDailySupplementsCount);
        });
      }
      setWeeklySupplementsCompleted(supplementsCompletedMap);

      getAdherenceData(userId).then(setAdherence);
    } catch (e) {
      console.error(e);
      setLogs(prev => ({
        ...prev,
        [logKey]: {
          ...prev[logKey],
          status: isCurrentlyTaken ? 'taken' : 'pending'
        } as DailyProtocolLog
      }));
      Alert.alert("Error", "Could not update status.");
    }
  };

  // Score updates persist to Database check-in
  const handleScoreChange = async (metric: 'sleep' | 'stress' | 'energy', value: number) => {
    if (!userId) return;

    if (metric === 'sleep') setSleepVal(value);
    if (metric === 'stress') setStressVal(value);
    if (metric === 'energy') setEnergyVal(value);

    const scores = {
      sleep_score: metric === 'sleep' ? value : (sleepVal || 3),
      stress_score: metric === 'stress' ? value : (stressVal || 3),
      energy_score: metric === 'energy' ? value : (energyVal || 3),
    };

    await upsertTodayCheckIn(userId, scores);
    getAdherenceData(userId).then(setAdherence);
  };

  // Local updates persist to AsyncStorage
  const saveLocalMetric = async (key: keyof LocalCheckIn, value: any) => {
    if (!userId) return;
    const updated = { ...localCheckIn, [key]: value };
    setLocalCheckIn(updated);

    const storageKey = `@basis_checkin_${userId}_${selectedDate}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const openLoggingModal = (metric: keyof LocalCheckIn | 'sleep' | 'stress' | 'energy') => {
    setActiveMetric(metric);
    if (metric === 'sleep') setTempVal(sleepVal || 3);
    else if (metric === 'stress') setTempVal(stressVal || 3);
    else if (metric === 'energy') setTempVal(energyVal || 3);
    else {
      const current = localCheckIn[metric];
      if (current === undefined || current === null) {
        if (metric === 'mood') setTempVal(3);
        else if (metric === 'hydration') setTempVal(0);
        else if (metric === 'caffeine') setTempVal(0);
        else if (metric === 'food') setTempVal('clean');
        else if (metric === 'training') setTempVal('none');
        else if (metric === 'skin') setTempVal('clear');
      } else {
        setTempVal(current);
      }
    }
  };

  const handleSaveModal = async () => {
    if (!activeMetric) return;

    if (activeMetric === 'sleep' || activeMetric === 'stress' || activeMetric === 'energy') {
      await handleScoreChange(activeMetric, tempVal);
    } else {
      await saveLocalMetric(activeMetric, tempVal);
    }

    loadData();
    setActiveMetric(null);
    setTempVal(null);
  };

  const getSelectedMonthString = () => {
    const d = new Date(selectedDate + 'T12:00:00Z');
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const moodEmoji = (val: number) => {
    if (val === 5) return "🤩";
    if (val === 4) return "😊";
    if (val === 3) return "🙂";
    if (val === 2) return "😐";
    return "😞";
  };

  const capitalize = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const totalCount = stack.length;

  const renderTimelineSection = (title: string, timing: string, icon: keyof typeof Ionicons.glyphMap) => {
    const items = stack.filter(item => item.timing === timing);
    if (items.length === 0) return null;

    return (
      <View style={styles.timelineSection}>
        <View style={styles.timelineHeader}>
          <Ionicons name={icon} size={15} color={themeColors.textSecondary} />
          <Text style={[styles.timelineTitle, { color: themeColors.textSecondary }]}>{title}</Text>
        </View>
        <View style={{ gap: 8 }}>
          {items.map(item => {
            if (!item.product) return null;
            const logKey = `${selectedDate}_${item.id}`;
            const isTaken = logs[logKey]?.status === 'taken';

            return (
              <Pressable
                key={item.id}
                style={[styles.supplementRow, isTaken && { opacity: 0.6 }]}
                onPress={() => handleToggle(item)}
              >
                <View style={[styles.recIconWrapper, { backgroundColor: themeColors.background }]}>
                  <Ionicons name="flask-outline" size={16} color={themeColors.text} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.supplementName, { color: themeColors.text }]} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={[styles.supplementInstruction, { color: themeColors.textSecondary }]}>
                    {item.dosage || "1 serving"} • {item.timing.replace('_', ' ')}
                  </Text>
                </View>
                <View style={[styles.checkbox, { borderColor: themeColors.border }, isTaken && { backgroundColor: themeColors.text, borderColor: themeColors.text }]}>
                  {isTaken && <Ionicons name="checkmark" size={12} color={themeColors.background} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  const renderCheckInRow = (
    metric: keyof LocalCheckIn | 'sleep' | 'stress' | 'energy',
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    valueString: string
  ) => {
    const isLogged = valueString !== "Not logged";

    return (
      <Pressable 
        style={styles.checkinRow}
        onPress={() => openLoggingModal(metric)}
      >
        <Ionicons name={icon} size={18} color={themeColors.textSecondary} style={{ marginRight: 12 }} />
        <Text style={[styles.checkinLabel, { color: themeColors.text }]}>{label}</Text>
        <Text style={[styles.checkinValue, { color: isLogged ? themeColors.text : themeColors.textMuted }]}>
          {valueString}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={themeColors.textMuted} style={{ marginLeft: 8 }} />
      </Pressable>
    );
  };

  const renderModalContent = () => {
    if (!activeMetric) return null;

    const titleMap: Record<string, string> = {
      mood: "Log Mood",
      hydration: "Log Hydration",
      caffeine: "Log Caffeine",
      sleep: "Log Sleep",
      stress: "Log Stress",
      energy: "Log Energy",
      food: "Log Food Quality",
      training: "Log Training Intensity",
      skin: "Log Skin Condition"
    };

    return (
      <View style={[styles.modalCard, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}>
        <Text style={[styles.modalTitle, { color: themeColors.text }]}>{titleMap[activeMetric]}</Text>
        
        <View style={styles.modalSelectorContainer}>
          {activeMetric === 'mood' && (
            <View style={styles.emojisRow}>
              {[
                { val: 1, char: "😞" },
                { val: 2, char: "😐" },
                { val: 3, char: "🙂" },
                { val: 4, char: "😊" },
                { val: 5, char: "🤩" }
              ].map(item => (
                <Pressable
                  key={item.val}
                  style={[styles.emojiBtn, tempVal === item.val && { backgroundColor: themeColors.backgroundSelected }]}
                  onPress={() => setTempVal(item.val)}
                >
                  <Text style={{ fontSize: 28 }}>{item.char}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {(activeMetric === 'sleep' || activeMetric === 'stress' || activeMetric === 'energy') && (
            <View style={{ width: '100%', alignItems: 'center' }}>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map(v => (
                  <Pressable
                    key={v}
                    style={[
                      styles.ratingBubble,
                      { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      tempVal === v && { backgroundColor: themeColors.text, borderColor: themeColors.text }
                    ]}
                    onPress={() => setTempVal(v)}
                  >
                    <Text style={[styles.ratingText, { color: themeColors.textSecondary }, tempVal === v && { color: themeColors.background }]}>{v}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.ratingHelpText, { color: themeColors.textSecondary }]}>
                {activeMetric === 'sleep' && (tempVal === 5 ? "Excellent recovery" : tempVal === 4 ? "Good sleep" : tempVal === 3 ? "Fair sleep" : tempVal === 2 ? "Restless" : "Poor sleep")}
                {activeMetric === 'stress' && (tempVal === 5 ? "High stress" : tempVal === 4 ? "Moderately stressed" : tempVal === 3 ? "Balanced" : tempVal === 2 ? "Calm" : "Fully relaxed")}
                {activeMetric === 'energy' && (tempVal === 5 ? "High energy" : tempVal === 4 ? "Good energy" : tempVal === 3 ? "Balanced" : tempVal === 2 ? "Low energy" : "Exhausted")}
              </Text>
            </View>
          )}

          {activeMetric === 'hydration' && (
            <View style={styles.counterRow}>
              <Pressable style={[styles.counterBtn, { borderColor: themeColors.border }]} onPress={() => setTempVal(Math.max(0, (tempVal || 0) - 1))}>
                <Ionicons name="remove" size={18} color={themeColors.text} />
              </Pressable>
              <Text style={[styles.counterVal, { color: themeColors.text }]}>{tempVal || 0} cups</Text>
              <Pressable style={[styles.counterBtn, { borderColor: themeColors.border }]} onPress={() => setTempVal((tempVal || 0) + 1)}>
                <Ionicons name="add" size={18} color={themeColors.text} />
              </Pressable>
            </View>
          )}

          {activeMetric === 'caffeine' && (
            <View style={styles.counterRow}>
              <Pressable style={[styles.counterBtn, { borderColor: themeColors.border }]} onPress={() => setTempVal(Math.max(0, (tempVal || 0) - 50))}>
                <Text style={{ fontSize: 11, color: themeColors.text, fontWeight: '700' }}>-50</Text>
              </Pressable>
              <Text style={[styles.counterVal, { color: themeColors.text }]}>{tempVal || 0} mg</Text>
              <Pressable style={[styles.counterBtn, { borderColor: themeColors.border }]} onPress={() => setTempVal((tempVal || 0) + 50)}>
                <Text style={{ fontSize: 11, color: themeColors.text, fontWeight: '700' }}>+50</Text>
              </Pressable>
            </View>
          )}

          {activeMetric === 'food' && (
            <View style={styles.togglesRow}>
              {[
                { label: 'Clean', val: 'clean' },
                { label: 'Moderate', val: 'moderate' },
                { label: 'Poor', val: 'poor' }
              ].map(opt => (
                <Pressable
                  key={opt.val}
                  style={[styles.toggleBtn, { borderColor: themeColors.border }, tempVal === opt.val && { backgroundColor: themeColors.text, borderColor: themeColors.text }]}
                  onPress={() => setTempVal(opt.val)}
                >
                  <Text style={[styles.toggleText, { color: themeColors.textSecondary }, tempVal === opt.val && { color: themeColors.background }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {activeMetric === 'training' && (
            <View style={styles.togglesRow}>
              {[
                { label: 'None', val: 'none' },
                { label: 'Light', val: 'light' },
                { label: 'Moderate', val: 'moderate' },
                { label: 'Intense', val: 'intense' }
              ].map(opt => (
                <Pressable
                  key={opt.val}
                  style={[styles.toggleBtn, { borderColor: themeColors.border }, tempVal === opt.val && { backgroundColor: themeColors.text, borderColor: themeColors.text }]}
                  onPress={() => setTempVal(opt.val)}
                >
                  <Text style={[styles.toggleText, { color: themeColors.textSecondary }, tempVal === opt.val && { color: themeColors.background }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {activeMetric === 'skin' && (
            <View style={styles.togglesRow}>
              {[
                { label: 'Clear', val: 'clear' },
                { label: 'Okay', val: 'okay' },
                { label: 'Flare-up', val: 'flare-up' }
              ].map(opt => (
                <Pressable
                  key={opt.val}
                  style={[styles.toggleBtn, { borderColor: themeColors.border }, tempVal === opt.val && { backgroundColor: themeColors.text, borderColor: themeColors.text }]}
                  onPress={() => setTempVal(opt.val)}
                >
                  <Text style={[styles.toggleText, { color: themeColors.textSecondary }, tempVal === opt.val && { color: themeColors.background }]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.modalActions}>
          <Pressable 
            style={[styles.modalCancelBtn, { borderColor: themeColors.border }]} 
            onPress={() => { setActiveMetric(null); setTempVal(null); }}
          >
            <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Pressable 
            style={[styles.modalSaveBtn, { backgroundColor: themeColors.text }]} 
            onPress={handleSaveModal}
          >
            <Text style={[styles.modalSaveText, { color: themeColors.background }]}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <PageContainer scrollable contentContainerStyle={getContentContainerStyle()}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.screenTitle, { color: themeColors.text }]}>Tracker</Text>
            <Text style={[styles.screenSubtitle, { color: themeColors.textSecondary }]}>
              {getSelectedMonthString()}
            </Text>
          </View>
          <Pressable 
            style={[styles.insightsButton, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}
            onPress={() => Alert.alert("Basis Insights", "Weekly Trends showing supplement adherence and biological check-ins will display here.")}
          >
            <Ionicons name="stats-chart-outline" size={20} color={themeColors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Calendar Strip (Bevel style) */}
      <View style={styles.calendarStrip}>
        {weekDates.map(date => {
          const dObj = new Date(date + 'T12:00:00Z');
          const dayName = dObj.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = dObj.getDate();
          const isSelected = selectedDate === date;
          const isToday = date === todayString;

          // Completion status indicators
          const hasSupplementsCompleted = weeklySupplementsCompleted[date];
          const hasCheckins = weeklyCheckinsMap[date];

          return (
            <Pressable
              key={date}
              style={[
                styles.calendarDayCol,
                isSelected && [styles.calendarDayActive, { backgroundColor: themeColors.text }],
              ]}
              onPress={() => setSelectedDate(date)}
            >
              <Text style={[styles.calendarDayLabel, { color: themeColors.textSecondary }, isSelected && { color: themeColors.background }]}>
                {dayName.charAt(0)}
              </Text>
              <Text style={[styles.calendarDayNumber, { color: themeColors.text }, isSelected && { color: themeColors.background, fontWeight: '800' }]}>
                {dayNum}
              </Text>
              <View style={styles.indicatorsRow}>
                {hasSupplementsCompleted && (
                  <View style={[styles.indicatorPill, { backgroundColor: isSelected ? themeColors.background : themeColors.success }]} />
                )}
                {hasCheckins && (
                  <View style={[styles.indicatorDot, { backgroundColor: isSelected ? themeColors.background : themeColors.textMuted }]} />
                )}
              </View>
              {isToday && !isSelected && <View style={[styles.todayIndicatorDot, { backgroundColor: themeColors.text }]} />}
            </Pressable>
          );
        })}
      </View>

      {/* Today's Plan */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Today's Plan</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color={themeColors.text} style={{ marginVertical: 20 }} />
        ) : totalCount === 0 ? (
          <SoftCard style={styles.emptyPlanCard} variant="elevated">
            <Text style={[styles.emptyPlanTitle, { color: themeColors.text }]}>No plan yet</Text>
            <Text style={[styles.emptyPlanText, { color: themeColors.textSecondary }]}>
              Create a Daily Plan to see what to take, track and improve.
            </Text>
            <Pressable 
              style={[styles.emptyPlanBtn, { backgroundColor: themeColors.text }]} 
              onPress={() => router.push("/tabs/stack?openAddModal=true")}
            >
              <Text style={[styles.emptyPlanBtnText, { color: themeColors.background }]}>Build Plan</Text>
            </Pressable>
          </SoftCard>
        ) : (
          <SoftCard style={styles.planCard} variant="elevated">
            {renderTimelineSection("Morning Routine", "morning", "sunny-outline")}
            {renderTimelineSection("Afternoon Routine", "afternoon", "partly-sunny-outline")}
            {renderTimelineSection("Evening Routine", "evening", "moon-outline")}
            {renderTimelineSection("As Needed", "as_needed", "pulse-outline")}
          </SoftCard>
        )}
      </View>

      {/* Daily Check-In */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>Daily Check-In</Text>
        
        <SoftCard style={styles.checkinCard} variant="elevated">
          {renderCheckInRow("mood", "happy-outline", "Mood", localCheckIn.mood ? `${moodEmoji(localCheckIn.mood)} (${localCheckIn.mood}/5)` : "Not logged")}
          {renderCheckInRow("hydration", "water-outline", "Hydration", localCheckIn.hydration ? `${localCheckIn.hydration} cups` : "Not logged")}
          {renderCheckInRow("caffeine", "cafe-outline", "Caffeine", localCheckIn.caffeine ? `${localCheckIn.caffeine} mg` : "Not logged")}
          {renderCheckInRow("sleep", "moon-outline", "Sleep Score", sleepVal > 0 ? `Score: ${sleepVal}/5` : "Not logged")}
          {renderCheckInRow("stress", "pulse-outline", "Stress Level", stressVal > 0 ? `Level: ${stressVal}/5` : "Not logged")}
          {renderCheckInRow("energy", "flash-outline", "Energy Level", energyVal > 0 ? `Level: ${energyVal}/5` : "Not logged")}
          {renderCheckInRow("food", "nutrition-outline", "Food Quality", localCheckIn.food ? capitalize(localCheckIn.food) : "Not logged")}
          {renderCheckInRow("training", "barbell-outline", "Training Status", localCheckIn.training ? capitalize(localCheckIn.training) : "Not logged")}
          {renderCheckInRow("skin", "sparkles-outline", "Skin Condition", localCheckIn.skin ? capitalize(localCheckIn.skin) : "Not logged")}
        </SoftCard>
      </View>

      {/* Unified Logging Modal Sheet */}
      <Modal
        visible={activeMetric !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setActiveMetric(null); setTempVal(null); }}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlayCloseZone} onPress={() => { setActiveMetric(null); setTempVal(null); }} />
          {renderModalContent()}
        </View>
      </Modal>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 140 },
  headerContainer: { paddingTop: Spacing.xl, paddingBottom: 12 },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 16, marginTop: 2, fontWeight: "500" },
  insightsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  calendarDayCol: {
    alignItems: 'center',
    width: 44,
    paddingVertical: 10,
    borderRadius: 22,
  },
  calendarDayActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  calendarDayLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  calendarDayNumber: {
    fontSize: 15,
    fontWeight: '600',
  },
  todayIndicatorDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
  indicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginTop: 4,
    height: 4,
  },
  indicatorPill: {
    width: 6,
    height: 3,
    borderRadius: 1.5,
  },
  indicatorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  emptyPlanCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadii.xl,
  },
  emptyPlanTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyPlanText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  emptyPlanBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadii.md,
  },
  emptyPlanBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  planCard: {
    padding: 20,
    borderRadius: BorderRadii.xl,
  },
  timelineSection: {
    marginBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  supplementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  recIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplementName: {
    fontSize: 14,
    fontWeight: '700',
  },
  supplementInstruction: {
    fontSize: 11,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinCard: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: BorderRadii.xl,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  checkinLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  checkinValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalOverlayCloseZone: {
    flex: 1,
  },
  modalCard: {
    borderTopLeftRadius: BorderRadii.xl,
    borderTopRightRadius: BorderRadii.xl,
    padding: 24,
    borderTopWidth: 1,
    minHeight: 280,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalSelectorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    marginBottom: 24,
    width: '100%',
  },
  emojisRow: {
    flexDirection: 'row',
    gap: 12,
  },
  emojiBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  ratingBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ratingHelpText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterVal: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 80,
    textAlign: 'center',
  },
  togglesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadii.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadii.md,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
  },
});