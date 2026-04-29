import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteStudyLogsByIds,
  fetchMonthlyStatsByMonthKeys,
  fetchStudyLogs,
  upsertMonthlyStat,
} from '../lib/firestore';
import { toDate } from '../utils/format';

const TZ = 'Asia/Tokyo';
const secondsToHoursLabel = (seconds = 0) => `${(Math.max(0, Number(seconds) || 0) / 3600).toFixed(1)}h`;
const toMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const parseMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return { year, month };
};
const prevMonth = ({ year, month }) => (month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 });
const getJstParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === 'year')?.value),
    month: Number(parts.find((p) => p.type === 'month')?.value),
    day: Number(parts.find((p) => p.type === 'day')?.value),
  };
};

const aggregateSeconds = (logs) => logs.reduce((sum, log) => sum + Math.max(0, Number(log.durationSeconds) || 0), 0);

export default function AnalyticsPage() {
  const { user } = useAuth();
  const userId = user?.uid || '';
  const [currentLogs, setCurrentLogs] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [closingPreview, setClosingPreview] = useState(null);
  const [closingStatus, setClosingStatus] = useState('idle');

  const nowParts = getJstParts(new Date());

  const monthKeysNeeded = useMemo(() => {
    const keys = [];
    for (let m = 1; m <= 12; m += 1) keys.push(toMonthKey(nowParts.year, m));
    keys.push(toMonthKey(nowParts.year - 1, nowParts.month));
    for (let m = 1; m <= nowParts.month; m += 1) keys.push(toMonthKey(nowParts.year - 1, m));
    keys.push(toMonthKey(prevMonth(nowParts).year, prevMonth(nowParts).month));
    return [...new Set(keys)];
  }, [nowParts.day, nowParts.month, nowParts.year]);

  const loadData = async () => {
    if (!userId) return;
    setStatus('loading');
    setError('');
    try {
      const [logs, stats] = await Promise.all([
        fetchStudyLogs(userId),
        fetchMonthlyStatsByMonthKeys(userId, monthKeysNeeded),
      ]);
      const thisMonthLogs = logs.filter((log) => {
        const created = toDate(log.createdAt);
        if (!created) return false;
        const parts = getJstParts(created);
        return parts.year === nowParts.year && parts.month === nowParts.month;
      });
      setCurrentLogs(thisMonthLogs);
      setMonthlyStats(stats);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError('Analytics data could not be loaded.');
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const statsMap = useMemo(() => new Map(monthlyStats.map((s) => [s.monthKey, s])), [monthlyStats]);
  const currentMonthSeconds = aggregateSeconds(currentLogs);
  const prevKey = toMonthKey(prevMonth(nowParts).year, prevMonth(nowParts).month);
  const prevMonthSeconds = Number(statsMap.get(prevKey)?.totalStudySeconds) || 0;
  const diffSeconds = currentMonthSeconds - prevMonthSeconds;
  const diffRate = prevMonthSeconds > 0 ? (diffSeconds / prevMonthSeconds) * 100 : 0;

  const weeklyData = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    currentLogs.forEach((log) => {
      const created = toDate(log.createdAt);
      if (!created) return;
      const day = getJstParts(created).day;
      const weekIdx = Math.min(4, Math.floor((day - 1) / 7));
      buckets[weekIdx] += Math.max(0, Number(log.durationSeconds) || 0);
    });
    return buckets.map((seconds, idx) => ({ label: `W${idx + 1}`, seconds }));
  }, [currentLogs]);

  const yearlyData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const key = toMonthKey(nowParts.year, month);
    const seconds = month === nowParts.month ? currentMonthSeconds : (Number(statsMap.get(key)?.totalStudySeconds) || 0);
    return { label: `${month}`, seconds };
  }), [statsMap, nowParts.month, nowParts.year, currentMonthSeconds]);

  const currentYtd = yearlyData.slice(0, nowParts.month).reduce((sum, m) => sum + m.seconds, 0);
  const lastYearSameMonth = Number(statsMap.get(toMonthKey(nowParts.year - 1, nowParts.month))?.totalStudySeconds) || 0;
  const lastYearYtd = Array.from({ length: nowParts.month }, (_, i) => Number(statsMap.get(toMonthKey(nowParts.year - 1, i + 1))?.totalStudySeconds) || 0).reduce((a, b) => a + b, 0);

  const prepareClosingPreview = async () => {
    setClosingStatus('loading');
    try {
      const oldLogsAll = await fetchStudyLogs(userId);
      const oldLogs = oldLogsAll.filter((log) => {
        const created = toDate(log.createdAt);
        if (!created) return false;
        const parts = getJstParts(created);
        if (parts.year < nowParts.year) return true;
        return parts.year === nowParts.year && parts.month < nowParts.month;
      });
      const byMonth = new Map();
      oldLogs.forEach((log) => {
        const created = toDate(log.createdAt);
        if (!created) return;
        const parts = getJstParts(created);
        const key = toMonthKey(parts.year, parts.month);
        const arr = byMonth.get(key) || [];
        arr.push(log);
        byMonth.set(key, arr);
      });
      const months = [...byMonth.keys()].sort();
      const preview = months.map((key) => ({ key, count: byMonth.get(key).length, seconds: aggregateSeconds(byMonth.get(key)) }));
      setClosingPreview({ months: preview, ids: oldLogs.map((l) => l.id), grouped: byMonth });
      setClosingStatus('ready');
    } catch (e) {
      setClosingStatus('error');
      setError('Analytics data could not be loaded.');
    }
  };

  const executeClosing = async () => {
    if (!closingPreview) return;
    setClosingStatus('running');
    try {
      for (const month of closingPreview.months) {
        const logs = closingPreview.grouped.get(month.key) || [];
        const first = parseMonthKey(month.key);
        await upsertMonthlyStat(userId, month.key, {
          year: first.year,
          month: first.month,
          totalStudySeconds: aggregateSeconds(logs),
          totalStudyMinutes: Math.round(aggregateSeconds(logs) / 60),
          studyDays: new Set(logs.map((log) => {
            const d = toDate(log.createdAt);
            const p = getJstParts(d);
            return `${p.year}-${p.month}-${p.day}`;
          })).size,
          closedAt: new Date(),
          sourceLogCount: logs.length,
        });
      }
      await deleteStudyLogsByIds(closingPreview.ids);
      setClosingStatus('success');
      setClosingPreview(null);
      await loadData();
    } catch (e) {
      setClosingStatus('error');
      setError('Analytics data could not be loaded.');
    }
  };

  return <section className="stack"><h2 className="section-title">Analytics</h2>
    {status === 'error' ? <p className="error">{error}</p> : null}
    <div className="analytics-grid">
      <article className="card"><h3>今月学習時間</h3><p>{secondsToHoursLabel(currentMonthSeconds)}</p></article>
      <article className="card"><h3>先月比</h3><p>{secondsToHoursLabel(diffSeconds)} ({diffRate.toFixed(1)}%)</p></article>
      <article className="card"><h3>今年累計</h3><p>{secondsToHoursLabel(currentYtd)}</p></article>
      <article className="card"><h3>前年同期間比</h3><p>{secondsToHoursLabel(currentYtd - lastYearYtd)}</p></article>
    </div>
    <article className="card"><h3>今月累計 vs 先月合計</h3><p>今月: {secondsToHoursLabel(currentMonthSeconds)} / 先月: {secondsToHoursLabel(prevMonthSeconds)} / 増減: {secondsToHoursLabel(diffSeconds)} ({diffRate.toFixed(1)}%)</p></article>
    <article className="card"><h3>当月 週別比較</h3>{weeklyData.map((w) => <div className="simple-bar-row" key={w.label}><p className="simple-bar-label">{w.label}</p><div className="simple-bar-track"><div className="simple-bar-fill simple-bar-fill-study-time" style={{ width: `${Math.max(5, (w.seconds / Math.max(...weeklyData.map((x) => x.seconds), 1)) * 100)}%` }} /></div><p className="simple-bar-value">{secondsToHoursLabel(w.seconds)}</p></div>)}</article>
    <article className="card"><h3>年間 月別比較</h3>{yearlyData.map((m) => <div className="simple-bar-row" key={m.label}><p className="simple-bar-label">{m.label}月</p><div className="simple-bar-track"><div className="simple-bar-fill simple-bar-fill-study-time" style={{ width: `${Math.max(5, (m.seconds / Math.max(...yearlyData.map((x) => x.seconds), 1)) * 100)}%` }} /></div><p className="simple-bar-value">{secondsToHoursLabel(m.seconds)}</p></div>)}</article>
    <article className="card"><h3>昨対比</h3><p>今年同月: {secondsToHoursLabel(currentMonthSeconds)} / 前年同月: {secondsToHoursLabel(lastYearSameMonth)}</p><p>今年累計: {secondsToHoursLabel(currentYtd)} / 前年同期間: {secondsToHoursLabel(lastYearYtd)}</p></article>
    <article className="card"><h3>月締め</h3>
      <button className="btn danger-ghost" type="button" onClick={prepareClosingPreview}>月締め対象を確認</button>
      {closingPreview ? <div className="stack" style={{ marginTop: 12 }}>
        {closingPreview.months.length === 0 ? <p>対象なし（前月以前のstudyLogsがありません）</p> : closingPreview.months.map((m) => {
          const exists = Boolean(statsMap.get(m.key));
          return <p key={m.key}>{m.key}: {m.count}件 / {secondsToHoursLabel(m.seconds)} {exists ? '（既存monthlyStatsあり: 上書き確認要）' : ''}</p>;
        })}
        {closingPreview.months.length > 0 ? <button className="btn" type="button" onClick={() => {
          if (window.confirm('monthlyStatsへ保存後に前月以前のstudyLogsを削除します。実行しますか？')) executeClosing();
        }}>月締めを実行</button> : null}
      </div> : null}
      {closingStatus === 'success' ? <p>月締め完了: monthlyStats保存確認後、前月以前のstudyLogsを削除しました。</p> : null}
    </article>
  </section>;
}
