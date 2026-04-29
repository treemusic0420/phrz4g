import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchLessons, fetchMonthlyStats, fetchStudyLogs } from '../lib/firestore';
import { formatDateTime, toDate } from '../utils/format';

const TZ = 'Asia/Tokyo';

const getDatePartsInTz = (date, timeZone = TZ) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return { year, month, day };
};

const getDateKeyInTz = (date, timeZone = TZ) => {
  const { year, month, day } = getDatePartsInTz(date, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const toUtcFromTzDateParts = (parts) => new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

const addDaysInTz = (parts, diff) => {
  const base = toUtcFromTzDateParts(parts);
  base.setUTCDate(base.getUTCDate() + diff);
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
};

const getMondayInTz = (parts) => {
  const utcDate = toUtcFromTzDateParts(parts);
  const day = utcDate.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDaysInTz(parts, mondayOffset);
};

const toShortDateLabel = (date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
  }).format(date);

const formatDurationCompact = (seconds = 0) => {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${remainder}s`;
};

const buildDashboardData = (lessons, logs, options = {}) => {
  const { canUseStudyLogs = true, monthlyTotalBeforeCurrentMonth = 0 } = options;
  const now = new Date();
  const nowParts = getDatePartsInTz(now);
  const todayKey = getDateKeyInTz(now);
  const mondayParts = getMondayInTz(nowParts);
  const mondayKey = `${mondayParts.year}-${String(mondayParts.month).padStart(2, '0')}-${String(mondayParts.day).padStart(2, '0')}`;
  const monthPrefix = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}`;
  const shouldUseLogsSummary = canUseStudyLogs && logs.length > 0;

  let today = 0;
  let week = 0;
  let month = 0;
  let total = 0;
  let activeDaysThisMonth = 0;

  const daySet = new Set();
  const perDaySeconds = new Map();

  const sortedLogs = [...logs].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() || 0;
    const bTime = toDate(b.createdAt)?.getTime() || 0;
    return bTime - aTime;
  });

  sortedLogs.forEach((log) => {
    const created = toDate(log.createdAt);
    if (!created || Number.isNaN(created.getTime())) return;

    const dayKey = getDateKeyInTz(created);
    const seconds = Math.max(0, Number(log.durationSeconds) || 0);

    if (dayKey === todayKey) today += seconds;
    if (dayKey >= mondayKey) week += seconds;
    if (dayKey.startsWith(monthPrefix)) month += seconds;

    daySet.add(dayKey);
    perDaySeconds.set(dayKey, (perDaySeconds.get(dayKey) || 0) + seconds);
  });

  activeDaysThisMonth = Array.from(daySet).filter((dayKey) => dayKey.startsWith(monthPrefix)).length;

  const lessonBasedTotal = lessons.reduce((sum, lesson) => sum + (Number(lesson.totalStudySeconds) || 0), 0);
  if (!shouldUseLogsSummary) {
    total = lessonBasedTotal;
    today = 0;
    week = 0;
    month = 0;
  } else {
    total = monthlyTotalBeforeCurrentMonth + month;
  }


  let streak = 0;
  if (shouldUseLogsSummary) {
    let cursor = { ...nowParts };
    while (daySet.has(`${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(cursor.day).padStart(2, '0')}`)) {
      streak += 1;
      cursor = addDaysInTz(cursor, -1);
    }
  }

  const last7Days = Array.from({ length: 7 }, (_, index) => {
    const dayParts = addDaysInTz(nowParts, -(6 - index));
    const key = `${dayParts.year}-${String(dayParts.month).padStart(2, '0')}-${String(dayParts.day).padStart(2, '0')}`;
    const sourceDate = new Date(Date.UTC(dayParts.year, dayParts.month - 1, dayParts.day, 12));
    const seconds = perDaySeconds.get(key) || 0;
    return {
      key,
      label: toShortDateLabel(sourceDate),
      minutes: Math.round(seconds / 60),
      seconds,
      isToday: key === todayKey,
    };
  });

  return {
    summary: {
      today,
      week,
      month,
      total,
      streak,
      activeDaysThisMonth,
      daysElapsedThisMonth: nowParts.day,
      activeDaysRateThisMonth: nowParts.day > 0 ? (activeDaysThisMonth / nowParts.day) * 100 : 0,
    },
    last7Days,
  };
};

const MetricCard = ({ label, value, tone = 'blue' }) => (
  <article className={`card dashboard-summary-card dashboard-summary-card-${tone}`}>
    <span className="dashboard-card-dot" aria-hidden="true" />
    <p className="dashboard-card-label">{label}</p>
    <p className="dashboard-card-value">{value}</p>
  </article>
);

