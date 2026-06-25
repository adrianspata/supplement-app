import { supabase } from "./supabase";
import { getUserStack } from "./stack";
import { calculateMatch } from "./matching";
import { calculateElexirScore } from "./scoring";

export type AssistantContextType = 'general' | 'stack' | 'product';

export interface AssistantContext {
  userId: string;
  type: AssistantContextType;
  productId?: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Basis AI Assistant Engine
 * Explains product quality scores, recommendations, and stack coverage.
 * Designed to be swappable with a real LLM in the future.
 */
export async function generateAssistantResponse(query: string, context: AssistantContext): Promise<string> {
  const q = query.toLowerCase().trim();

  // 1. Fetch User Data Context
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", context.userId).single();
  const stack = await getUserStack(context.userId);
  
  const trackedGoals = new Set([
    ...(profile?.primary_goals || []),
    ...(profile?.health_concerns || [])
  ]);

  let productDetails: any = null;
  let matchDetails: any = null;
  let scoreDetails: any = null;

  if (context.productId) {
    const { data } = await supabase
      .from("products")
      .select('*, product_goals(goal), product_ingredients(ingredient:ingredients(name)), product_quality_attributes(attribute)')
      .eq("id", context.productId)
      .single();
    productDetails = data;
    
    if (productDetails) {
      matchDetails = calculateMatch(
        profile?.primary_goals || [],
        profile?.health_concerns || [],
        productDetails.product_goals?.map((g: any) => g.goal) || productDetails.inferred_goals || []
      );
      scoreDetails = calculateElexirScore(productDetails);
    }
  }

  // Calculate stack coverage helper
  const stackGoals = new Set<string>();
  stack.forEach(item => {
    item.product?.product_goals?.forEach(g => stackGoals.add(g.goal));
    item.product?.inferred_goals?.forEach(g => stackGoals.add(g));
  });

  const lowCoverageGoals = Array.from(trackedGoals).filter(g => !stackGoals.has(g));
  const coveredGoals = Array.from(trackedGoals).filter(g => stackGoals.has(g));

  // 2. Query Routing and Wording Logic

  // A. Medical Safety Fallback
  if (q.includes("medical") || q.includes("diagnose") || q.includes("treat") || q.includes("cure") || q.includes("sick") || q.includes("disease") || q.includes("doctor")) {
    return "I am an educational assistant designed to explain product details and goal alignments. I cannot provide medical advice, diagnosis, or treatment recommendations. Always consult a healthcare professional regarding medical conditions.";
  }

  // B. Greetings
  if (q.includes("hi") || q.includes("hello")) {
    return "Hi! I'm your Basis Assistant. I can help explain your recommendations, review your stack, and make your Daily Plan easier to understand. How can I help you today?";
  }

  // C. Score Queries (Plan Score vs Product Score)
  if (q.includes("score")) {
    // General Plan Score check
    if (context.type !== 'product' || q.includes("plan") || q.includes("my score") || q.includes("overall")) {
      return "If you mean your Plan Score, it reflects how complete and aligned your current stack and Daily Plan are. You can improve it by adding timing, completing check-ins, and keeping your stack aligned with your goals.";
    }
    
    // Product-specific quality score check
    if (context.type === 'product' && productDetails) {
      if (scoreDetails) {
        const bd = scoreDetails.breakdown;
        return `The quality score for ${productDetails.name || 'this product'} is ${scoreDetails.score}/100. Here is the breakdown:\n\n• Transparency: ${bd.transparency}/20\n• Ingredient Quality: ${bd.ingredientQuality}/20\n• Dosage Quality: ${bd.dosageQuality}/20\n• Evidence: ${bd.evidence}/20\n• Cleanliness: ${bd.cleanliness}/20\n\nThis score reflects available product information, transparency, and clinical standards. It does not measure medical effectiveness.`;
      }
      return "The product score for this product is not available.";
    }
  }

  // D. Recommendation Queries
  if (q.includes("recommend") || q.includes("why was this recommended") || q.includes("why is this recommended")) {
    if (context.type === 'product' && productDetails) {
      const pGoals = productDetails.product_goals?.map((g: any) => g.goal) || [];
      const overlaps = pGoals.filter((g: string) => trackedGoals.has(g));
      const fillsLowCoverage = overlaps.filter((g: string) => lowCoverageGoals.includes(g));
      
      if (fillsLowCoverage.length > 0) {
        return `This product supports ${fillsLowCoverage[0]}, which is one of your tracked goals. Currently, your daily stack has less support for ${fillsLowCoverage[0]}, so you might consider adding this to broaden your stack coverage.`;
      } else if (overlaps.length > 0) {
        return `This product supports ${overlaps.join(" and ")}, which aligns with your tracked health goals and may support your overall routine.`;
      } else if (productDetails.source === 'elexir_curated') {
        return "While this product does not directly match your primary goals, it is a curated product in our library selected for its transparent sourcing and clear ingredient profile.";
      }
      return "This product doesn't appear to strongly overlap with your explicitly tracked goals or diet preferences, but it is available in our catalog for tracking.";
    }
    return "Recommendations are based on your goals, saved products, current stack and logged signals where available.";
  }

  // E. Stack / Coverage Queries
  if (context.type === 'stack' || q.includes("stack") || q.includes("coverage") || q.includes("review")) {
    if (q.includes("low coverage") || q.includes("missing") || q.includes("gap")) {
      if (lowCoverageGoals.length > 0) {
        return `Based on your current stack, there is less coverage for: ${lowCoverageGoals.join(", ")}. This means none of your scheduled items directly support these goals. You might consider reviewing recommended products in the Cabinet to support these goals.`;
      }
      return `Your stack looks incredibly well-rounded! All of your tracked goals (${Array.from(trackedGoals).join(", ")}) are currently supported by at least one product in your routine.`;
    }

    if (q.includes("support") || q.includes("what does my stack do") || q.includes("review my stack") || q.includes("review stack")) {
      let msg = "I can help review what is currently in your stack and highlight missing timing, possible gaps or products that need review.";
      if (coveredGoals.length > 0) {
        msg += ` Based on your active stack, you are supporting: ${coveredGoals.join(", ")}.`;
      } else {
        msg += " Currently, your stack does not seem to heavily overlap with your goals yet. You can update your goals in your Profile or add products to your Daily Plan.";
      }
      return msg;
    }
  }

  // F. Ingredient Queries
  if (q.includes("ingredient") || q.includes("what is in this") || q.includes("explain this ingredient")) {
    if (context.type === 'product' && productDetails) {
      const ingredients = productDetails.product_ingredients?.map((i: any) => i.ingredient?.name).filter(Boolean);
      if (ingredients && ingredients.length > 0) {
        return `Based on available label data, the primary active ingredients in this product include ${ingredients.slice(0, 3).join(", ")}. These ingredients may support your health goals if they align with your tracked focuses.`;
      }
      return "I don't have detailed active ingredient metadata for this product yet. We rely on clear labeling and verified product specifications to compile ingredients.";
    }
    return "I can help explain supplement ingredients, check active dosages, and verify quality. Ask about ingredients from any specific product screen.";
  }

  // G. Daily Plan Queries
  if (q.includes("plan") || q.includes("daily plan") || q.includes("routine")) {
    return "Your Daily Plan helps you stay consistent with your routine. It tracks your supplement timing, check-ins, and adherence. Consider adding timing to your active stack items and completing daily check-ins to optimize your Plan Score.";
  }

  // Fallback Response
  return "I’m not sure how to answer that yet, but I can help with recommendations, product scores, ingredients, your stack, or your Daily Plan.";
}
