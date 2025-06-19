import React, { useEffect, useState } from 'react';
import { API } from '@/api/index';
import '../../styles/AdminSettings.css';

const TimeWindowSettings: React.FC = () => {
  const [start, setStart] = useState('06:30');
  const [end, setEnd] = useState('08:00');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/admin/time-window');
        if (res.data?.success) {
          const { startMinutes, endMinutes } = res.data.data;
          const sH = Math.floor(startMinutes / 60)
            .toString()
            .padStart(2, '0');
          const sM = (startMinutes % 60).toString().padStart(2, '0');
          const eH = Math.floor(endMinutes / 60)
            .toString()
            .padStart(2, '0');
          const eM = (endMinutes % 60).toString().padStart(2, '0');
          setStart(`${sH}:${sM}`);
          setEnd(`${eH}:${eM}`);
        }
      } catch (err) {
        console.error('[TimeWindowSettings] fetch error', err);
        setStatus('設定取得に失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    try {
      setStatus('保存中...');
      await API.put('/admin/time-window', { start, end });
      setStatus('保存しました');
    } catch (err: any) {
      console.error('[TimeWindowSettings] save error', err);
      setStatus(err.response?.data?.message || '保存に失敗しました');
    }
  };

  if (loading) {
    return <div className="loading-fullscreen">読み込み中...</div>;
  }

  return (
    <div className="admin-settings-container">
      <h2>チャレンジ時間帯の設定</h2>

      <div className="time-window-form">
        <label>
          開始時刻:
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label style={{ marginLeft: '2rem' }}>
          終了時刻:
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>

      <button className="primary-btn" style={{ marginTop: '1.5rem' }} onClick={handleSave}>
        保存
      </button>

      {status && <p style={{ marginTop: '1rem' }}>{status}</p>}
    </div>
  );
};

export default TimeWindowSettings; 