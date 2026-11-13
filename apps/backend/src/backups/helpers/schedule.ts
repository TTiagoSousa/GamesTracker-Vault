/**
 * The automatic backup's timetable, in the server's time zone (TZ, which the installer
 * sets to the Proxmox host's).
 */

export interface ScheduleSettings {
  automatic: boolean;
  // "HH:MM"
  time: string;
  // Day ("YYYY-MM-DD") of the last automatic backup
  lastAutoDate: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in local time. */
export function localDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "HH:MM" in local time. */
export function localTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Due when it is on, the time of day has come and today's hasn't been made yet. A server
 * that was off at that time makes it as soon as it starts (it doesn't skip the day).
 */
export function isBackupDue(settings: ScheduleSettings, now: Date): boolean {
  if (!settings.automatic) return false;
  if (settings.lastAutoDate === localDate(now)) return false;
  return localTime(now) >= settings.time;
}

/** When the next automatic backup will run; null when they are off. */
export function nextBackupAt(
  settings: ScheduleSettings,
  now: Date,
): Date | null {
  if (!settings.automatic) return null;
  if (isBackupDue(settings, now)) return now;
  const [hours, minutes] = settings.time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}
