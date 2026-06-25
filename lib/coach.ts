import { UserStackItem } from "./types";
import { AdherenceData } from "./adherence";
import { AlignmentResult } from "./alignment";
import { calculateElexirScore } from "./scoring";
import { Ionicons } from "@expo/vector-icons";

export type CoachInsightType = "priority" | "win" | "risk" | "recommendation" | "empty";

export interface CoachInsight {
  id: string;
  type: CoachInsightType;
  title: string;
  message: string;
  icon: keyof typeof Ionicons.glyphMap;
  colorName: "success" | "warning" | "error" | "text" | "textSecondary";
}

export interface CoachState {
  hasProtocol: boolean;
  protocolScore: number;
  priorities: CoachInsight[];
  wins: CoachInsight[];
  risks: CoachInsight[];
  recommendations: CoachInsight[];
}

export function generateCoachState(
  adherence: AdherenceData | null,
  alignment: AlignmentResult | null,
  stack: UserStackItem[]
): CoachState {
  const hasProtocol = stack.length > 0;

  if (!hasProtocol) {
    return {
      hasProtocol: false,
      protocolScore: 0,
      priorities: [{
        id: "empty_priority",
        type: "priority",
        title: "Build your Daily Plan",
        message: "You have no active items. Search the formulary to start building your supplement routine.",
        icon: "add-circle-outline",
        colorName: "text"
      }],
      wins: [],
      risks: [],
      recommendations: []
    };
  }

  // Calculate CQI Average
  let totalCQI = 0;
  let itemsWithCQI = 0;
  let lowestCQIProduct = null as { name: string, score: number } | null;

  stack.forEach(item => {
    if (item.product) {
      const { score } = calculateElexirScore(item.product);
      totalCQI += score;
      itemsWithCQI++;
      
      if (!lowestCQIProduct || score < lowestCQIProduct.score) {
        lowestCQIProduct = { name: item.product.name || "Unknown", score };
      }
    }
  });

  const avgCQI = itemsWithCQI > 0 ? Math.round(totalCQI / itemsWithCQI) : 0;

  // Protocol Score Calculation (40% Adherence, 30% Alignment, 30% CQI)
  const adherenceScore = adherence?.weeklyCompletionPercent || 0;
  const alignmentScore = alignment?.overallAlignmentPercent || 0;
  
  const protocolScore = Math.round((adherenceScore * 0.4) + (alignmentScore * 0.3) + (avgCQI * 0.3));

  const priorities: CoachInsight[] = [];
  const wins: CoachInsight[] = [];
  const risks: CoachInsight[] = [];
  const recommendations: CoachInsight[] = [];

  // Wins
  if (adherence && adherence.currentStreak >= 3) {
    wins.push({
      id: "win_streak",
      type: "win",
      title: "Momentum Building",
      message: `You're on a ${adherence.currentStreak}-day streak. Outstanding consistency.`,
      icon: "flame-outline",
      colorName: "success"
    });
  }

  if (alignment && alignment.overallAlignmentPercent === 100) {
    wins.push({
      id: "win_alignment",
      type: "win",
      title: "Perfect Alignment",
      message: "Your current stack supports every single one of your stated health goals.",
      icon: "shield-checkmark-outline",
      colorName: "success"
    });
  }

  if (avgCQI >= 85) {
    wins.push({
      id: "win_cqi",
      type: "win",
      title: "Premium Quality Stack",
      message: "The clinical quality of your active supplements is exceptionally high.",
      icon: "star-outline",
      colorName: "success"
    });
  }

  // Risks
  if (adherenceScore < 50) {
    risks.push({
      id: "risk_adherence",
      type: "risk",
      title: "Inconsistent Routine",
      message: "Your weekly adherence is below 50%. Consistency is key for clinical efficacy.",
      icon: "alert-circle-outline",
      colorName: "warning"
    });
  }

  if (alignment && alignment.underrepresentedGoals.length > 0) {
    risks.push({
      id: "risk_gaps",
      type: "risk",
      title: "Missing Coverage",
      message: `You have ${alignment.underrepresentedGoals.length} goal(s) without supporting supplements.`,
      icon: "search-outline",
      colorName: "warning"
    });
  }

  if (lowestCQIProduct && lowestCQIProduct.score < 50) {
    risks.push({
      id: "risk_cqi",
      type: "risk",
      title: "Low Quality Item",
      message: `${lowestCQIProduct.name} has a low clinical quality score.`,
      icon: "warning-outline",
      colorName: "error"
    });
  }

  // Priorities (Select top priority based on severity)
  if (adherenceScore < 40) {
    priorities.push({
      id: "priority_adherence",
      type: "priority",
      title: "Improve Consistency",
      message: "Set a daily reminder to take your supplements. You are missing more than half of your Daily Plan.",
      icon: "time-outline",
      colorName: "warning"
    });
  } else if (alignment && alignment.underrepresentedGoals.length > 0) {
    priorities.push({
      id: "priority_gaps",
      type: "priority",
      title: "Fill Goal Gaps",
      message: "Add a product to your Plan to support your underrepresented health goals.",
      icon: "add-circle-outline",
      colorName: "text"
    });
  } else {
    priorities.push({
      id: "priority_maintain",
      type: "priority",
      title: "Maintain Routine",
      message: "You are doing great. Keep tracking your daily check-ins to monitor progress.",
      icon: "checkmark-circle-outline",
      colorName: "success"
    });
  }

  // Recommendations (Deterministic logic based on active stack)
  const hasVitaminD = stack.some(item => item.product?.name?.toLowerCase().includes("vitamin d") || item.product?.name?.toLowerCase().includes("d3"));
  const hasOmega3 = stack.some(item => item.product?.name?.toLowerCase().includes("omega") || item.product?.name?.toLowerCase().includes("fish oil"));
  const hasMagnesium = stack.some(item => item.product?.name?.toLowerCase().includes("magnesium"));
  
  const magnesiumItem = stack.find(item => item.product?.name?.toLowerCase().includes("magnesium"));

  if (hasVitaminD || hasOmega3) {
    recommendations.push({
      id: "rec_fat",
      type: "recommendation",
      title: "Enhance Absorption",
      message: "Take fat-soluble supplements (like Vitamin D and Omega-3s) with a fat-containing meal for better absorption.",
      icon: "restaurant-outline",
      colorName: "textSecondary"
    });
  }

  if (magnesiumItem && (magnesiumItem.timing === "morning" || magnesiumItem.timing === "afternoon")) {
    recommendations.push({
      id: "rec_magnesium",
      type: "recommendation",
      title: "Optimize Timing",
      message: "Consider moving your Magnesium to the evening to support relaxation and sleep.",
      icon: "moon-outline",
      colorName: "textSecondary"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: "rec_general",
      type: "recommendation",
      title: "Log Daily Checks",
      message: "Keep using the daily tracker to provide the engine with more data for optimization.",
      icon: "pulse-outline",
      colorName: "textSecondary"
    });
  }

  return {
    hasProtocol,
    protocolScore,
    priorities,
    wins,
    risks,
    recommendations
  };
}
