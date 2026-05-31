import { supabase } from "./supabase";
import { DailyCheckIn } from "./types";

const getTodayString = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().split('T')[0];
};

export async function getTodayCheckIn(userId: string): Promise<DailyCheckIn | null> {
  const todayStr = getTodayString();
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('checkin_date', todayStr)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
    console.error("Error fetching today check-in:", error);
    return null;
  }
  
  return data as DailyCheckIn | null;
}

export async function upsertTodayCheckIn(
  userId: string, 
  scores: { sleep_score?: number | null; energy_score?: number | null; stress_score?: number | null }
): Promise<{ data: DailyCheckIn | null; error: any }> {
  const todayStr = getTodayString();
  
  const payload = {
    user_id: userId,
    checkin_date: todayStr,
    ...scores,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('daily_checkins')
    .upsert(payload, { onConflict: 'user_id, checkin_date' })
    .select()
    .single();

  if (error) {
    console.error("Error upserting today check-in:", error);
  }

  return { data: data as DailyCheckIn | null, error };
}

export async function getCheckInsForDateRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyCheckIn[]> {
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', userId)
    .gte('checkin_date', startDate)
    .lte('checkin_date', endDate)
    .order('checkin_date', { ascending: true });

  if (error) {
    console.error("Error fetching check-ins for date range:", error);
    return [];
  }

  return data as DailyCheckIn[];
}

