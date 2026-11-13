import { isBackupDue, localDate, nextBackupAt } from './schedule';

const at = (iso: string) => new Date(iso);

describe('isBackupDue', () => {
  const settings = { automatic: true, time: '03:30', lastAutoDate: null };

  it('is not due before the time of day', () => {
    expect(isBackupDue(settings, at('2026-11-11T03:29:00'))).toBe(false);
  });

  it('is due from the time of day on', () => {
    expect(isBackupDue(settings, at('2026-11-11T03:30:00'))).toBe(true);
    expect(isBackupDue(settings, at('2026-11-11T15:00:00'))).toBe(true);
  });

  it('runs once a day', () => {
    const done = { ...settings, lastAutoDate: '2026-11-11' };
    expect(isBackupDue(done, at('2026-11-11T20:00:00'))).toBe(false);
    expect(isBackupDue(done, at('2026-11-12T03:30:00'))).toBe(true);
  });

  it('never runs when automatic backups are off', () => {
    const off = { ...settings, automatic: false };
    expect(isBackupDue(off, at('2026-11-11T12:00:00'))).toBe(false);
  });
});

describe('nextBackupAt', () => {
  const settings = { automatic: true, time: '03:30', lastAutoDate: null };

  it('is later today when the time has not come yet', () => {
    const next = nextBackupAt(settings, at('2026-11-11T01:00:00'));
    expect(next && localDate(next)).toBe('2026-11-11');
    expect(next?.getHours()).toBe(3);
    expect(next?.getMinutes()).toBe(30);
  });

  it('is tomorrow when today is already done', () => {
    const done = { ...settings, lastAutoDate: '2026-11-11' };
    const next = nextBackupAt(done, at('2026-11-11T10:00:00'));
    expect(next && localDate(next)).toBe('2026-11-12');
  });

  it('is null when automatic backups are off', () => {
    expect(
      nextBackupAt({ ...settings, automatic: false }, at('2026-11-11T10:00')),
    ).toBeNull();
  });
});
