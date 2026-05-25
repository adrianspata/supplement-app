import { supabase } from "./supabase";
import { searchOpenFoodFacts } from "./openFoodFacts";
import { Product, UserSavedProduct, RecentlyViewedProduct, RecommendedProduct } from "./types";
import { calculateMatch } from "./matching";
import { formatGoalLabel } from "./productDisplay";

export type ProductFilters = {
  goal?: string;
  ingredient?: string;
  brand?: string;
  attribute?: string;
};

/**
 * Searches local products table first. If not enough results, queries Open Food Facts.
 */
export async function searchProducts(query: string, filters?: ProductFilters): Promise<{ results: Product[], apiError: boolean }> {
  try {
    // 1. Search local DB with joins
    let localQuery = supabase
      .from("products")
      .select(`
        *,
        brands(*),
        product_ingredients(*, ingredients(*)),
        product_goals(*),
        product_quality_attributes(*)
      `);

    if (query) {
      localQuery = localQuery.ilike("name", `%${query}%`);
    }

    // Apply optional filters (basic implementation for future use)
    // Note: In Supabase, filtering on joined tables can be tricky. 
    // We fetch and filter in-memory if needed, or use specific inner join filters.
    if (filters?.goal) {
      localQuery = localQuery.eq("product_goals.goal", filters.goal);
    }
    if (filters?.brand) {
      localQuery = localQuery.ilike("brands.name", `%${filters.brand}%`);
    }
    
    const { data: localProducts, error } = await localQuery.limit(20);

    if (error) {
      console.warn("Warning fetching local products:", error);
    }

    let merged = [...(localProducts || [])] as Product[];
    
    // If we have filters, we might want to skip Open Food Facts entirely, 
    // or apply them in memory. We'll skip OFF if filters are active for now,
    // since OFF won't easily support our specific supplement goals/attributes.
    const hasFilters = filters && Object.values(filters).some(Boolean);
    const localCount = merged.length;
    let apiError = false;

    // 2. Search Open Food Facts if not enough local results and no strict internal filters
    if (localCount < 10 && !hasFilters && query) {
      const { products: externalProducts, error: offError } = await searchOpenFoodFacts(query);
      apiError = offError;

      // Merge and deduplicate by external_id / barcode
      for (const extProduct of externalProducts) {
        const exists = merged.some(
          (p) =>
            (p.barcode && p.barcode === extProduct.barcode) ||
            (p.external_id && p.external_id === extProduct.external_id) ||
            (p.name?.toLowerCase() === extProduct.name?.toLowerCase())
        );
        if (!exists) {
          merged.push(extProduct);
        }
      }
    }

    // Sort by source priority: elexir_curated > internal > open_food_facts
    merged.sort((a, b) => {
      const getSourcePriority = (source: string | null | undefined) => {
        if (source === "elexir_curated") return 3;
        if (!source || source === "internal") return 2;
        return 1; // open_food_facts
      };
      return getSourcePriority(b.source) - getSourcePriority(a.source);
    });

    return { results: merged, apiError };
  } catch (error) {
    console.warn("Warning in searchProducts:", error);
    return { results: [], apiError: true };
  }
}

/**
 * Saves a product. First upserts into `products`, then links in `user_saved_products`.
 */
export async function saveProduct(userId: string, product: Product): Promise<void> {
  let productId = product.id;

  // If the product doesn't have a Supabase UUID yet (from external API), upsert it.
  if (!productId || productId === "") {
    productId = await upsertExternalProduct(product);
  }

  // Insert into user_saved_products
  const { error: saveError } = await supabase
    .from("user_saved_products")
    .upsert(
      {
        user_id: userId,
        product_id: productId,
        status: "saved",
      },
      { onConflict: "user_id,product_id" }
    );

  if (saveError) throw saveError;
}

/**
 * Removes a product from user's saved items.
 */
export async function unsaveProduct(userId: string, productId: string): Promise<void> {
  const { error } = await supabase
    .from("user_saved_products")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);

  if (error) throw error;
}

/**
 * Upserts a product without adding it to user_saved_products.
 * Returns the upserted product's ID.
 */
