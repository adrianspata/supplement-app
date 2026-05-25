import { supabase } from "./supabase";
import { UserStackItem, StackTiming, DailyStackLog } from "./types";

export async function addToStack(userId: string, productId: string, timing: StackTiming): Promise<void> {
  const { error } = await supabase
    .from("user_product_stack")
    .upsert(
      {
        user_id: userId,
        product_id: productId,
        timing,
      },
      { onConflict: "user_id,product_id,timing" }
    );

  if (error) throw error;
}

export async function removeFromStack(userId: string, productId: string, timing: StackTiming): Promise<void> {
  const { error } = await supabase
    .from("user_product_stack")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId)
    .eq("timing", timing);

  if (error) throw error;
}

export async function getUserStack(userId: string): Promise<UserStackItem[]> {
  const { data, error } = await supabase
    .from("user_product_stack")
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

export async function getDailyLogs(userId: string, date: string): Promise<DailyStackLog[]> {
  const { data, error } = await supabase
    .from("daily_stack_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date);

  if (error) {
    console.error("Error fetching daily logs:", error);
    return [];
  }

  return data as DailyStackLog[];
}

export async function getLogsForDateRange(userId: string, startDate: string, endDate: string): Promise<DailyStackLog[]> {
  const { data, error } = await supabase
    .from("daily_stack_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate);

  if (error) {
    console.error("Error fetching logs for date range:", error);
    return [];
  }

  return data as DailyStackLog[];
}

export async function toggleDailyLog(
  userId: string,
  stackItemId: string,
  productId: string,
  date: string,
  taken: boolean
): Promise<void> {
  const { error } = await supabase
    .from("daily_stack_logs")
    .upsert(
      {
        user_id: userId,
        stack_item_id: stackItemId,
        product_id: productId,
        log_date: date,
        taken,
        taken_at: taken ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,stack_item_id,log_date" }
    );

  if (error) throw error;
}