const SimpleBarChart = ({ title, data, valueKey, emptyText, valueSuffix = '', variant = 'studyTime' }) => {
  const maxValue = Math.max(...data.map((item) => item[valueKey]), 0);
  return (
    <article className="card dashboard-chart-card">
      <h3>{title}</h3>
      {maxValue === 0 ? (
        <p className="section-subtle">{emptyText}</p>
      ) : (
        <div className="simple-bar-chart" role="img" aria-label={title}>
          {data.map((item) => {
            const value = item[valueKey];
            const percent = maxValue ? Math.max(8, Math.round((value / maxValue) * 100)) : 0;
            const isMax = maxValue > 0 && value === maxValue;
            const isToday = variant === 'studyTime' && item.isToday;
            const fillClass =
              variant === 'practiceBalance'
                ? `simple-bar-fill-${String(item.label || '').toLowerCase()}`
                : 'simple-bar-fill-study-time';
            return (
              <div className="simple-bar-row" key={item.label}>
                <p className="simple-bar-label">{item.label}</p>
                <div className="simple-bar-track">
                  <div
                    className={`simple-bar-fill ${fillClass} ${isMax || isToday ? 'simple-bar-fill-strong' : ''}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="simple-bar-value">{value}{valueSuffix}</p>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
};

const toMonthRoute = (lesson) => {
  if (!lesson?.categoryId || !lesson?.registeredMonth) return '';
  return `/lessons/category/${lesson.categoryId}/month/${lesson.registeredMonth}`;
};

const sanitizeErrorMessage = (error) => {
  const raw = String(error?.message || 'Unknown error');
  if (raw.includes('query requires an index')) return 'The query requires an index.';
  return raw.replace(/https?:\/\/\S+/g, '[link hidden]');
};

export default function StatsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [lessonsStatus, setLessonsStatus] = useState('idle');
  const [studyLogsStatus, setStudyLogsStatus] = useState('idle');
  const [lessonsError, setLessonsError] = useState('');
  const [studyLogsError, setStudyLogsError] = useState('');
  const [monthlyStatsTotalBeforeCurrentMonth, setMonthlyStatsTotalBeforeCurrentMonth] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLessonsStatus('loading');
      setStudyLogsStatus('loading');
      setLessonsError('');
      setStudyLogsError('');

      const now = new Date();
      const nowParts = getDatePartsInTz(now);
      const currentMonthKey = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}`;

      const [lessonsResult, logsResult, monthlyStatsResult] = await Promise.allSettled([
        fetchLessons(userId),
        fetchStudyLogs(userId),
        fetchMonthlyStats(userId),
      ]);

      if (!active) return;

      if (lessonsResult.status === 'fulfilled') {
        setLessons(lessonsResult.value);
        setLessonsStatus('success');
      } else {
        setLessons([]);
        setLessonsStatus('error');
        setLessonsError(lessonsResult.reason?.message || 'Unknown error');
      }

      if (logsResult.status === 'fulfilled') {
        setLogs(logsResult.value);
        setStudyLogsStatus('success');
      } else {
        setLogs([]);
        setStudyLogsStatus('error');
        setStudyLogsError(sanitizeErrorMessage(logsResult.reason));
      }

      if (monthlyStatsResult.status === 'fulfilled') {
        const totalBeforeCurrentMonth = monthlyStatsResult.value.reduce((sum, item) => {
          const monthKey = String(item.monthKey || '');
          if (!monthKey || monthKey >= currentMonthKey) return sum;
          return sum + (Number(item.totalStudySeconds) || 0);
        }, 0);
        setMonthlyStatsTotalBeforeCurrentMonth(totalBeforeCurrentMonth);
      } else {
        setMonthlyStatsTotalBeforeCurrentMonth(0);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const dashboard = useMemo(
    () =>
      buildDashboardData(lessons, logs, {
        canUseStudyLogs: studyLogsStatus === 'success',
        monthlyTotalBeforeCurrentMonth: monthlyStatsTotalBeforeCurrentMonth,
      }),
    [lessons, logs, monthlyStatsTotalBeforeCurrentMonth, studyLogsStatus],
  );

  const lessonsById = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);

  const latestStudiedLesson = useMemo(() => {
    const recentLog = [...logs].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))[0];
    if (!recentLog?.lessonId) return null;
    return lessonsById.get(recentLog.lessonId) || null;
  }, [logs, lessonsById]);

  const continuePracticeRoute = toMonthRoute(latestStudiedLesson) || '/lessons';

  const recentlyStudied = useMemo(
    () =>
      [...lessons]
        .sort((a, b) => (toDate(b.lastStudiedAt)?.getTime() || 0) - (toDate(a.lastStudiedAt)?.getTime() || 0))
        .filter((lesson) => toDate(lesson.lastStudiedAt))
        .slice(0, 5),
    [lessons],
  );

  const recentlyAdded = useMemo(
    () => [...lessons].sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)).slice(0, 5),
    [lessons],
  );

  const recommendedLessons = recentlyStudied.length > 0 ? recentlyStudied : recentlyAdded;

  const summaryCards = [
    { label: 'This Week', value: formatDurationCompact(dashboard.summary.week), tone: 'indigo' },
    { label: 'This Month', value: formatDurationCompact(dashboard.summary.month), tone: 'purple' },
    { label: 'Total', value: formatDurationCompact(dashboard.summary.total), tone: 'gradient' },
    { label: 'Study Streak', value: `${dashboard.summary.streak} days`, tone: 'blue' },
  ];

  const hasLessons = lessons.length > 0;

  return (
    <section className="stack dashboard-page">
      <h2 className="section-title">Study Dashboard</h2>

      <details className="debug-panel">
        <summary>Debug Info</summary>
        <p>debug.userId: {userId}</p>
        <p>debug.lessonsStatus: {lessonsStatus}</p>
        <p>debug.lessonsCount: {lessons.length}</p>
        <p>debug.studyLogsStatus: {studyLogsStatus}</p>
        <p>debug.studyLogsCount: {logs.length}</p>
        {lessonsError ? <p className="error">debug.lessonsError: {lessonsError}</p> : null}
        {studyLogsError ? <p className="error">debug.studyLogsError: {studyLogsError}</p> : null}
      </details>

      {lessonsStatus === 'error' ? <p className="error">Failed to load lessons.</p> : null}
      {studyLogsStatus === 'error' ? (
        <p className="error">Failed to load study logs. Lesson-based summary is still available.</p>
      ) : null}

      <article className="card dashboard-hero-card">
        <p className="dashboard-card-label">Today’s Study</p>
        {hasLessons ? (
          <>
            <p className="dashboard-hero-time">{formatDurationCompact(dashboard.summary.today)}</p>
            <p className="dashboard-hero-meta">Streak {dashboard.summary.streak} day{dashboard.summary.streak === 1 ? '' : 's'}</p>
          </>
        ) : (
          <>
            <p className="dashboard-hero-time">Start your first lesson</p>
            <p className="dashboard-hero-meta">Add your first lesson and begin daily practice.</p>
          </>
        )}
      </article>

      <article className="card">
        <h3>Quick Actions</h3>
        <div className="dashboard-quick-actions">
          <button className="btn" type="button" onClick={() => navigate(continuePracticeRoute)}>
            Continue Practice
          </button>
          <Link className="btn ghost" to="/lessons/new">
            Add Lesson
          </Link>
          <Link className="btn ghost" to="/lessons">
            Lessons
          </Link>
        </div>
      </article>

      <section className="dashboard-summary-grid" aria-label="Summary cards">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </section>

      <section className="dashboard-chart-grid">
        <SimpleBarChart
          title="Study Time - Last 7 Days"
          data={dashboard.last7Days}
          valueKey="minutes"
          valueSuffix="m"
          variant="studyTime"
          emptyText="No study logs yet. Start a lesson to see your progress."
        />
        <article className="card dashboard-chart-card dashboard-active-days-card">
          <h3>Active Days (This Month)</h3>
          <div className="dashboard-active-days-progress" aria-hidden="true">
            <div
              className="dashboard-active-days-progress-fill"
              style={{ width: `${Math.min(100, dashboard.summary.activeDaysRateThisMonth)}%` }}
            />
          </div>
          <div className="dashboard-active-days-main">
            <p className="dashboard-active-days-value">
              {dashboard.summary.activeDaysThisMonth} / {dashboard.summary.daysElapsedThisMonth} days
            </p>
            <p className="dashboard-active-days-rate">
              {dashboard.summary.activeDaysRateThisMonth.toFixed(1)}%
            </p>
          </div>
          <p className="dashboard-active-days-subtle">
            Active on {dashboard.summary.activeDaysThisMonth} of {dashboard.summary.daysElapsedThisMonth} days so far
          </p>
        </article>
      </section>

      <article className="card">
        <h3>{recentlyStudied.length > 0 ? 'Recently Studied' : 'Recently Added'}</h3>
        {recommendedLessons.length === 0 ? (
          <p className="section-subtle">No lessons yet. Add your first lesson to get recommendations.</p>
        ) : (
          <ul className="dashboard-list">
            {recommendedLessons.map((lesson) => (
              <li className="dashboard-list-item" key={lesson.id}>
                <p className="dashboard-list-title">{lesson.title || 'Untitled lesson'}</p>
                <p className="section-subtle">Last studied: {formatDateTime(lesson.lastStudiedAt)}</p>
                <div className="row gap-sm wrap">
                  <Link className="btn ghost" to={`/lessons/${lesson.id}`}>Details</Link>
                  <Link className="btn ghost" to={`/lessons/${lesson.id}/edit`}>Edit</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
