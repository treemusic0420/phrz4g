import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { fetchLessons, fetchStudyLogs } from '../lib/firestore';
import { formatDateTime, formatSeconds, toDate } from '../utils/format';

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

const normalizeTrainingType = (type = '') => {
  if (type === 'dictation') return 'Dictation';
  if (type === 'shadowing') return 'Shadowing';
  return 'Unknown';
};

const buildDashboardData = (lessons, logs) => {
  const now = new Date();
  const nowParts = getDatePartsInTz(now);
  const todayKey = getDateKeyInTz(now);
  const mondayParts = getMondayInTz(nowParts);
  const mondayKey = `${mondayParts.year}-${String(mondayParts.month).padStart(2, '0')}-${String(mondayParts.day).padStart(2, '0')}`;
  const monthPrefix = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}`;

  let today = 0;
  let week = 0;
  let month = 0;
  let total = 0;

  const daySet = new Set();
  const perDaySeconds = new Map();
  const attemptsByLessonFromLogs = new Map();

  logs.forEach((log) => {
    const created = toDate(log.createdAt);
    if (!created || Number.isNaN(created.getTime())) return;

    const dayKey = getDateKeyInTz(created);
    const seconds = Math.max(0, Number(log.durationSeconds) || 0);

    total += seconds;
    if (dayKey === todayKey) today += seconds;
    if (dayKey >= mondayKey) week += seconds;
    if (dayKey.startsWith(monthPrefix)) month += seconds;

    daySet.add(dayKey);
    perDaySeconds.set(dayKey, (perDaySeconds.get(dayKey) || 0) + seconds);
    attemptsByLessonFromLogs.set(log.lessonId, (attemptsByLessonFromLogs.get(log.lessonId) || 0) + 1);
  });

  const dictationAttempts = lessons.reduce((sum, lesson) => sum + (Number(lesson.dictationCount) || 0), 0);
  const shadowingAttempts = lessons.reduce((sum, lesson) => sum + (Number(lesson.shadowingCount) || 0), 0);

  let streak = 0;
  let cursor = { ...nowParts };
  while (daySet.has(`${cursor.year}-${String(cursor.month).padStart(2, '0')}-${String(cursor.day).padStart(2, '0')}`)) {
    streak += 1;
    cursor = addDaysInTz(cursor, -1);
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
    };
  });

  const topLessons = [...lessons]
    .map((lesson) => {
      const dictationCount = Number(lesson.dictationCount) || 0;
      const shadowingCount = Number(lesson.shadowingCount) || 0;
      const attempts = dictationCount + shadowingCount;
      return {
        lessonId: lesson.id,
        title: lesson.title || 'Untitled lesson',
        attempts,
        dictationCount,
        shadowingCount,
        totalStudySeconds: Number(lesson.totalStudySeconds) || 0,
        logAttempts: attemptsByLessonFromLogs.get(lesson.id) || 0,
      };
    })
    .sort((a, b) => b.attempts - a.attempts || b.totalStudySeconds - a.totalStudySeconds)
    .slice(0, 5);

  const lessonTitleById = new Map(lessons.map((lesson) => [lesson.id, lesson.title || 'Untitled lesson']));

  const recentLogs = [...logs].slice(0, 10).map((log) => ({
    ...log,
    lessonTitle: lessonTitleById.get(log.lessonId) || 'Deleted lesson',
    trainingTypeLabel: normalizeTrainingType(log.trainingType),
  }));

  return {
    summary: {
      today,
      week,
      month,
      total,
      streak,
      dictationAttempts,
      shadowingAttempts,
    },
    last7Days,
    practiceBalance: [
      { label: 'Dictation', value: dictationAttempts },
      { label: 'Shadowing', value: shadowingAttempts },
    ],
    topLessons,
    recentLogs,
  };
};

const MetricCard = ({ label, value }) => (
  <article className="card dashboard-summary-card">
    <p className="dashboard-card-label">{label}</p>
    <p className="dashboard-card-value">{value}</p>
  </article>
);

const SimpleBarChart = ({ title, data, valueKey, emptyText, valueSuffix = '' }) => {
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
            return (
              <div className="simple-bar-row" key={item.label}>
                <p className="simple-bar-label">{item.label}</p>
                <div className="simple-bar-track">
                  <div className="simple-bar-fill" style={{ width: `${percent}%` }} />
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

export default function StatsPage() {
  const [logs, setLogs] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoadError('');
        const [loadedLogs, loadedLessons] = await Promise.all([
          fetchStudyLogs(LOCAL_USER_ID),
          fetchLessons(LOCAL_USER_ID),
        ]);

        if (!active) return;
        setLogs(loadedLogs);
        setLessons(loadedLessons);
      } catch (error) {
        if (!active) return;
        setLoadError('Failed to load dashboard data.');
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const dashboard = useMemo(() => buildDashboardData(lessons, logs), [lessons, logs]);

  const summaryCards = [
    { label: 'Today', value: formatDurationCompact(dashboard.summary.today) },
    { label: 'This Week', value: formatDurationCompact(dashboard.summary.week) },
    { label: 'This Month', value: formatDurationCompact(dashboard.summary.month) },
    { label: 'Total', value: formatDurationCompact(dashboard.summary.total) },
    { label: 'Study Streak', value: `${dashboard.summary.streak} days` },
    { label: 'Dictation Attempts', value: dashboard.summary.dictationAttempts },
    { label: 'Shadowing Attempts', value: dashboard.summary.shadowingAttempts },
  ];

  return (
    <section className="stack dashboard-page">
      <h2 className="section-title">Study Dashboard</h2>
      {loadError ? <p className="error">{loadError}</p> : null}

      <section className="dashboard-summary-grid" aria-label="Summary cards">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} label={card.label} value={card.value} />
        ))}
      </section>

      <section className="dashboard-chart-grid">
        <SimpleBarChart
          title="Study Time - Last 7 Days"
          data={dashboard.last7Days}
          valueKey="minutes"
          valueSuffix="m"
          emptyText="No study logs yet. Start a lesson to see your progress."
        />

        <SimpleBarChart
          title="Practice Balance"
          data={dashboard.practiceBalance}
          valueKey="value"
          emptyText="No practice attempts yet."
        />
      </section>

      <article className="card">
        <h3>Top Lessons</h3>
        {dashboard.topLessons.length === 0 ? (
          <p className="section-subtle">No lessons yet.</p>
        ) : (
          <ol className="dashboard-list">
            {dashboard.topLessons.map((lesson) => (
              <li className="dashboard-list-item" key={lesson.lessonId}>
                <p className="dashboard-list-title">{lesson.title}</p>
                <p className="section-subtle">
                  {lesson.attempts} attempts · {formatDurationCompact(lesson.totalStudySeconds)}
                </p>
                <p className="section-subtle">
                  Dictation {lesson.dictationCount} · Shadowing {lesson.shadowingCount}
                </p>
              </li>
            ))}
          </ol>
        )}
      </article>

      <article className="card">
        <h3>Recent Study Logs</h3>
        {dashboard.recentLogs.length === 0 ? (
          <p className="section-subtle">No study logs yet. Start a lesson to see your progress.</p>
        ) : (
          <ul className="dashboard-list">
            {dashboard.recentLogs.map((log) => (
              <li className="dashboard-list-item" key={log.id}>
                <p className="dashboard-list-title">{formatDateTime(log.createdAt)}</p>
                <p className="section-subtle">
                  {log.lessonTitle} · {log.trainingTypeLabel} · {formatSeconds(log.durationSeconds)}
                </p>
                <Link className="section-subtle" to={`/lessons/${log.lessonId}`}>
                  Open lesson
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
