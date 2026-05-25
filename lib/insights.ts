import { UserStackItem, DailyStackLog, UserProfile } from "./types";
import { formatGoalLabel } from "./productDisplay";

export interface StackInsightsResult {
  coverageScore: number;
  todayStatus: string;
  whatChanged: string[];
  opportunity: string[];
  weeklyActivity: number;
  mostSupported: string[];
  lessSupported: string[];
}

export function generateStackInsights(
  profile: UserProfile | null,
  stack: UserStackItem[],
  recentLogs: DailyStackLog[]
): StackInsightsResult {
  const trackedGoals = new Set([
    ...(profile?.primary_goals || []),
    ...(profile?.health_concerns || [])
  ]);

  const stackGoals = new Set<string>();
  const newGoalsThisWeek = new Set<string>();
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Goal mapping
  stack.forEach(item => {
    const isNew = item.created_at ? new Date(item.created_at) > sevenDaysAgo : false;
    
    item.product?.product_goals?.forEach(g => {
      stackGoals.add(g.goal);
      if (isNew) newGoalsThisWeek.add(g.goal);
    });
    item.product?.inferred_goals?.forEach(g => {
      stackGoals.add(g);
      if (isNew) newGoalsThisWeek.add(g);
    });
  });

  // Coverage Score
  let coverageScore = 0;
  let coveredCount = 0;
  if (trackedGoals.size > 0) {
    trackedGoals.forEach(g => {
      if (stackGoals.has(g)) coveredCount++;
    });
    coverageScore = Math.round((coveredCount / trackedGoals.size) * 100);
  }

  // Today's Status
  const todayStr = new Date().toISOString().split("T")[0];
  const todaysLogs = recentLogs.filter(l => l.log_date === todayStr);
  const itemsCompletedToday = todaysLogs.filter(l => l.taken).length;
  const totalScheduledToday = stack.length;
  
  let todayStatus = "Your stack is empty";
  if (totalScheduledToday > 0) {
    if (itemsCompletedToday === totalScheduledToday) {
      todayStatus = "All scheduled items complete ✓";
    } else {
      todayStatus = `${itemsCompletedToday} of ${totalScheduledToday} completed`;
    }
  }

  // What Changed
  const whatChanged: string[] = [];
  const newlySupported = Array.from(newGoalsThisWeek).filter(g => trackedGoals.has(g));
  if (newlySupported.length > 0) {
    whatChanged.push(`New this week: added support for ${newlySupported.map(formatGoalLabel).join(", ")}`);
  } else if (stack.length > 0) {
    whatChanged.push(`Your stack is stable this week. Consistent support is key.`);
  } else {
    whatChanged.push(`Build your daily routine to start seeing insights.`);
  }

  // Opportunity
  const opportunity: string[] = [];
  const lessCoverageGoals = Array.from(trackedGoals).filter(g => !stackGoals.has(g));
  if (lessCoverageGoals.length > 0) {
    opportunity.push(`Your stack currently has less support for: ${lessCoverageGoals.map(formatGoalLabel).join(", ")}`);
  } else if (stack.length > 0) {
    opportunity.push(`Your stack strongly supports all your explicitly tracked goals.`);
  }

  // Weekly Reflection
  const activeDays = new Set<string>();
  recentLogs.forEach(log => {
    if (log.taken) {
      activeDays.add(log.log_date);
    }
  });

  const mostSupported = Array.from(trackedGoals).filter(g => stackGoals.has(g));

  return {
    coverageScore,
    todayStatus,
    whatChanged,
    opportunity,
    weeklyActivity: activeDays.size,
    mostSupported,
    lessSupported: lessCoverageGoals
  };
}
