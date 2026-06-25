import { Product } from "./types";

export type ElexirScoreResult = {
  score: number;
  pros: string[];
  thingsToKnow: string[];
  breakdown: {
    ingredientQuality: number;
    dosageQuality: number;
    transparency: number;
    evidence: number;
    cleanliness: number;
  };
};

export function calculateElexirScore(product: Product): ElexirScoreResult {
  let score = 0;
  const pros: string[] = [];
  const thingsToKnow: string[] = [];

  let ingredientQuality = 0;
  let dosageQuality = 0;
  let transparency = 0;
  let evidence = 0;
  let cleanliness = 0;

  // 1. Transparency (20 points)
  const hasBrand = !!(product.brands?.name || product.brand);
  if (hasBrand) transparency += 5;

  const hasCategory = !!product.category;
  if (hasCategory) transparency += 5;

  const hasImage = !!product.image_url;
  if (hasImage) transparency += 5;

  const hasBasicInfo = !!product.name;
  if (hasBasicInfo) transparency += 5;

  if (transparency >= 15) {
    pros.push("High level of product transparency.");
  } else {
    thingsToKnow.push("Incomplete product metadata or brand transparency.");
  }

  // 2. Ingredient Quality & Dosage Quality (40 points total)
  let ingredients = product.product_ingredients || [];
  
  // Fallback for curated/raw_data ingredients
  if (ingredients.length === 0 && (product.raw_data?.supplement_facts?.active_ingredients || product.supplement_facts?.active_ingredients)) {
    ingredients = (product.raw_data?.supplement_facts?.active_ingredients || product.supplement_facts?.active_ingredients) as any[];
  }

  if (ingredients.length > 0) {
    ingredientQuality += 10;
    dosageQuality += 10;
    
    const hasAnyAmount = ingredients.some(i => i.amount != null && String(i.amount) !== "");
    const hasAnyForm = ingredients.some(i => !!i.form);

    if (hasAnyAmount) {
      dosageQuality += 10;
      pros.push("Transparent clinical dosages.");
    } else {
      thingsToKnow.push("Proprietary blend or missing exact dosages.");
    }

    if (hasAnyForm) {
      ingredientQuality += 10;
      pros.push("Specific high-quality ingredient forms identified.");
    } else {
      thingsToKnow.push("Chemical form of ingredients not specified.");
    }
  } else {
    thingsToKnow.push("No detailed ingredient list available.");
  }

  // 3. Evidence (Goal Relevance + Clinical Fit) (20 points)
  const explicitGoals = product.product_goals?.length ? product.product_goals.map(g => g.goal) : [];
  const inferredGoals = product.inferred_goals || [];
  const allGoals = [...explicitGoals, ...inferredGoals];
  
  if (allGoals.length > 0) {
    evidence += 10;
    pros.push("Targeted formulation for specific clinical goals.");
  }

  const attributes = product.product_quality_attributes?.map(a => a.attribute.toLowerCase()) || [];
  const isThirdPartyTested = attributes.includes("third_party_tested");
  const isCurated = product.source === "curated" || product.source === "elexir_curated" || product.verified_status === "verified";

  if (isThirdPartyTested || isCurated) {
    evidence += 10;
    pros.push("Verified clinical profile or third-party tested.");
  } else if (allGoals.length === 0) {
    thingsToKnow.push("Lacks explicit verified clinical evidence.");
  }

  // 4. Cleanliness (20 points)
  cleanliness += 5; // Base points for having a product
  
  if (product.vegan || attributes.includes("vegan")) {
    cleanliness += 5;
  }
  if (product.gluten_free || attributes.includes("gluten_free") || attributes.includes("gluten-free")) {
    cleanliness += 5;
  }
  if (product.dairy_free || attributes.includes("dairy_free") || attributes.includes("dairy-free")) {
    cleanliness += 5;
  }
  
  if (cleanliness >= 15) {
    pros.push("Clean formulation free of major allergens.");
  }

  // Total Score
  score = transparency + ingredientQuality + dosageQuality + evidence + cleanliness;
  score = Math.min(Math.max(score, 0), 100);

  return { 
    score, 
    pros, 
    thingsToKnow,
    breakdown: {
      ingredientQuality,
      dosageQuality,
      transparency,
      evidence,
      cleanliness
    }
  };
}