export async function upsertExternalProduct(product: Product): Promise<string> {
  if (product.id && product.id !== "") return product.id;

  let matchQuery = supabase.from("products").select("id");
  if (product.barcode) {
    matchQuery = matchQuery.eq("barcode", product.barcode);
  } else if (product.external_id) {
    matchQuery = matchQuery.eq("external_id", product.external_id);
  } else {
    matchQuery = matchQuery.eq("name", product.name || "");
  }

  const { data: existing } = await matchQuery.limit(1).maybeSingle();

  if (existing) {
    return existing.id;
  } else {
    const { id: _, created_at: __, product_ingredients: ___, product_goals: ____, product_quality_attributes: _____, brands: ______, inferred_goals, ...productToInsert } = product;
    const { data: inserted, error: insertError } = await supabase
      .from("products")
      .insert(productToInsert)
      .select()
      .single();
      
    if (insertError) throw insertError;
    
    // Persist inferred goals if they exist
    if (inferred_goals && inferred_goals.length > 0) {
      const goalsToInsert = inferred_goals.map(goal => ({
        product_id: inserted.id,
        goal: goal
      }));
      
      const { error: goalsError } = await supabase
        .from("product_goals")
        .insert(goalsToInsert);
        
      if (goalsError) console.warn("Failed to insert inferred goals:", goalsError);
    }
    
    return inserted.id;
  }
}

/**
 * Gets a single product by ID with all joins.
 */
export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      brands(*),
      product_ingredients(*, ingredients(*)),
      product_goals(*),
      product_quality_attributes(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.warn("Error fetching product by id:", error);
    return null;
  }

  return data as Product;
}

/**
 * Gets all saved products for a user.
 */
