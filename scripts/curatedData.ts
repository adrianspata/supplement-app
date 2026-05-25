export interface CuratedIngredient {
  name: string;
  amount?: number;
  unit?: string;
  form?: string;
}

export interface CuratedProduct {
  brand: string;
  name: string;
  category: string;
  image_url?: string;
  ingredients: CuratedIngredient[];
  goals: string[];
  quality_attributes: string[];
  description?: string;
  suggested_use?: string;
  source_url?: string; // Internal reference only
}

export const CURATED_PRODUCTS: CuratedProduct[] = [
  {
    brand: "Thorne",
    name: "Magnesium Bisglycinate",
    category: "Minerals",
    image_url: "https://d3fa68hw0m2vcc.cloudfront.net/c51/237243302.jpeg", // Using a dummy or generic URL if specific isn't available, but we can leave empty or use a placeholder.
    ingredients: [
      { name: "Magnesium", amount: 200, unit: "mg", form: "Bisglycinate" }
    ],
    goals: ["sleep", "stress", "athletic"],
    quality_attributes: ["third_party_tested", "gluten_free", "dairy_free", "soy_free"],
    description: "A highly absorbable form of magnesium formulated to support muscle relaxation and optimal sleep quality.",
    suggested_use: "Take 1 scoop mixed in 8 oz of water daily, or as recommended by a healthcare professional.",
    source_url: "https://www.thorne.com/products/dp/magnesium-bisglycinate"
  },
  {
    brand: "Puori",
    name: "M3 Magnesium",
    category: "Minerals",
    image_url: "https://images.openfoodfacts.org/images/products/571/100/300/1888/front_en.3.400.jpg",
    ingredients: [
      { name: "Magnesium", amount: 225, unit: "mg", form: "Taurinate and Gluconate" },
      { name: "Zinc", amount: 15, unit: "mg", form: "Picolinate" },
      { name: "Vitamin B6", amount: 8, unit: "mg" }
    ],
    goals: ["sleep", "stress", "energy"],
    quality_attributes: ["third_party_tested", "vegan", "non_gmo"],
    description: "An organic magnesium complex with zinc and vitamin B6 to support energy metabolism and reduce fatigue.",
    suggested_use: "Take 3 capsules daily, preferably 30 minutes before bedtime.",
    source_url: "https://puori.com/products/m3"
  },
  {
    brand: "Nordic Naturals",
    name: "Ultimate Omega",
    category: "Fatty Acids",
    image_url: "https://images.openfoodfacts.org/images/products/768/990/017/0440/front_en.11.400.jpg",
    ingredients: [
      { name: "Total Omega-3s", amount: 1280, unit: "mg", form: "Triglyceride" },
      { name: "EPA", amount: 650, unit: "mg" },
      { name: "DHA", amount: 450, unit: "mg" }
    ],
    goals: ["longevity", "focus", "general_wellness"],
    quality_attributes: ["third_party_tested", "non_gmo", "dairy_free"],
    description: "High-intensity omega-3s from wild-caught fish to support heart, brain, and immune health.",
    suggested_use: "Take 2 softgels daily, with food.",
    source_url: "https://www.nordic.com/products/ultimate-omega/"
  },
  {
    brand: "Viva Naturals",
    name: "Triple Strength Omega-3",
    category: "Fatty Acids",
    ingredients: [
      { name: "Total Omega-3s", amount: 2200, unit: "mg", form: "Triglyceride" },
      { name: "EPA", amount: 1400, unit: "mg" },
      { name: "DHA", amount: 480, unit: "mg" }
    ],
    goals: ["longevity", "focus", "athletic"],
    quality_attributes: ["third_party_tested", "non_gmo", "dairy_free", "gluten_free"],
    description: "Purified deep-sea fish oil providing concentrated EPA and DHA in the triglyceride form for enhanced absorption.",
    suggested_use: "Take 2 softgels daily with a meal.",
    source_url: "https://vivanaturals.com/products/triple-strength-omega-3"
  },
  {
    brand: "Sports Research",
    name: "Vitamin D3 + K2",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3", amount: 5000, unit: "IU", form: "Cholecalciferol from Lichen" },
      { name: "Vitamin K2", amount: 100, unit: "mcg", form: "Menaquinone-7" }
    ],
    goals: ["immune", "longevity", "general_wellness"],
    quality_attributes: ["third_party_tested", "vegan", "non_gmo", "gluten_free"],
    description: "Plant-based D3 combined with K2 as MK-7 to support strong bones and immune function.",
    suggested_use: "Take 1 softgel daily with a fat-containing meal.",
    source_url: "https://sportsresearch.com/products/vitamin-d3-k2"
  },
  {
    brand: "NOW Foods",
    name: "Vitamin D-3 5000 IU",
    category: "Vitamins",
    ingredients: [
      { name: "Vitamin D3", amount: 5000, unit: "IU", form: "Cholecalciferol" }
    ],
    goals: ["immune", "general_wellness"],
    quality_attributes: ["non_gmo", "gluten_free", "dairy_free"],
    description: "High potency Vitamin D-3 to help maintain strong bones and support the immune system.",
    suggested_use: "Take 1 softgel every 2 days with a fat-containing meal.",
    source_url: "https://www.nowfoods.com/products/supplements/vitamin-d-3-5000-iu-softgels"
  },
  {
    brand: "Seed",
    name: "DS-01 Daily Synbiotic",
    category: "Probiotics",
    ingredients: [
      { name: "Probiotic Blend", amount: 53.6, unit: "B AFU" },
      { name: "Prebiotic Blend", amount: 400, unit: "mg", form: "Punicalagins" }
    ],
    goals: ["general_wellness", "immune"],
    quality_attributes: ["third_party_tested", "vegan", "gluten_free", "dairy_free"],
    description: "A 2-in-1 capsule containing 24 broad-spectrum probiotic strains and non-fermenting prebiotics.",
    suggested_use: "Take 2 capsules daily, preferably on an empty stomach.",
    source_url: "https://seed.com/daily-synbiotic"
  },
  {
    brand: "Garden of Life",
    name: "Dr. Formulated Once Daily",
    category: "Probiotics",
    ingredients: [
      { name: "Probiotic Blend", amount: 30, unit: "B CFU", form: "14 strains" }
    ],
    goals: ["general_wellness", "immune"],
    quality_attributes: ["vegan", "non_gmo", "gluten_free", "dairy_free"],
    description: "A daily probiotic supplement formulated by Dr. Perlmutter to support microbiome balance.",
    suggested_use: "Take 1 capsule daily. May be taken with or without food.",
    source_url: "https://www.gardenoflife.com/dr-formulated-probiotics-once-daily-mens-vegan-capsules"
  },
  {
    brand: "KSM-66",
    name: "Organic Ashwagandha",
    category: "Herbs & Botanicals",
    ingredients: [
      { name: "Ashwagandha Extract", amount: 600, unit: "mg", form: "Root Extract (5% Withanolides)" }
    ],
    goals: ["stress", "hormonal", "energy"],
    quality_attributes: ["organic", "vegan", "third_party_tested", "non_gmo"],
    description: "Highly concentrated full-spectrum ashwagandha root extract clinically proven to reduce stress and anxiety.",
    suggested_use: "Take 1 capsule twice daily with water.",
    source_url: "https://ksm66ashwagandhaa.com/"
  },
  {
    brand: "Himalaya",
    name: "Organic Ashwagandha",
    category: "Herbs & Botanicals",
    ingredients: [
      { name: "Ashwagandha Root Extract", amount: 380, unit: "mg" },
      { name: "Ashwagandha Root Powder", amount: 280, unit: "mg" }
    ],
    goals: ["stress", "energy"],
    quality_attributes: ["organic", "vegan", "non_gmo", "gluten_free"],
    description: "Pure organic ashwagandha for daily stress relief and energy support.",
    suggested_use: "Take 1 caplet daily before food.",
    source_url: "https://himalayausa.com/products/organic-ashwagandha"
  }
];
