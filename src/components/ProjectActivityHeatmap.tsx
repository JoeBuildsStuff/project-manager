import {
  eachDayOfInterval,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from "date-fns";
import { cn } from "@/lib/utils";

interface GitActivityDay {
  date: string;
  count: number;
}

export interface GitActivity {
  folder_key: string;
  has_repo: boolean;
  days: GitActivityDay[];
  total_commits: number;
  active_days: number;
}

interface Props {
  activity: GitActivity | null;
  loading: boolean;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROW_LABELS = [1, 3, 5];

export default function ProjectActivityHeatmap({ activity, loading }: Props) {
  const today = startOfDay(new Date());
  const rangeStart = startOfWeek(subDays(today, 364), { weekStartsOn: 0 });
  const rangeEnd = endOfWeek(today, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const weeks = chunk(days, 7);

  const counts = new Map(activity?.days.map((day) => [day.date, day.count]) ?? []);
  const maxCount = Math.max(...Array.from(counts.values()), 0);
  const summary = loading
    ? "Loading commit activity…"
    : !activity?.has_repo
      ? "No local git repository"
      : activity.total_commits > 0
        ? `${activity.total_commits} commits across ${activity.active_days} active days`
        : "No commits in the last year";

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[40px_1fr] gap-x-3 gap-y-2">
            <div />
            <div
              className="grid gap-1 text-[11px] text-muted-foreground"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            >
              {weeks.map((week, index) => (
                <div key={`month-${index}`} className="h-4">
                  {shouldShowMonthLabel(weeks, index) ? format(week[0], "MMM") : ""}
                </div>
              ))}
            </div>

            <div className="grid grid-rows-7 gap-1 pt-0.5 text-[11px] text-muted-foreground">
              {WEEKDAY_LABELS.map((_, dayIndex) => (
                <div key={dayIndex} className="flex h-3.5 items-center">
                  {ROW_LABELS.includes(dayIndex) ? WEEKDAY_LABELS[dayIndex] : ""}
                </div>
              ))}
            </div>

            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
            >
              {weeks.map((week, weekIndex) => (
                <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1">
                  {week.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const count = counts.get(dateKey) ?? 0;
                    const outsideRange = day > today;

                    return (
                      <div
                        key={dateKey}
                        title={formatTooltip(day, count, activity?.has_repo ?? false, loading)}
                        className={cn(
                          "h-3.5 w-3.5 rounded-[3px] border border-transparent transition-transform hover:scale-110",
                          loading && "animate-pulse bg-muted",
                          !loading && getCellClass(count, maxCount, outsideRange)
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{summary}</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={cn("h-3 w-3 rounded-[3px]", legendClass(level))}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function shouldShowMonthLabel(weeks: Date[][], weekIndex: number) {
  const week = weeks[weekIndex];
  if (!week?.length) return false;
  if (weekIndex === 0) return true;
  return week.some((day) => format(day, "d") === "1");
}

/** Light: softer emerald ramp on white; dark: GitHub-style greens on dark bg. */
function getCellClass(count: number, maxCount: number, outsideRange: boolean) {
  if (outsideRange) return "bg-transparent";
  if (count === 0) return "bg-muted";

  const level = getActivityLevel(count, maxCount);
  if (level === 1) return "bg-emerald-200 dark:bg-[#0e4429]";
  if (level === 2) return "bg-emerald-300 dark:bg-[#006d32]";
  if (level === 3) return "bg-emerald-500 dark:bg-[#26a641]";
  return "bg-emerald-600 dark:bg-[#39d353]";
}

function legendClass(level: number) {
  if (level === 0) return "bg-muted";
  if (level === 1) return "bg-emerald-200 dark:bg-[#0e4429]";
  if (level === 2) return "bg-emerald-300 dark:bg-[#006d32]";
  if (level === 3) return "bg-emerald-500 dark:bg-[#26a641]";
  return "bg-emerald-600 dark:bg-[#39d353]";
}

function getActivityLevel(count: number, maxCount: number) {
  if (count <= 0 || maxCount <= 0) return 0;
  if (count >= maxCount) return 4;
  const ratio = count / maxCount;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function formatTooltip(day: Date, count: number, hasRepo: boolean, loading: boolean) {
  if (loading) return "Loading commit activity";
  if (!hasRepo) return `${format(day, "MMM d, yyyy")} • no git repository`;
  if (count === 0) return `${format(day, "MMM d, yyyy")} • no commits`;
  return `${format(day, "MMM d, yyyy")} • ${count} commit${count === 1 ? "" : "s"}`;
}

export function normalizeGitActivity(raw: GitActivity | null) {
  if (!raw) return null;
  return {
    ...raw,
    days: raw.days
      .map((day) => ({
        ...day,
        date: format(startOfDay(parseISO(day.date)), "yyyy-MM-dd"),
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
