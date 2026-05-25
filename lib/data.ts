import { supabase } from "./supabase";

export async function getUserSupplementUsage(userId: string) {
  const { data, error } = await supabase
    .from("daily_intakes")
    .select(`
      id,
      intake_date,
      user_supplement_id,
      user_supplements (
        custom_name,
        daily_dose,
        intake_time
      )
    `)
    .eq("user_id", userId);

  if (error) throw error;

  return data;
}

export async function getUserWellbeingLogs(userId: string) {
  const { data, error } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .order("log_date", { ascending: true });

  if (error) throw error;

  return data;
}

export async function getPantryHealth(userId: string) {
  const { data, error } = await supabase
    .from("user_supplements")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;

  return data?.map((item) => ({
    id: item.id,
    name: item.custom_name,
    capsulesRemaining: item.capsules_remaining,
    dailyDose: item.daily_dose,
    daysLeft: item.daily_dose
      ? Math.floor(item.capsules_remaining / item.daily_dose)
      : 0,
  }));
}