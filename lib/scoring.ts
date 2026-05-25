import { Product } from "./types";

export type ElexirScoreResult = {
  score: number;
  pros: string[];
  thingsToKnow: string[];
  breakdown: {
    transparency: number;
    ingredients: number;
    quality: number;
    goalRelevance: number;
  };
};

export function calculateElexirScore(product: Product): ElexirScoreResult {
  let score = 0;
  const pros: string[] = [];
  const thingsToKnow: string[] = [];

  let transparency = 0;
  let ingredientsScore = 0;
  let quality = 0;
  let goalRelevance = 0;

  // 1. Transparency (25 points)
  const hasBrand = !!(product.brands?.name || product.brand);
  if (hasBrand) transparency += 6;

  const hasCategory = !!product.category;
  if (hasCategory) transparency += 6;

  const hasImage = !!product.image_url;
  if (hasImage) transparency += 7;

  const hasBasicInfo = !!product.name;
  if (hasBasicInfo) transparency += 6;

  if (!hasBrand || !hasCategory || !hasImage || !hasBasicInfo) {
    thingsToKnow.push("Incomplete product metadata.");
  }

  // 2. Goal Relevance (25 points)
  const explicitGoals = product.product_goals?.length ? product.product_goals.map(g => g.goal) : [];
  const inferredGoals = product.inferred_goals || [];
  const allGoals = [...explicitGoals, ...inferredGoals];
  
  if (allGoals.length > 0) {
    goalRelevance += 25;
    pros.push("Targeted formulation (goals specified).");
  } else {
    thingsToKnow.push("No specific wellness goals identified.");
  }

  // 3. Ingredient Transparency (30 points)
  const ingredients = product.product_ingredients || [];
  
  if (ingredients.length > 0) {
    ingredientsScore += 10;
    
    const hasAnyAmount = ingredients.some(i => i.amount != null);
    const hasAnyForm = ingredients.some(i => !!i.form);

    if (hasAnyAmount) {
      ingredientsScore += 10;
      pros.push("Transparent ingredient dosages.");
    } else {
      thingsToKnow.push("Proprietary blend or missing exact dosages.");
    }

    if (hasAnyForm) {
      ingredientsScore += 10;
      pros.push("Specific ingredient forms identified.");
    } else {
      thingsToKnow.push("Chemical form of ingredients not specified.");
    }
  } else {
    thingsToKnow.push("No detailed ingredient list available.");
  }

  // 4. Quality Transparency (20 points)
  const attributes = product.product_quality_attributes?.map(a => a.attribute.toLowerCase()) || [];
  
  const isThirdPartyTested = attributes.includes("third_party_tested");
  if (isThirdPartyTested) {
    quality += 10;
    pros.push("Third-party tested for quality.");
  } else {
    thingsToKnow.push("No third-party testing information provided.");
  }

  const hasOtherAttributes = attributes.some(a => a !== "third_party_tested");
  if (hasOtherAttributes) {
    quality += 10;
    pros.push("Contains verified quality attributes.");
  }

  score = transparency + ingredientsScore + quality + goalRelevance;
  score = Math.min(Math.max(score, 0), 100);

  return { 
    score, 
    pros, 
    thingsToKnow,
    breakdown: {
      transparency,
      ingredients: ingredientsScore,
      quality,
      goalRelevance
    }
  };
}
