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

const buildDashboardData = (lessons, logs, options = {}) => {
  const { canUseStudyLogs = true } = options;
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

  const daySet = new Set();
  const perDaySeconds = new Map();
  const attemptsByLessonFromLogs = new Map();

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

    total += seconds;
    if (dayKey === todayKey) today += seconds;
    if (dayKey >= mondayKey) week += seconds;
    if (dayKey.startsWith(monthPrefix)) month += seconds;

    daySet.add(dayKey);
    perDaySeconds.set(dayKey, (perDaySeconds.get(dayKey) || 0) + seconds);
    attemptsByLessonFromLogs.set(log.lessonId, (attemptsByLessonFromLogs.get(log.lessonId) || 0) + 1);
  });

  const lessonBasedTotal = lessons.reduce((sum, lesson) => sum + (Number(lesson.totalStudySeconds) || 0), 0);
  if (!shouldUseLogsSummary) {
    total = lessonBasedTotal;
    today = 0;
    week = 0;
    month = 0;
  }

  const dictationAttempts = lessons.reduce((sum, lesson) => sum + (Number(lesson.dictationCount) || 0), 0);
  const shadowingAttempts = lessons.reduce((sum, lesson) => sum + (Number(lesson.shadowingCount) || 0), 0);

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

  const recentLogs = sortedLogs.slice(0, 10).map((log) => ({
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

export default function StatsPage() {
  const [logs, setLogs] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [lessonsStatus, setLessonsStatus] = useState('idle');
  const [studyLogsStatus, setStudyLogsStatus] = useState('idle');
  const [lessonsError, setLessonsError] = useState('');
  const [studyLogsError, setStudyLogsError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLessonsStatus('loading');
      setStudyLogsStatus('loading');
      setLessonsError('');
      setStudyLogsError('');

      const [lessonsResult, logsResult] = await Promise.allSettled([
        fetchLessons(LOCAL_USER_ID),
        fetchStudyLogs(LOCAL_USER_ID),
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
        setStudyLogsError(logsResult.reason?.message || 'Unknown error');
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
      }),
    [lessons, logs, studyLogsStatus],
  );

  const summaryCards = [
    { label: 'Today', value: formatDurationCompact(dashboard.summary.today), tone: 'blue' },
    { label: 'This Week', value: formatDurationCompact(dashboard.summary.week), tone: 'indigo' },
    { label: 'This Month', value: formatDurationCompact(dashboard.summary.month), tone: 'purple' },
    { label: 'Total', value: formatDurationCompact(dashboard.summary.total), tone: 'gradient' },
    { label: 'Study Streak', value: `${dashboard.summary.streak} days`, tone: 'purple' },
    { label: 'Dictation Attempts', value: dashboard.summary.dictationAttempts, tone: 'blue' },
    { label: 'Shadowing Attempts', value: dashboard.summary.shadowingAttempts, tone: 'purple' },
  ];

  return (
    <section className="stack dashboard-page">
      <h2 className="section-title">Study Dashboard</h2>
      <details className="debug-panel">
        <summary>Debug Info</summary>
        <p>debug.userId: {LOCAL_USER_ID}</p>
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

        <SimpleBarChart
          title="Practice Balance"
          data={dashboard.practiceBalance}
          valueKey="value"
          variant="practiceBalance"
          emptyText="No practice attempts yet."
        />
      </section>

      <article className="card dashboard-top-lessons-card">
        <h3>Top Lessons</h3>
        {dashboard.topLessons.length === 0 ? (
          <p className="section-subtle">No lessons yet.</p>
        ) : (
          <ol className="dashboard-list">
            {dashboard.topLessons.map((lesson, index) => (
              <li className="dashboard-list-item" key={lesson.lessonId}>
                <div className="dashboard-list-head">
                  <span className="dashboard-rank-badge">#{index + 1}</span>
                  <p className="dashboard-list-title">{lesson.title}</p>
                  <span className="dashboard-attempts-badge">{lesson.attempts} attempts</span>
                </div>
                <p className="section-subtle">
                  {formatDurationCompact(lesson.totalStudySeconds)}
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
          <p className="section-subtle">No study logs yet.</p>
        ) : (
          <ul className="dashboard-list">
            {dashboard.recentLogs.map((log) => (
              <li className="dashboard-list-item" key={log.id}>
                <p className="dashboard-list-title">{formatDateTime(log.createdAt)}</p>
                <p className="section-subtle">
                  {log.lessonTitle} ·{' '}
                  <span
                    className={`training-type-badge ${
                      log.trainingType === 'shadowing' ? 'training-type-badge-shadowing' : 'training-type-badge-dictation'
                    }`}
                  >
                    {log.trainingTypeLabel}
                  </span>{' '}
                  · {formatSeconds(log.durationSeconds)}
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
