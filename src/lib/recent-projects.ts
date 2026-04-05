const STORAGE_KEY = "pm-recent-project-keys";
const MAX_RECENT = 5;

export function readRecentProjectKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordRecentProjectAccess(folderKey: string): string[] {
  const prev = readRecentProjectKeys();
  const next = [folderKey, ...prev.filter((k) => k !== folderKey)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearRecentProjects(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
