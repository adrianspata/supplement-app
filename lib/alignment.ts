import { UserStackItem, RecommendedProduct, Product } from "./types";
import { normalizeGoal } from "./matching";
import { getRecommendedProducts } from "./products";

export interface GoalCoverage {
  goal: string;
  supportingItems: UserStackItem[];
  status: 'Underrepresented' | 'Supported' | 'Strongly Supported';
}

export interface AlignmentResult {
  overallAlignmentPercent: number;
  coverageMap: GoalCoverage[];
  coveredGoals: string[];
  underrepresentedGoals: string[];
}

/**
 * Returns a unique array of goals associated with a given product.
 * Combines explicit product_goals and inferred_goals.
 */
function getProductGoals(product?: Product | null): string[] {
  if (!product) return [];
  const goals = new Set<string>();
  
  if (product.product_goals) {
    product.product_goals.forEach(pg => goals.add(normalizeGoal(pg.goal)));
  }
  if (product.inferred_goals) {
    product.inferred_goals.forEach(g => goals.add(normalizeGoal(g)));
  }
  
  return Array.from(goals);
}

/**
 * Calculates the user's goal coverage and alignment based on their active stack.
 */
export function getGoalAlignment(userGoals: string[], stack: UserStackItem[]): AlignmentResult {
  const normalizedUserGoals = Array.from(new Set(userGoals.map(normalizeGoal)));
  
  if (normalizedUserGoals.length === 0) {
    return {
      overallAlignmentPercent: 0,
      coverageMap: [],
      coveredGoals: [],
      underrepresentedGoals: []
    };
  }

  const coverageMap: GoalCoverage[] = normalizedUserGoals.map(goal => {
    const supportingItems = stack.filter(item => {
      const pGoals = getProductGoals(item.product);
      return pGoals.includes(goal);
    });

    let status: GoalCoverage['status'] = 'Underrepresented';
    if (supportingItems.length === 1) status = 'Supported';
    else if (supportingItems.length >= 2) status = 'Strongly Supported';

    return {
      goal,
      supportingItems,
      status
    };
  });

  const coveredGoals = coverageMap.filter(c => c.supportingItems.length > 0).map(c => c.goal);
  const underrepresentedGoals = coverageMap.filter(c => c.supportingItems.length === 0).map(c => c.goal);

  const overallAlignmentPercent = Math.round((coveredGoals.length / normalizedUserGoals.length) * 100);

  return {
    overallAlignmentPercent,
    coverageMap,
    coveredGoals,
    underrepresentedGoals
  };
}

/**
 * Gets product recommendations specifically targeting the user's missing goals.
 * It reuses the existing getRecommendedProducts logic but passes the underrepresented goals.
 */
export async function getGapSuggestions(userId: string, missingGoals: string[]): Promise<RecommendedProduct[]> {
  if (missingGoals.length === 0) return [];
  
  // We use the existing recommendation engine, passing ONLY the missing goals 
  // as the primary goals to force recommendations to fill the gap.
  const suggestions = await getRecommendedProducts(userId, missingGoals, [], [], undefined);
  
  // Return the top 2 suggestions to avoid cluttering the UI
  return suggestions.slice(0, 2);
}
