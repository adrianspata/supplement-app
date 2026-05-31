export function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

export function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const expiry = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);
  return expiry >= today && expiry <= thirtyDaysFromNow;
}

export function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    // Use a clean display format
    return date.toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
