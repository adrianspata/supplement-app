import { supabase } from "./supabase";
import { getUserStack } from "./stack";
import { getProductMatch } from "./matching";
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
 * Deterministic Mock AI Engine v1
 * Explains Elexir's internal logic without medical advice.
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
  let elexirScoreDetails: any = null;

  if (context.productId) {
    const { data } = await supabase
      .from("products")
      .select('*, product_goals(goal), product_ingredients(ingredient:ingredients(name)), product_quality_attributes(attribute)')
      .eq("id", context.productId)
      .single();
    productDetails = data;
    
    if (productDetails) {
      matchDetails = getProductMatch(
        profile?.primary_goals || [],
        profile?.health_concerns || [],
        productDetails.product_goals?.map((g: any) => g.goal) || productDetails.inferred_goals || []
      );
      elexirScoreDetails = calculateElexirScore(productDetails);
    }
  }

  // Calculate stack coverage helper
  const stackGoals = new Set<string>();
  stack.forEach(item => {
    item.product?.product_goals?.forEach(g => stackGoals.add(g.goal));
    item.product?.inferred_goals?.forEach(g => stackGoals.add(g));
  });

  const lowCoverageGoals = Array.from(trackedGoals).filter(g => !stackGoals.has(g));

  // 2. Deterministic Matching Logic

  // A. Product Context Queries
  if (context.type === 'product' && productDetails) {
    if (q.includes("why was this recommended") || q.includes("why is this recommended")) {
      const pGoals = productDetails.product_goals?.map((g:any) => g.goal) || [];
      const overlaps = pGoals.filter((g: string) => trackedGoals.has(g));
      const fillsLowCoverage = overlaps.filter((g: string) => lowCoverageGoals.includes(g));
      
      if (fillsLowCoverage.length > 0) {
        return `This product supports ${fillsLowCoverage[0]}, which is one of your tracked goals. Currently, your daily stack has less support for ${fillsLowCoverage[0]}, making this a highly recommended addition to broaden your coverage.`;
      } else if (overlaps.length > 0) {
        return `This product supports ${overlaps.join(" and ")}, aligning closely with your tracked health goals.`;
      } else if (productDetails.source === 'elexir_curated') {
        return `While this product does not directly match your primary goals, it is a high-quality, curated product in our library known for its transparent sourcing and clear ingredient profile.`;
      }
      return `This product was evaluated by Elexir's algorithms but doesn't appear to strongly overlap with your explicitly tracked goals or diet preferences.`;
    }

    if (q.includes("score")) {
      if (elexirScoreDetails) {
        const bd = elexirScoreDetails.breakdown;
        return `The Elexir Score for ${productDetails.name || 'this product'} is ${elexirScoreDetails.score}/100. Here is the breakdown:\n\n• Transparency: ${bd.transparency}/25\n• Ingredients: ${bd.ingredients}/30\n• Quality: ${bd.quality}/20\n• Goal Relevance: ${bd.goalRelevance}/25\n\nThis score reflects available product information, transparency, and goal relevance. It does not measure medical effectiveness.`;
      }
      return `The Elexir Score for this product is not available.`;
    }

    if (q.includes("ingredient") || q.includes("what is in this")) {
      const ingredients = productDetails.product_ingredients?.map((i:any) => i.ingredient?.name).filter(Boolean);
      if (ingredients && ingredients.length > 0) {
        return `Based on Elexir's data, the primary active ingredients in this product include ${ingredients.slice(0, 3).join(", ")}. These are naturally extracted from the product label for tracking purposes.`;
      }
      return `I don't have detailed active ingredient metadata for this product yet. We rely on clear labeling and third-party data to parse ingredients.`;
    }
  }

  // B. Stack Context Queries
  if (context.type === 'stack' || q.includes("stack") || q.includes("coverage")) {
    if (q.includes("low coverage") || q.includes("missing")) {
      if (lowCoverageGoals.length > 0) {
        return `Your current stack has less coverage for: ${lowCoverageGoals.join(", ")}. This means none of the supplements currently scheduled in your routine list these as primary supported goals. You can explore the Cabinet to find recommendations that fill these gaps.`;
      }
      return `Your stack looks incredibly well-rounded! All of your tracked goals (${Array.from(trackedGoals).join(", ")}) are currently supported by at least one product in your routine.`;
    }

    if (q.includes("support") || q.includes("what does my stack do")) {
      const covered = Array.from(trackedGoals).filter(g => stackGoals.has(g));
      if (covered.length > 0) {
        return `Based on the products you've added, your stack is actively supporting: ${covered.join(", ")}.`;
      }
      return `Your stack doesn't seem to heavily overlap with your explicitly tracked goals yet. You can update your goals in your Profile or add targeted products from the Cabinet.`;
    }
  }

  // C. Fallbacks
  if (q.includes("hi") || q.includes("hello")) {
    return "Hi! I'm Elexir's AI Assistant. I can explain why products are recommended, break down your Elexir Scores, and analyze your stack coverage. How can I help you today?";
  }

  if (q.includes("medical") || q.includes("diagnose") || q.includes("treat") || q.includes("cure") || q.includes("sick")) {
    return "I am an educational assistant designed to explain Elexir's internal logic and product metadata. I cannot provide medical advice, diagnosis, or treatment recommendations. Always consult a healthcare professional regarding medical conditions.";
  }

  return "I'm currently a V1 deterministic assistant and don't understand that specific question yet. Try asking me about 'recommendations', 'Elexir score', 'ingredients', or your 'stack coverage'.";
}