export async function getSavedProducts(userId: string): Promise<UserSavedProduct[]> {
  const { data, error } = await supabase
    .from("user_saved_products")
    .select(`
      *,
      product:products (
        *,
        brands(*),
        product_ingredients(*, ingredients(*)),
        product_goals(*),
        product_quality_attributes(*)
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching saved products:", error);
    return [];
  }

  return data as UserSavedProduct[];
}

/**
 * Marks a product as viewed, upserting it to the top of the list and pruning old views.
 */
export async function markProductAsViewed(userId: string, productId: string): Promise<void> {
  if (!userId || !productId || productId === "") return;

  const { error } = await supabase
    .from("recently_viewed_products")
    .upsert(
      { user_id: userId, product_id: productId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,product_id" }
    );

  if (error) {
    console.error("Error marking product as viewed:", error);
    return;
  }

  // Prune down to 10
  const { data: views } = await supabase
    .from("recently_viewed_products")
    .select("id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false });

  if (views && views.length > 10) {
    const idsToDelete = views.slice(10).map(v => v.id);
    await supabase.from("recently_viewed_products").delete().in("id", idsToDelete);
  }
}

/**
 * Gets the user's recently viewed products.
 */
export async function getRecentlyViewedProducts(userId: string): Promise<RecentlyViewedProduct[]> {
  const { data, error } = await supabase
    .from("recently_viewed_products")
    .select(`
      *,
      product:products (
        *,
        brands(*),
        product_ingredients(*, ingredients(*)),
        product_goals(*),
        product_quality_attributes(*)
      )
    `)
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching recently viewed:", error);
    return [];
  }

  return data as RecentlyViewedProduct[];
}

/**
 * Gets recommended products for a user based on their primary goals.
 * Excludes products already saved or in the user's stack.
 */
export async function getRecommendedProducts(userId: string, primaryGoals: string[], healthConcerns: string[] = [], existingSupplements: string[] = [], dietType?: string | null): Promise<RecommendedProduct[]> {
  if (!primaryGoals || primaryGoals.length === 0) return [];

  // Get user's saved and stacked product IDs to exclude them
  const [savedRes, stackRes] = await Promise.all([
    supabase.from("user_saved_products").select("product_id").eq("user_id", userId),
    supabase.from("user_product_stack").select(`
      product_id,
      products (
        product_goals (goal),
        inferred_goals
      )
    `).eq("user_id", userId)
  ]);

  const excludedIds = new Set([
    ...(savedRes.data?.map(d => d.product_id) || []),
    ...(stackRes.data?.map(d => d.product_id) || [])
  ]);

  // Compute coverage
  const trackedGoals = Array.from(new Set([...primaryGoals, ...healthConcerns]));
  const stackGoals = new Map<string, number>();

  stackRes.data?.forEach((d: any) => {
    d.products?.product_goals?.forEach((g: any) => {
      stackGoals.set(g.goal, (stackGoals.get(g.goal) || 0) + 1);
    });
    d.products?.inferred_goals?.forEach((g: string) => {
      stackGoals.set(g, (stackGoals.get(g) || 0) + 1);
    });
  });

  const lowCoverageGoals = new Set(trackedGoals.filter(g => (stackGoals.get(g) || 0) === 0));
  const heavilyCoveredGoals = new Set(trackedGoals.filter(g => (stackGoals.get(g) || 0) >= 2));

  // Fetch products with their goals
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      brands(*),
      product_ingredients(*, ingredients(*)),
      product_goals(*),
      product_quality_attributes(*)
    `)
    .limit(100); // Limit to avoid massive memory usage if db grows

  if (error) {
    console.error("Error fetching for recommendations:", error);
    return [];
  }

  const products = data as Product[];

  // Filter out excluded
  const eligible = products.filter(p => !excludedIds.has(p.id));

  // Calculate match score
  const withScores = eligible.map(p => {
    const productGoals = p.product_goals?.length ? p.product_goals.map(g => g.goal) : (p.inferred_goals || []);
    const match = calculateMatch(primaryGoals, healthConcerns, productGoals);
    
    let penalty = 0;
    if (existingSupplements.length > 0) {
      const pText = [
        p.name,
        p.brand,
        ...(p.product_ingredients?.map(i => i.ingredient?.name) || [])
      ].filter(Boolean).join(" ").toLowerCase();
      
      existingSupplements.forEach(es => {
        if (pText.includes(es.toLowerCase())) {
          penalty += 5;
        }
      });
    }

    let boost = 0;
    if (p.source === "elexir_curated") {
      boost += 10;
    }

    // New coverage logic
    const supportsLowCoverage = productGoals.filter(g => lowCoverageGoals.has(g));
    const supportsOnlyHeavilyCovered = productGoals.every(g => heavilyCoveredGoals.has(g)) && productGoals.length > 0;

    if (supportsLowCoverage.length > 0) {
      boost += 15;
    } else if (supportsOnlyHeavilyCovered) {
      penalty += 10;
    }

    // Diet match
    const pAttributes = p.product_quality_attributes?.map(a => a.attribute.toLowerCase()) || [];
    const dietMatches = dietType ? pAttributes.includes(dietType.toLowerCase()) : false;
    if (dietMatches) {
      boost += 5;
    }

    // Determine reasoning
    let reason = "";
    if (supportsLowCoverage.length > 0) {
      reason = `May help broaden support for ${formatGoalLabel(supportsLowCoverage[0])}`;
    } else if (primaryGoals.length > 0 && productGoals.some(g => primaryGoals.includes(g))) {
      const g = productGoals.find(g => primaryGoals.includes(g));
      reason = `Supports ${formatGoalLabel(g!)}`;
    } else if (dietMatches && dietType) {
      reason = `Matches your ${dietType.charAt(0).toUpperCase() + dietType.slice(1)} preferences`;
    } else if (p.source === "elexir_curated") {
      reason = "High quality curated product";
    }

    return { product: p, score: match.score - penalty + boost, reason };
  });

  // Filter those with score > 0, sort by score desc
  return withScores
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * Gets similar products based on category, goals, and ingredients overlaps.
 */
export async function getSimilarProducts(targetProduct: Product, limit = 3): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      brands(*),
      product_ingredients(*, ingredients(*)),
      product_goals(*),
      product_quality_attributes(*)
    `)
    .neq("id", targetProduct.id)
    .limit(100);

  if (error) {
    console.error("Error fetching for similar products:", error);
    return [];
  }

  const products = data as Product[];
  const targetGoals = new Set([
    ...(targetProduct.product_goals?.map(g => g.goal) || []),
    ...(targetProduct.inferred_goals || [])
  ]);
  const targetIngredients = new Set(
    targetProduct.product_ingredients?.map(i => i.ingredient?.name?.toLowerCase()).filter(Boolean) || []
  );

  const scoredProducts = products.map(p => {
    let score = 0;
    
    // Category match
    if (p.category && targetProduct.category && p.category === targetProduct.category) {
      score += 10;
    }

    // Goal overlap
    const pGoals = [
      ...(p.product_goals?.map(g => g.goal) || []),
      ...(p.inferred_goals || [])
    ];
    pGoals.forEach(g => {
      if (targetGoals.has(g)) score += 5;
    });

    // Ingredient overlap
    const pIngredients = p.product_ingredients?.map(i => i.ingredient?.name?.toLowerCase()).filter(Boolean) || [];
    pIngredients.forEach(ing => {
      if (targetIngredients.has(ing)) score += 3;
    });

    if (p.source === "elexir_curated") {
      score += 10;
    }

    return { product: p, score };
  });

  return scoredProducts
    .filter(ws => ws.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(ws => ws.product);
}
