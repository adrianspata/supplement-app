import { StackInsightsResult } from "./insights";
import { formatGoalLabel } from "./productDisplay";

export type CoachInsightType = "coverage_growth" | "stack_evolution" | "consistency" | "goal_support" | "empty";

export interface CoachInsight {
  id: string;
  type: CoachInsightType;
  title: string;
  message: string;
}

export function generateCoachInsights(insights: StackInsightsResult | null): CoachInsight[] {
  const coachInsights: CoachInsight[] = [];

  if (!insights) {
    return coachInsights;
  }

  // 1. Consistency
  if (insights.weeklyActivity > 0) {
    let title = "Building Habits";
    let message = `You logged activity on ${insights.weeklyActivity} of the last 7 days.`;
    
    if (insights.weeklyActivity >= 6) {
      title = "Incredible Consistency";
      message = "You're on a great streak! You logged activity almost every day this week.";
    }
    
    coachInsights.push({
      id: "consistency",
      type: "consistency",
      title,
      message
    });
  }

  // 2. Stack Evolution
  if (insights.mostSupported.length > 0) {
    coachInsights.push({
      id: "stack_evolution",
      type: "stack_evolution",
      title: "Stack Evolution",
      message: `Your stack now supports ${insights.mostSupported.length} of your tracked goals.`
    });
  }

  // 3. Coverage Growth & Goal Support
  if (insights.whatChanged.length > 0 && insights.whatChanged[0].includes("New this week")) {
    coachInsights.push({
      id: "coverage_growth",
      type: "coverage_growth",
      title: "Coverage Growth",
      message: insights.whatChanged[0].replace("New this week: ", "This week you ") + "."
    });
  } else if (insights.mostSupported.length > 0) {
    // If nothing new, fallback to a general support message
    const topGoal = insights.mostSupported[0];
    coachInsights.push({
      id: "goal_support",
      type: "goal_support",
      title: "Goal Support",
      message: `Your stack provides strong support for ${formatGoalLabel(topGoal)}.`
    });
  }

  // Fallback empty state if we have literally nothing
  if (coachInsights.length === 0) {
    coachInsights.push({
      id: "empty",
      type: "empty",
      title: "Welcome to your Coach",
      message: "Log your daily stack activity to see personalized insights and progress here."
    });
  }

  return coachInsights;
}
