import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

type SeedProduct = {
  brand: string;
  product: string;
  category: string;
  image_url?: string;
  goals: string[];
  attributes: string[];
  ingredients: {
    name: string;
    amount?: number;
    unit?: string;
    form?: string;
  }[];
};

const SEED_DATA: SeedProduct[] = [
  {
    brand: "Thorne",
    product: "Magnesium Bisglycinate",
    category: "Minerals",
    goals: ["sleep", "stress", "recovery"],
    attributes: ["third_party_tested", "gluten_free", "dairy_free"],
    ingredients: [
      { name: "Magnesium Bisglycinate", amount: 200, unit: "mg", form: "bisglycinate" },
    ],
  },
  {
    brand: "Puori",
    product: "M3 Magnesium",
    category: "Minerals",
    goals: ["sleep", "recovery", "stress"],
    attributes: ["third_party_tested", "vegan", "gluten_free"],
    ingredients: [
      { name: "Magnesium", amount: 225, unit: "mg" },
      { name: "Zinc", amount: 15, unit: "mg" },
      { name: "Vitamin B6", amount: 8, unit: "mg" },
    ],
  },
  {
    brand: "Healthwell",
    product: "Magnesium Bisglycinat",
    category: "Minerals",
    goals: ["sleep", "stress", "recovery"],
    attributes: ["vegan"],
    ingredients: [
      { name: "Magnesium Bisglycinate", amount: 200, unit: "mg", form: "bisglycinate" },
    ],
  },
  {
    brand: "Great Earth",
    product: "Magnesium 375",
    category: "Minerals",
    goals: ["sleep", "recovery"],
    attributes: ["vegan"],
    ingredients: [
      { name: "Magnesium", amount: 375, unit: "mg" },
    ],
  },
  {
    brand: "Nordic Naturals",
    product: "Ultimate Omega",
    category: "Omega 3",
    goals: ["heart_health", "brain_health", "immunity"],
    attributes: ["third_party_tested", "non_gmo"],
    ingredients: [
      { name: "EPA", amount: 650, unit: "mg" },
      { name: "DHA", amount: 450, unit: "mg" },
      { name: "Omega-3", amount: 1280, unit: "mg" },
    ],
  },
  {
    brand: "Puori",
    product: "O3 Omega-3",
    category: "Omega 3",
    goals: ["heart_health", "brain_health", "recovery"],
    attributes: ["third_party_tested", "non_gmo"],
    ingredients: [
      { name: "EPA", amount: 1250, unit: "mg" },
      { name: "DHA", amount: 500, unit: "mg" },
    ],
  },
  {
    brand: "Thorne",
    product: "Vitamin D/K2",
    category: "Vitamins",
    goals: ["immunity", "bone_health", "heart_health"],
    attributes: ["third_party_tested", "gluten_free", "dairy_free"],
    ingredients: [
      { name: "Vitamin D3", amount: 25, unit: "mcg" },
      { name: "Vitamin K2", amount: 200, unit: "mcg" },
    ],
  },
  {
    brand: "Holistic",
    product: "D3-vitamin",
    category: "Vitamins",
    goals: ["immunity", "bone_health"],
    attributes: ["vegan"],
    ingredients: [
      { name: "Vitamin D3", amount: 50, unit: "mcg" },
    ],
  },
  {
    brand: "Holistic",
    product: "Probiotika",
    category: "Gut Health",
    goals: ["gut_health", "immunity"],
    attributes: ["dairy_free", "gluten_free"],
    ingredients: [
      { name: "Probiotic Blend" },
      { name: "Lactobacillus Acidophilus" },
      { name: "Bifidobacterium Lactis" },
    ],
  },
  {
    brand: "Healthwell",
    product: "Ashwagandha Premium",
    category: "Adaptogens",
    goals: ["stress", "sleep", "focus"],
    attributes: ["vegan"],
    ingredients: [
      { name: "Ashwagandha Extract", amount: 500, unit: "mg" },
    ],
  },
  {
    brand: "Solgar",
    product: "Ashwagandha Root Extract",
    category: "Adaptogens",
    goals: ["stress", "focus", "recovery"],
    attributes: ["vegan", "gluten_free", "dairy_free"],
    ingredients: [
      { name: "Ashwagandha Root Extract", amount: 300, unit: "mg" },
    ],
  },
];

async function getOrCreateBrand(name: string) {
  const { data: existing, error: selectError } = await supabase
    .from("brands")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("brands")
    .insert({ name })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

async function getOrCreateIngredient(name: string) {
  const { data: existing, error: selectError } = await supabase
    .from("ingredients")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

async function upsertProduct(item: SeedProduct, brandId: string) {
  const { data: existing, error: selectError } = await supabase
    .from("products")
    .select("id")
    .eq("name", item.product)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { data, error } = await supabase
      .from("products")
      .update({
        category: item.category,
        source: "internal",
        image_url: item.image_url ?? null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: item.product,
      brand_id: brandId,
      brand: item.brand,
      category: item.category,
      source: "internal",
      image_url: item.image_url ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

async function seed() {
  console.log("Starting seed...");

  for (const item of SEED_DATA) {
    const brand = await getOrCreateBrand(item.brand);
    const product = await upsertProduct(item, brand.id);

    for (const ing of item.ingredients) {
      const ingredient = await getOrCreateIngredient(ing.name);

      const { error } = await supabase
        .from("product_ingredients")
        .upsert(
          {
            product_id: product.id,
            ingredient_id: ingredient.id,
            amount: ing.amount ?? null,
            unit: ing.unit ?? null,
            form: ing.form ?? null,
          },
          { onConflict: "product_id,ingredient_id,form" }
        );

      if (error) throw error;
    }

    for (const goal of item.goals) {
      const { error } = await supabase
        .from("product_goals")
        .upsert(
          {
            product_id: product.id,
            goal,
          },
          { onConflict: "product_id,goal" }
        );

      if (error) throw error;
    }

    for (const attribute of item.attributes) {
      const { error } = await supabase
        .from("product_quality_attributes")
        .upsert(
          {
            product_id: product.id,
            attribute,
            value: "true",
          },
          { onConflict: "product_id,attribute" }
        );

      if (error) throw error;
    }

    console.log(`Seeded: ${item.brand} - ${item.product}`);
  }

  console.log("Seed complete.");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});