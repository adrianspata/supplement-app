import { DailyCheckIn, DailyProtocolLog, UserStackItem } from "./types";

export interface TrendCalculation {
  metric: 'sleep' | 'energy' | 'stress';
  label: string;
  icon: string;
  currentAverage: number | null;
  previousAverage: number | null;
  trend: 'improving' | 'stable' | 'declining';
  history7d: number[];
  history30d: number[];
}

export interface WeeklyReflectionData {
  streak: number;
  streakText: string;
  trends: TrendCalculation[];
  correlationText: string | null;
  areaNeedingFocus: string | null;
  bestSupportedGoal: string | null;
  recommendedAction: string;
  hasEnoughData: boolean;
  stackDaysCompleted: number;
}


// Get YYYY-MM-DD for offset days from today
export function getLocalDateString(offsetDays = 0): string {
  const today = new Date();
  today.setDate(today.getDate() + offsetDays);
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().split('T')[0];
}

export function computeTrendsAndReflection(
  checkins: DailyCheckIn[],
  logs: DailyProtocolLog[],
  userStack: UserStackItem[]
): WeeklyReflectionData {
  const todayStr = getLocalDateString(0);
  
  // 1. Map checkins and logs by date for easy lookup
  const checkinsByDate: Record<string, DailyCheckIn> = {};
  checkins.forEach(c => {
    checkinsByDate[c.checkin_date] = c;
  });

  const logsByDateAndStack: Record<string, Record<string, DailyProtocolLog>> = {};
  logs.forEach(l => {
    if (!logsByDateAndStack[l.scheduled_for]) {
      logsByDateAndStack[l.scheduled_for] = {};
    }
    logsByDateAndStack[l.scheduled_for][l.stack_item_id] = l;
  });

  // Determine stack completion for a date
  const isStackCompleted = (dateStr: string): boolean => {
    if (userStack.length === 0) return false;
    const dayLogs = logsByDateAndStack[dateStr] || {};
    const completedCount = userStack.filter(item => dayLogs[item.id]?.status === 'taken').length;
    return completedCount === userStack.length;
  };

  // 2. Streak calculation (Data Confidence)
  let streak = 0;
  let checkingDateOffset = 0;
  
  // We check starting from today or yesterday (in case they haven't logged today yet)
  let startOffset = 0;
  const loggedToday = checkinsByDate[todayStr] && 
    (checkinsByDate[todayStr].sleep_score !== null || 
     checkinsByDate[todayStr].energy_score !== null || 
     checkinsByDate[todayStr].stress_score !== null);
     
  if (!loggedToday) {
    // If not logged today, check if they logged yesterday to keep streak alive
    const yesterdayStr = getLocalDateString(-1);
    const loggedYesterday = checkinsByDate[yesterdayStr] && 
      (checkinsByDate[yesterdayStr].sleep_score !== null || 
       checkinsByDate[yesterdayStr].energy_score !== null || 
       checkinsByDate[yesterdayStr].stress_score !== null);
       
    if (loggedYesterday) {
      startOffset = -1;
    } else {
      startOffset = 0;
    }
  }

  checkingDateOffset = startOffset;
  while (true) {
    const checkDate = getLocalDateString(checkingDateOffset);
    const hasLog = checkinsByDate[checkDate] && 
      (checkinsByDate[checkDate].sleep_score !== null || 
       checkinsByDate[checkDate].energy_score !== null || 
       checkinsByDate[checkDate].stress_score !== null);
       
    if (hasLog) {
      streak++;
      checkingDateOffset--;
    } else {
      break;
    }
  }

  let streakText = "Gathering data — log daily to build accuracy.";
  if (streak >= 30) {
    streakText = `${streak}-day streak — insights are highly accurate.`;
  } else if (streak >= 14) {
    streakText = `${streak}-day streak — patterns are very reliable.`;
  } else if (streak >= 7) {
    streakText = `${streak}-day streak — insights are becoming more accurate.`;
  } else if (streak >= 3) {
    streakText = `${streak}-day streak — starting to see initial patterns.`;
  } else if (streak > 0) {
    streakText = `${streak}-day streak — keep logging to unlock insights.`;
  }

  const metrics: Array<{ key: 'sleep' | 'energy' | 'stress'; scoreField: 'sleep_score' | 'energy_score' | 'stress_score'; label: string; icon: string }> = [
    { key: 'sleep', scoreField: 'sleep_score', label: 'Sleep', icon: 'moon' },
    { key: 'energy', scoreField: 'energy_score', label: 'Energy', icon: 'flash' },
    { key: 'stress', scoreField: 'stress_score', label: 'Stress', icon: 'leaf' }
  ];

  const trends: TrendCalculation[] = metrics.map(({ key, scoreField, label, icon }) => {
    // Current period (Last 7 days: t-0 to t-6)
    const currentScores: number[] = [];
    const history7d: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const dateStr = getLocalDateString(-i);
      const score = checkinsByDate[dateStr]?.[scoreField];
      if (score !== null && score !== undefined) {
        currentScores.push(score);
        history7d.push(score);
      } else {
        history7d.push(0); // For rendering missing data
      }
    }

    // Previous period (Previous 7 days: t-7 to t-13)
    const previousScores: number[] = [];
    for (let i = 13; i >= 7; i--) {
      const dateStr = getLocalDateString(-i);
      const score = checkinsByDate[dateStr]?.[scoreField];
      if (score !== null && score !== undefined) {
        previousScores.push(score);
      }
    }

    // History (Last 30 days)
    const history30d: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = getLocalDateString(-i);
      const score = checkinsByDate[dateStr]?.[scoreField];
      history30d.push(score !== null && score !== undefined ? score : 0);
    }

    const currentAverage = currentScores.length > 0 
      ? Number((currentScores.reduce((a, b) => a + b, 0) / currentScores.length).toFixed(1)) 
      : null;
      
    const previousAverage = previousScores.length > 0 
      ? Number((previousScores.reduce((a, b) => a + b, 0) / previousScores.length).toFixed(1)) 
      : null;

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (currentAverage !== null && previousAverage !== null) {
      const delta = currentAverage - previousAverage;
      if (delta > 0.25) trend = 'improving';
      else if (delta < -0.25) trend = 'declining';
    }

    return {
      metric: key,
      label,
      icon,
      currentAverage,
      previousAverage,
      trend,
      history7d,
      history30d
    };
  });

  // 4. Goal Correlation V1
  // We look at the last 30 days. Split check-ins into completed-stack days vs missed-stack days.
  let correlationText: string | null = null;
  const completedDaysScores: Record<string, number[]> = { sleep: [], energy: [], stress: [] };
  const missedDaysScores: Record<string, number[]> = { sleep: [], energy: [], stress: [] };

  for (let i = 29; i >= 0; i--) {
    const dateStr = getLocalDateString(-i);
    const checkin = checkinsByDate[dateStr];
    if (checkin) {
      const completed = isStackCompleted(dateStr);
      metrics.forEach(({ key, scoreField }) => {
        const val = checkin[scoreField];
        if (val !== null && val !== undefined) {
          if (completed) {
            completedDaysScores[key].push(val);
          } else {
            missedDaysScores[key].push(val);
          }
        }
      });
    }
  }

  // Check if we have enough data (at least 3 completed days and 3 missed days)
  let bestCorrelation: { metric: string; diff: number } | null = null;
  metrics.forEach(({ key }) => {
    const completedCount = completedDaysScores[key].length;
    const missedCount = missedDaysScores[key].length;
    if (completedCount >= 3 && missedCount >= 3) {
      const completedAvg = completedDaysScores[key].reduce((a, b) => a + b, 0) / completedCount;
      const missedAvg = missedDaysScores[key].reduce((a, b) => a + b, 0) / missedCount;
      const diff = completedAvg - missedAvg;
      
      // We look for positive correlations with completing the stack
      if (diff > 0.3) {
        if (!bestCorrelation || diff > bestCorrelation.diff) {
          bestCorrelation = { metric: key, diff };
        }
      }
    }
  });

  if (bestCorrelation) {
    const { metric } = bestCorrelation;
    if (metric === 'sleep') {
      correlationText = "Your sleep scores tend to be higher on days you complete your routine.";
    } else if (metric === 'energy') {
      correlationText = "Energy appears more stable when your stack is completed.";
    } else if (metric === 'stress') {
      correlationText = "Stress levels may be connected to completing your daily stack.";
    }
  } else {
    // If we have check-ins and stack items, but not enough contrast or days
    const totalCheckinsWithScore = checkins.filter(c => c.sleep_score || c.energy_score || c.stress_score).length;
    if (totalCheckinsWithScore < 5 || userStack.length === 0) {
      correlationText = "Not enough data yet.";
    } else {
      correlationText = "Keep logging check-ins and stack items to unlock correlations.";
    }
  }

  // 5. Overall heuristic reflection fields
  // Best supported goal & focus area
  let areaNeedingFocus: string | null = null;
  let bestSupportedGoal: string | null = null;

  // Let's check trends to find area needing focus (the one declining or lowest average)
  const sortedTrends = [...trends].filter(t => t.currentAverage !== null);
  const decliningMetric = sortedTrends.find(t => t.trend === 'declining');
  
  if (decliningMetric) {
    areaNeedingFocus = decliningMetric.label;
  } else if (sortedTrends.length > 0) {
    // Find the one with the lowest score
    sortedTrends.sort((a, b) => (a.currentAverage || 0) - (b.currentAverage || 0));
    if ((sortedTrends[0].currentAverage || 0) < 3.0) {
      areaNeedingFocus = sortedTrends[0].label;
    }
  }

  // Best supported goal
  const improvingMetric = trends.find(t => t.trend === 'improving');
  if (improvingMetric) {
    bestSupportedGoal = improvingMetric.label;
  } else {
    sortedTrends.sort((a, b) => (b.currentAverage || 0) - (a.currentAverage || 0));
    if (sortedTrends.length > 0 && (sortedTrends[0].currentAverage || 0) >= 3.5) {
      bestSupportedGoal = sortedTrends[0].label;
    }
  }

  // Recommended next action
  let recommendedAction = "Log your check-in today to keep your streak alive.";
  const loggedTodayCheckin = checkinsByDate[todayStr];
  if (loggedTodayCheckin && loggedTodayCheckin.sleep_score && loggedTodayCheckin.energy_score && loggedTodayCheckin.stress_score) {
    if (userStack.length > 0 && !isStackCompleted(todayStr)) {
      recommendedAction = "Take and log your remaining daily stack items.";
    } else {
      recommendedAction = "Great job! You've logged your check-in and stack for today.";
    }
  }

  const hasEnoughData = checkins.filter(c => c.sleep_score !== null || c.energy_score !== null || c.stress_score !== null).length >= 3;

  // Calculate stack consistency over the last 7 days
  let stackDaysCompleted = 0;
  for (let i = 0; i < 7; i++) {
    const dateStr = getLocalDateString(-i);
    if (isStackCompleted(dateStr)) {
      stackDaysCompleted++;
    }
  }

  return {
    streak,
    streakText,
    trends,
    correlationText,
    areaNeedingFocus,
    bestSupportedGoal,
    recommendedAction,
    hasEnoughData,
    stackDaysCompleted
  };
}

