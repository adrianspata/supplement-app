import { supabase } from "./supabase";
import { UserStackItem, StackTiming, DailyStackLog } from "./types";

export async function addProductToStack(
  userId: string, 
  productId: string, 
  timing: StackTiming, 
  dosage: string | null = null, 
  frequency: string | null = 'Daily', 
  notes: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from("user_stack_items")
    .upsert(
      {
        user_id: userId,
        product_id: productId,
        timing,
        dosage,
        frequency,
        notes,
      },
      { onConflict: "user_id,product_id,timing" }
    );

  if (error) throw error;
}

export async function removeStackItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("user_stack_items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function updateStackItem(id: string, payload: Partial<UserStackItem>): Promise<void> {
  const { error } = await supabase
    .from("user_stack_items")
    .update(payload)
    .eq("id", id);

  if (error) throw error;
}

export async function getUserStack(userId: string): Promise<UserStackItem[]> {
  const { data, error } = await supabase
    .from("user_stack_items")
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
    console.error("Error fetching user stack:", error);
    return [];
  }

  return data as UserStackItem[];
}


