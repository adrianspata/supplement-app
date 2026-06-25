import { UserStackItem, DailyProtocolLog } from "./types";
import { formatGoalLabel } from "./productDisplay";

export interface StackInsightsResult {
  coverageScore: number;
  todayStatus: string;
  whatChanged: string[];
  opportunity: string[];
  weeklyActivity: number;
  mostSupported: string[];
  lessSupported: string[];
  healthSummary: string;
  goingWell: string[];
  focusArea: string[];
  recommendedAction: string;
  goalStatus: Record<string, 'improving' | 'stable' | 'needs_attention'>;
}

export function generateStackInsights(
  profile: any,
  stack: UserStackItem[],
  recentLogs: DailyProtocolLog[]
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
  const todaysLogs = recentLogs.filter(l => l.scheduled_for === todayStr);
  const itemsCompletedToday = todaysLogs.filter(l => l.status === 'taken').length;
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
    if (log.status === 'taken') {
      activeDays.add(log.scheduled_for);
    }
  });

  const mostSupported = Array.from(trackedGoals).filter(g => stackGoals.has(g));

  // Goal Status
  const goalStatus: Record<string, 'improving' | 'stable' | 'needs_attention'> = {};
  trackedGoals.forEach(g => {
    if (mostSupported.includes(g) && activeDays.size >= 4) {
      goalStatus[g] = 'improving';
    } else if (mostSupported.includes(g) && activeDays.size < 4) {
      goalStatus[g] = 'stable';
    } else if (lessCoverageGoals.includes(g)) {
      goalStatus[g] = 'needs_attention';
    } else {
      goalStatus[g] = 'stable';
    }
  });

  // Health Summary
  let healthSummary = "Not enough data yet. Complete daily check-ins to unlock deeper insights.";
  if (mostSupported.length > 0) {
    healthSummary = `${formatGoalLabel(mostSupported[0])} is your strongest supported goal this week.`;
  } else if (lessCoverageGoals.length > 0) {
    healthSummary = `${formatGoalLabel(lessCoverageGoals[0])} remains your biggest opportunity.`;
  } else if (activeDays.size > 2) {
    healthSummary = "You're building consistency with your routine.";
  }

  // Going Well
  const goingWell: string[] = [];
  if (activeDays.size > 0) {
    goingWell.push(`Logged supplements ${activeDays.size} day${activeDays.size > 1 ? 's' : ''} this week`);
  }
  if (mostSupported.length > 0) {
    goingWell.push(`${formatGoalLabel(mostSupported[0])}-supporting stack is consistent`);
  }
  if (goingWell.length === 0) {
    goingWell.push("Start building your routine to see what's going well");
  }
  
  // Focus Area
  const focusArea: string[] = [];
  if (lessCoverageGoals.length > 0) {
    lessCoverageGoals.slice(0, 2).forEach(g => {
      focusArea.push(`${formatGoalLabel(g)} support is currently low`);
    });
  } else if (stack.length > 0) {
    focusArea.push("All tracked goals are currently supported");
  } else {
    focusArea.push("Add products to your stack to support your goals");
  }

  // Recommended Action
  let recommendedAction = "Log your supplements today";
  if (itemsCompletedToday === totalScheduledToday && totalScheduledToday > 0) {
    recommendedAction = "Complete today's check-in";
  } else if (totalScheduledToday > 0) {
    recommendedAction = "Take your next scheduled stack";
  } else {
    recommendedAction = "Add a product that supports your goals";
  }

  return {
    coverageScore,
    todayStatus,
    whatChanged,
    opportunity,
    weeklyActivity: activeDays.size,
    mostSupported,
    lessSupported: lessCoverageGoals,
    healthSummary,
    goingWell,
    focusArea,
    recommendedAction,
    goalStatus
  };
}
