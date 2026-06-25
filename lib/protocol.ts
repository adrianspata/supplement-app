import { supabase } from "./supabase";
import { TodayProtocolItem, DailyProtocolLog } from "./types";
import { getUserStack } from "./stack";

export async function getTodayProtocol(userId: string): Promise<TodayProtocolItem[]> {
  const stackItems = await getUserStack(userId);
  
  if (stackItems.length === 0) return [];

  // Get today's local date in YYYY-MM-DD
  const todayStr = new Date().toLocaleDateString('en-CA'); // e.g. "2026-06-01"
  
  const { data: logs, error } = await supabase
    .from("daily_protocol_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("scheduled_for", todayStr);

  if (error) {
    console.error("Error fetching today's logs:", error);
  }

  const logMap = new Map<string, DailyProtocolLog>();
  if (logs) {
    logs.forEach(log => logMap.set(log.stack_item_id, log));
  }

  return stackItems.map(item => {
    const log = logMap.get(item.id);
    return {
      ...item,
      status: log?.status || 'pending',
      taken_at: log?.taken_at || null,
      log_id: log?.id,
    };
  });
}

export async function markStackItemTaken(
  userId: string,
  stackItemId: string,
  productId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from("daily_protocol_logs")
    .upsert(
      {
        user_id: userId,
        stack_item_id: stackItemId,
        product_id: productId,
        scheduled_for: date,
        status: 'taken',
        taken_at: new Date().toISOString(),
      },
      { onConflict: "user_id,stack_item_id,scheduled_for" }
    );

  if (error) throw error;
}

export async function unmarkStackItemTaken(
  userId: string,
  stackItemId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from("daily_protocol_logs")
    .update({
      status: 'pending',
      taken_at: null,
    })
    .eq("user_id", userId)
    .eq("stack_item_id", stackItemId)
    .eq("scheduled_for", date);

  // Note: if there was no log, this does nothing which is fine, 
  // since a non-existent log means it's already 'pending'.
  if (error) throw error;
}

export async function getProtocolLogsForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyProtocolLog[]> {
  const { data, error } = await supabase
    .from("daily_protocol_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_for", startDate)
    .lte("scheduled_for", endDate);

  if (error) {
    console.error("Error fetching logs for date range:", error);
    return [];
  }

  return data as DailyProtocolLog[];
}
