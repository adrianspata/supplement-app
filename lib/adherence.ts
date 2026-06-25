import { supabase } from "./supabase";
import { UserStackItem, DailyProtocolLog } from "./types";
import { getTodayProtocol, getProtocolLogsForDateRange } from "./protocol";

// Helper: Get local date string YYYY-MM-DD for offset
export function getLocalDateString(offsetDays = 0): string {
  const today = new Date();
  today.setDate(today.getDate() + offsetDays);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().split('T')[0];
}

export interface AdherenceData {
  todayCompletionPercent: number;
  todayCompletedItems: number;
  totalActiveItems: number;
  weeklyCompletionPercent: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DeterministicInsight {
  mostConsistentTiming: string | null;
  mostSkippedProduct: { name: string, skippedCount: number } | null;
  trend: 'improving' | 'stable' | 'declining';
  trendValue: number; // Difference in percentage
}

export interface DailyCompletion {
  date: string;
  completed: number;
  total: number;
  percentage: number;
}

/**
 * Core engine to calculate adherence stats for the user.
 * It fetches the user's active stack and their protocol logs.
 */
export async function getAdherenceData(userId: string): Promise<AdherenceData> {
  const [todayProtocol, allLogsRes] = await Promise.all([
    getTodayProtocol(userId),
    supabase.from("daily_protocol_logs").select("*").eq("user_id", userId).order("scheduled_for", { ascending: false })
  ]);

  const allLogs: DailyProtocolLog[] = allLogsRes.data || [];
  
  // 1. Today's Completion
  const totalActiveItems = todayProtocol.length;
  const todayCompletedItems = todayProtocol.filter(i => i.status === 'taken').length;
  const todayCompletionPercent = totalActiveItems === 0 ? 0 : Math.round((todayCompletedItems / totalActiveItems) * 100);

  // Map logs by date to calculate streaks and weekly adherence
  // Note: This relies on the assumption that totalActiveItems has been constant.
  // A true robust engine would need historical stack size per day. For MVP, we use current active stack length.
  // If active stack is 0, history calculation is moot.
  const logsByDate: Record<string, DailyProtocolLog[]> = {};
  allLogs.forEach(log => {
    if (!logsByDate[log.scheduled_for]) logsByDate[log.scheduled_for] = [];
    logsByDate[log.scheduled_for].push(log);
  });

  const isDayCompleted = (dateStr: string) => {
    if (totalActiveItems === 0) return false;
    const takenCount = (logsByDate[dateStr] || []).filter(l => l.status === 'taken').length;
    return takenCount >= totalActiveItems;
  };

  // 2. Weekly Completion (Last 7 days including today)
  let weeklyTakenSum = 0;
  for (let i = 0; i < 7; i++) {
    const dStr = getLocalDateString(-i);
    const count = (logsByDate[dStr] || []).filter(l => l.status === 'taken').length;
    weeklyTakenSum += Math.min(count, totalActiveItems);
  }
  const weeklyCompletionPercent = totalActiveItems === 0 ? 0 : Math.round((weeklyTakenSum / (totalActiveItems * 7)) * 100);

  // 3. Current Streak
  let currentStreak = 0;
  let offset = 0;
  
  // Start from today if 100% complete, otherwise start from yesterday
  const todayStr = getLocalDateString(0);
  if (!isDayCompleted(todayStr)) {
    offset = -1;
  }

  while (true) {
    const dStr = getLocalDateString(offset);
    if (isDayCompleted(dStr)) {
      currentStreak++;
      offset--;
    } else {
      break;
    }
  }

  // 4. Longest Streak
  let longestStreak = 0;
  let tempStreak = 0;
  
  // To calculate longest streak, we iterate through all dates from the oldest log to today
  if (allLogs.length > 0) {
    const dates = Object.keys(logsByDate).sort(); // ascending
    if (dates.length > 0) {
      const oldestDate = new Date(dates[0]);
      const todayDate = new Date(todayStr);
      let d = new Date(oldestDate);
      
      while (d <= todayDate) {
        const dStr = d.toISOString().split('T')[0];
        if (isDayCompleted(dStr)) {
          tempStreak++;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          // Reset streak unless it's today and not completed yet
          if (dStr !== todayStr) {
            tempStreak = 0;
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }
  }

  return {
    todayCompletionPercent,
    todayCompletedItems,
    totalActiveItems,
    weeklyCompletionPercent,
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
  };
}

export async function getWeeklyInsights(userId: string, activeStack: UserStackItem[]): Promise<DeterministicInsight> {
  const [currentWeekLogs, lastWeekLogs] = await Promise.all([
    getProtocolLogsForDateRange(userId, getLocalDateString(-6), getLocalDateString(0)),
    getProtocolLogsForDateRange(userId, getLocalDateString(-13), getLocalDateString(-7))
  ]);

  const activeStackLength = activeStack.length;

  // 1. Trend Calculation
  const getTakenCount = (logs: DailyProtocolLog[]) => logs.filter(l => l.status === 'taken').length;
  
  const currentTaken = getTakenCount(currentWeekLogs);
  const lastTaken = getTakenCount(lastWeekLogs);
  
  const currentAvg = activeStackLength === 0 ? 0 : (currentTaken / (activeStackLength * 7)) * 100;
  const lastAvg = activeStackLength === 0 ? 0 : (lastTaken / (activeStackLength * 7)) * 100;
  
  const trendValue = Math.round(currentAvg - lastAvg);
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (trendValue > 5) trend = 'improving';
  if (trendValue < -5) trend = 'declining';

  // 2. Most Consistent Timing (Current week)
  const timingStats: Record<string, { total: number, taken: number }> = {};
  const stackTimingMap: Record<string, string> = {};
  activeStack.forEach(item => {
    stackTimingMap[item.id] = item.timing;
  });

  currentWeekLogs.forEach(log => {
    const timing = stackTimingMap[log.stack_item_id];
    if (timing) {
      if (!timingStats[timing]) timingStats[timing] = { total: 0, taken: 0 };
      timingStats[timing].total += 1;
      if (log.status === 'taken') timingStats[timing].taken += 1;
    }
  });

  let mostConsistentTiming: string | null = null;
  let highestPercentage = -1;

  for (const [timing, stats] of Object.entries(timingStats)) {
    const percentage = stats.taken / stats.total;
    if (percentage > highestPercentage && stats.total > 0) {
      highestPercentage = percentage;
      mostConsistentTiming = timing;
    }
  }

  // 3. Most Skipped Supplement (Current week)
  const productSkipCount: Record<string, number> = {};
  
  // Count how many days each active stack item was expected to be taken this week
  activeStack.forEach(item => {
    // Expected 7 times
    productSkipCount[item.product_id] = 7;
  });

  currentWeekLogs.forEach(log => {
    if (log.status === 'taken' && productSkipCount[log.product_id] !== undefined) {
      productSkipCount[log.product_id] -= 1;
    }
  });

  let mostSkippedProductId: string | null = null;
  let maxSkips = 0;

  for (const [productId, skips] of Object.entries(productSkipCount)) {
    if (skips > maxSkips && skips > 0) {
      maxSkips = skips;
      mostSkippedProductId = productId;
    }
  }

  let mostSkippedProduct = null;
  if (mostSkippedProductId) {
    const productItem = activeStack.find(i => i.product_id === mostSkippedProductId);
    if (productItem?.product) {
      let shortName = productItem.product.name || "Unknown";
      
      if (productItem.product.category) {
        // e.g. "Minerals / Magnesium" -> ["Minerals", "Magnesium"] -> "Magnesium"
        const parts = productItem.product.category.split(/[/,]/).map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          shortName = parts[parts.length - 1]; // take the most specific part
        }
      } else {
        // Fallback: Strip dosage, quantities, and anything after commas
        const match = shortName.match(/^([^\d,]+)/);
        if (match && match[1].trim().length > 2) {
          shortName = match[1].trim();
        }
      }

      mostSkippedProduct = {
        name: shortName || "Unknown",
        skippedCount: maxSkips
      };
    }
  }

  return {
    mostConsistentTiming,
    mostSkippedProduct,
    trend,
    trendValue
  };
}

export async function getDailyCompletionSeries(userId: string, days = 7): Promise<DailyCompletion[]> {
  const [todayProtocol, logsRes] = await Promise.all([
    getTodayProtocol(userId),
    supabase.from("daily_protocol_logs").select("*").eq("user_id", userId).order("scheduled_for", { ascending: false })
  ]);
  
  const totalActiveItems = todayProtocol.length;
  const logs: DailyProtocolLog[] = logsRes.data || [];
  
  const logsByDate: Record<string, DailyProtocolLog[]> = {};
  logs.forEach(log => {
    if (!logsByDate[log.scheduled_for]) logsByDate[log.scheduled_for] = [];
    logsByDate[log.scheduled_for].push(log);
  });
  
  const series: DailyCompletion[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dStr = getLocalDateString(-i);
    const completed = (logsByDate[dStr] || []).filter(l => l.status === 'taken').length;
    const cappedCompleted = Math.min(completed, totalActiveItems);
    const percentage = totalActiveItems === 0 ? 0 : Math.round((cappedCompleted / totalActiveItems) * 100);
    
    series.push({
      date: dStr,
      completed: cappedCompleted,
      total: totalActiveItems,
      percentage
    });
  }
  
  return series;
}
