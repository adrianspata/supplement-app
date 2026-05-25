import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserStack, getLogsForDateRange } from "./stack";
import { Platform } from "react-native";

const REMINDERS_ENABLED_KEY = "ELEXIR_REMINDERS_ENABLED";

export async function getRemindersEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(REMINDERS_ENABLED_KEY);
    return val === "true";
  } catch (e) {
    return false;
  }
}

export async function setRemindersEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, enabled ? "true" : "false");
    
    if (enabled && Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        // They denied it, so revert the toggle
        await AsyncStorage.setItem(REMINDERS_ENABLED_KEY, "false");
      }
    } else if (!enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  } catch (e) {
    console.error("Error setting reminders enabled:", e);
  }
}

export async function syncNotifications(userId: string) {
  try {
    // 1. Cancel existing local notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    // 2. Check if reminders are enabled
    const enabled = await getRemindersEnabled();
    if (!enabled) return;

    // 3. Fetch user stack and last 7 days of logs (to check today's completions)
    // We only strictly need today's logs for cancellation, but fetching a small window is fine.
    const today = new Date();
    const startDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [userStack, logs] = await Promise.all([
      getUserStack(userId),
      getLogsForDateRange(userId, startDate, endDate)
    ]);

    if (userStack.length === 0) return;

    // Time constants
    const TIME_MAP: Record<string, { h: number, m: number }> = {
      morning: { h: 8, m: 0 },
      afternoon: { h: 13, m: 0 },
      evening: { h: 20, m: 0 },
    };

    // Helper to get log taken status
    const isTaken = (stackItemId: string, dateStr: string) => {
      const log = logs.find(l => l.stack_item_id === stackItemId && l.log_date === dateStr);
      return log?.taken ?? false;
    };

    // 4. Sliding Window: Schedule for the next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + dayOffset);
      const targetDateStr = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      const isToday = dayOffset === 0;

      for (const timing of ["morning", "afternoon", "evening"] as const) {
        const items = userStack.filter(i => i.timing === timing);
        const count = items.length;
        if (count === 0) continue;

        // Check if all items for this block are taken on this specific date
        // Note: For future days (1-6), they won't have logs yet, so they will schedule normally.
        const allTaken = items.every(item => isTaken(item.id, targetDateStr));

        if (allTaken) continue; // Smart Behavior: Cancelled/Skipped

        // Set specific notification time
        const notificationTime = new Date(targetDate);
        notificationTime.setHours(TIME_MAP[timing].h, TIME_MAP[timing].m, 0, 0);

        // If today, check if the time has already passed
        if (isToday && new Date() > notificationTime) {
          continue;
        }

        // Generate Copy
        let title = "Stack Reminder";
        let body = "";

        if (timing === "morning") {
          body = "Your morning stack is ready.";
        } else if (timing === "afternoon") {
          body = `${count} supplement${count > 1 ? 's' : ''} scheduled this afternoon.`;
        } else if (timing === "evening") {
          body = `${count} supplement${count > 1 ? 's' : ''} remaining this evening.`;
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
          },
          trigger: notificationTime,
        });
      }
    }
  } catch (error) {
    console.error("Failed to sync notifications:", error);
  }
}