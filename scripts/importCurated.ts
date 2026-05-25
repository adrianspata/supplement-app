import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { CURATED_PRODUCTS } from "./curatedData";

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

async function runImport() {
  console.log("Starting Curated Product Import...");

  for (const item of CURATED_PRODUCTS) {
    console.log(`\nProcessing: ${item.name} by ${item.brand}`);

    // 1. Get or Create Brand
    let brandId = null;
    const { data: brandData, error: brandError } = await supabase
      .from("brands")
      .select("id")
      .ilike("name", item.brand)
      .limit(1)
      .maybeSingle();

    if (brandError) throw brandError;

    if (brandData) {
      brandId = brandData.id;
    } else {
      const { data: newBrand, error: newBrandError } = await supabase
        .from("brands")
        .insert({ name: item.brand })
        .select("id")
        .single();
      if (newBrandError) throw newBrandError;
      brandId = newBrand.id;
    }

    // 2. Get or Create Product
    let productId = null;
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("name", item.name)
      .eq("brand_id", brandId)
      .limit(1)
      .maybeSingle();

    if (productError) throw productError;

    const rawData = {
      description: item.description,
      suggested_use: item.suggested_use,
      source_url: item.source_url,
    };

    if (productData) {
      productId = productData.id;
      // Update existing
      await supabase
        .from("products")
        .update({
          category: item.category,
          image_url: item.image_url || null,
          source: "elexir_curated",
          raw_data: rawData,
        })
        .eq("id", productId);
    } else {
      // Insert new
      const { data: newProduct, error: newProductError } = await supabase
        .from("products")
        .insert({
          name: item.name,
          brand_id: brandId,
          brand: item.brand, // Fallback legacy column
          category: item.category,
          image_url: item.image_url || null,
          source: "elexir_curated",
          raw_data: rawData,
        })
        .select("id")
        .single();

      if (newProductError) throw newProductError;
      productId = newProduct.id;
    }

    // 3. Clear existing relations to avoid duplicates on re-run
    await supabase.from("product_ingredients").delete().eq("product_id", productId);
    await supabase.from("product_goals").delete().eq("product_id", productId);
    await supabase.from("product_quality_attributes").delete().eq("product_id", productId);

    // 4. Upsert Ingredients & Link
    for (const ing of item.ingredients) {
      let ingredientId = null;
      const { data: ingData } = await supabase
        .from("ingredients")
        .select("id")
        .ilike("name", ing.name)
        .limit(1)
        .maybeSingle();

      if (ingData) {
        ingredientId = ingData.id;
      } else {
        const { data: newIng, error: newIngError } = await supabase
          .from("ingredients")
          .insert({ name: ing.name })
          .select("id")
          .single();
        if (newIngError) throw newIngError;
        ingredientId = newIng.id;
      }

      await supabase.from("product_ingredients").insert({
        product_id: productId,
        ingredient_id: ingredientId,
        amount: ing.amount || null,
        unit: ing.unit || null,
        form: ing.form || null,
      });
    }

    // 5. Insert Goals
    if (item.goals && item.goals.length > 0) {
      const goalsToInsert = item.goals.map((goal) => ({
        product_id: productId,
        goal: goal.toLowerCase(),
      }));
      await supabase.from("product_goals").insert(goalsToInsert);
    }

    // 6. Insert Quality Attributes
    if (item.quality_attributes && item.quality_attributes.length > 0) {
      const attrsToInsert = item.quality_attributes.map((attr) => ({
        product_id: productId,
        attribute: attr.toLowerCase(),
      }));
      await supabase.from("product_quality_attributes").insert(attrsToInsert);
    }

    console.log(`✓ Completed: ${item.name}`);
  }

  console.log("\n✨ Curated import finished successfully!");
}

runImport().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
