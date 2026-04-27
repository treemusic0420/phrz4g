import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOCAL_USER_ID } from '../lib/auth';
import { fetchLessons, fetchStudyLogs } from '../lib/firestore';
import { formatDateTime, formatSeconds, toDate } from '../utils/format';

const startOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function StatsPage() {
  const [logs, setLogs] = useState([]);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    fetchStudyLogs(LOCAL_USER_ID).then(setLogs);
    fetchLessons(LOCAL_USER_ID).then(setLessons);
  }, [LOCAL_USER_ID]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0;
    let week = 0;
    let month = 0;
    let total = 0;
    let dictationCount = 0;
    let shadowingCount = 0;
    const daySet = new Set();
    const perLesson = {};

    logs.forEach((log) => {
      const created = toDate(log.createdAt) || new Date();
      const seconds = Number(log.durationSeconds) || 0;
      total += seconds;
      if (created >= todayStart) today += seconds;
      if (created >= weekStart) week += seconds;
      if (created >= monthStart) month += seconds;
      daySet.add(created.toISOString().slice(0, 10));
      if (log.trainingType === 'dictation') dictationCount += 1;
      if (log.trainingType === 'shadowing') shadowingCount += 1;
      perLesson[log.lessonId] = (perLesson[log.lessonId] || 0) + 1;
    });

    const sortedDays = Array.from(daySet).sort().reverse();
    let streak = 0;
    const cursor = new Date(todayStart);
    while (sortedDays.includes(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const lessonStudyCounts = lessons.map((lesson) => ({
      lessonId: lesson.id,
      title: lesson.title,
      count: perLesson[lesson.id] || 0,
    }));

    return { today, week, month, total, streak, dictationCount, shadowingCount, lessonStudyCounts };
  }, [lessons, logs]);

  return (
    <section className="stack">
      <h2 className="section-title">Study Time / History</h2>
      <article className="card">
        <p>Today: {formatSeconds(stats.today)}</p>
        <p>This week: {formatSeconds(stats.week)}</p>
        <p>This month: {formatSeconds(stats.month)}</p>
        <p>Total: {formatSeconds(stats.total)}</p>
        <p>Study streak: {stats.streak} days</p>
        <p>Dictation attempts: {stats.dictationCount}</p>
        <p>Shadowing attempts: {stats.shadowingCount}</p>
      </article>
      <article className="card">
        <h3>Attempts by Lesson</h3>
        {stats.lessonStudyCounts.map((row) => (
          <p key={row.lessonId}>{row.title}: {row.count}</p>
        ))}
      </article>
      <article className="card">
        <h3>Recent Study Logs</h3>
        {logs.slice(0, 20).map((log) => (
          <p key={log.id}>
            {formatDateTime(log.createdAt)} / {log.trainingType} / {formatSeconds(log.durationSeconds)} / 
            <Link to={`/lessons/${log.lessonId}`}>Go to lesson</Link>
          </p>
        ))}
      </article>
    </section>
  );
}
