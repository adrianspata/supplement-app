import { Product } from "./types";

export type MatchTier = "Excellent Match" | "Good Match" | "Partial Match" | "No Match";

export type MatchResult = {
  score: number;
  label: MatchTier;
  matchedGoals: string[];
};

// Normalize goals to a standard snake_case list
export function normalizeGoal(goal: string): string {
  const g = goal.toLowerCase().trim();
  if (g.includes("sleep")) return "sleep";
  if (g.includes("stress") || g.includes("anxiety")) return "stress";
  if (g.includes("recover") || g.includes("athletic")) return "recovery";
  if (g.includes("energy") || g.includes("fatigue")) return "energy";
  if (g.includes("focus") || g.includes("brain") || g.includes("cognitive")) return "brain_health";
  if (g.includes("immune") || g.includes("immunity")) return "immunity";
  if (g.includes("gut") || g.includes("digestion")) return "gut_health";
  if (g.includes("skin")) return "skin";
  if (g.includes("hair")) return "hair";
  if (g.includes("joint") || g.includes("bone")) return "bone_health";
  if (g.includes("hormon")) return "hormones";
  if (g.includes("heart") || g.includes("cardio")) return "heart_health";
  
  // Default to standard snake_case if no mapping found
  return g.replace(/\s+/g, '_');
}

export function calculateMatch(userGoalsRaw: string[] | null | undefined, userConcernsRaw: string[] | null | undefined, productGoalsRaw: string[] | null | undefined): MatchResult {
  const combinedUserTargets = [...(userGoalsRaw || []), ...(userConcernsRaw || [])];
  if (combinedUserTargets.length === 0 || !productGoalsRaw || productGoalsRaw.length === 0) {
    return { score: 0, label: "No Match", matchedGoals: [] };
  }

  const normalizedUserGoals = new Set(combinedUserTargets.map(normalizeGoal));
  const normalizedProductGoals = productGoalsRaw.map(normalizeGoal);

  // Find intersections
  const matched = [...new Set(normalizedProductGoals.filter(g => normalizedUserGoals.has(g)))];
  const score = matched.length;

  let label: MatchTier = "No Match";
  if (score >= 3) {
    label = "Excellent Match";
  } else if (score === 2) {
    label = "Good Match";
  } else if (score === 1) {
    label = "Partial Match";
  }

  return {
    score,
    label,
    matchedGoals: matched
  };
}

export function generateWhyItMatches(matchedGoals: string[]): string {
  if (matchedGoals.length === 0) return "";
  const readable = matchedGoals.map(g => g.replace(/_/g, ' '));
  if (readable.length === 1) {
    return `This product specifically targets your goal for ${readable[0]}.`;
  }
  const last = readable.pop();
  return `This product directly aligns with your goals for ${readable.join(", ")} and ${last}.`;
}

export function inferProductGoals(product: Product): string[] {
  const textFields = [
    product.name,
    product.brand,
    product.category,
    product.raw_data?.ingredients_text,
    product.raw_data?.categories,
    product.raw_data?.categories_tags?.join(" "),
    product.raw_data?.generic_name,
    product.raw_data?.product_name_en,
    product.raw_data?.labels_tags?.join(" "),
  ];

  const textToSearch = textFields
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[-_]/g, " ");

  const inferred = new Set<string>();

  const has = (term: string) => textToSearch.includes(term.toLowerCase());
  const hasWord = (word: string) => new RegExp(`\\b${word}\\b`, 'i').test(textToSearch);

  // Magnesium variants
  if (has("magnesium bisglycinate") || has("magnesium glycinate")) {
    inferred.add("sleep");
    inferred.add("stress");
    inferred.add("recovery");
  } else if (has("magnesium citrate")) {
    inferred.add("sleep");
    inferred.add("recovery");
  } else if (has("magnesium")) {
    inferred.add("sleep");
    inferred.add("stress");
    inferred.add("recovery");
  }

  // Ashwagandha
  if (has("ashwagandha")) {
    inferred.add("stress");
    inferred.add("sleep");
  }

  // Omegas
  if (hasWord("omega 3") || hasWord("omega") || hasWord("epa") || hasWord("dha") || has("fish oil")) {
    inferred.add("heart_health");
    inferred.add("brain_health");
  }

  // Vitamin D
  if (hasWord("vitamin d") || hasWord("vitamin d3") || hasWord("d3")) {
    inferred.add("immunity");
    inferred.add("bone_health");
  }

  // Vitamin K
  if (hasWord("vitamin k") || hasWord("k2")) {
    inferred.add("bone_health");
    inferred.add("heart_health");
  }

  // Zinc
  if (hasWord("zinc") || hasWord("zink")) {
    inferred.add("immunity");
    inferred.add("skin");
  }

  // Probiotics
  if (has("probiotic") || has("probiotics") || has("lactobacillus") || has("bifidobacterium")) {
    inferred.add("gut_health");
    inferred.add("immunity");
  }

  // Collagen
  if (has("collagen") || has("kollagen")) {
    inferred.add("skin");
    inferred.add("hair");
    inferred.add("joints");
  }

  // Iron
  if (hasWord("iron") || hasWord("jarn")) {
    inferred.add("energy");
  }

  // B12
  if (hasWord("b12") || hasWord("vitamin b12")) {
    inferred.add("energy");
    inferred.add("focus");
  }

  // Caffeine
  if (has("caffeine") || has("coffee") || has("guarana")) {
    inferred.add("energy");
    inferred.add("focus");
  }

  return Array.from(new Set(Array.from(inferred).map(normalizeGoal)));
}
