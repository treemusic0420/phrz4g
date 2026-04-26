import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    fetchStudyLogs(user.uid).then(setLogs);
    fetchLessons(user.uid).then(setLessons);
  }, [user.uid]);

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
      <h2>学習時間 / 履歴</h2>
      <article className="card">
        <p>今日: {formatSeconds(stats.today)}</p>
        <p>今週: {formatSeconds(stats.week)}</p>
        <p>今月: {formatSeconds(stats.month)}</p>
        <p>累計: {formatSeconds(stats.total)}</p>
        <p>連続学習日数: {stats.streak}日</p>
        <p>ディクテーション回数: {stats.dictationCount}</p>
        <p>シャドーイング回数: {stats.shadowingCount}</p>
      </article>
      <article className="card">
        <h3>教材別学習回数</h3>
        {stats.lessonStudyCounts.map((row) => (
          <p key={row.lessonId}>{row.title}: {row.count}回</p>
        ))}
      </article>
      <article className="card">
        <h3>最近の学習ログ</h3>
        {logs.slice(0, 20).map((log) => (
          <p key={log.id}>
            {formatDateTime(log.createdAt)} / {log.trainingType} / {formatSeconds(log.durationSeconds)} / 
            <Link to={`/lessons/${log.lessonId}`}>教材へ</Link>
          </p>
        ))}
      </article>
    </section>
  );
}
