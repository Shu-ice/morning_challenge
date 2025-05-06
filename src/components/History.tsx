import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../api';

interface HistoryItem {
  date: string;
  difficulty: string;
  timeSpent: number;
  rank: number;
}

interface HistoryResponse {
  success: boolean;
  history: HistoryItem[];
  currentStreak: number;
  maxStreak: number;
}

export const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await api.getHistory();
        console.log('履歴データ:', response);
        setHistory(response.history || []);
        setCurrentStreak(response.currentStreak || 0);
        setMaxStreak(response.maxStreak || 0);
        setError(null);
      } catch (err) {
        setError('履歴の取得に失敗しました');
        console.error('履歴取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const formatTime = (seconds: number) => {
    return seconds.toFixed(2);
  };

  const getDifficultyName = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初級';
      case 'intermediate': return '中級';
      case 'advanced': return '上級';
      case 'expert': return '超級';
      default: return difficulty;
    }
  };

  if (loading) {
    return <div className="text-center p-4">読み込み中...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">{error}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-bold mb-4">連続記録</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">現在の連続記録</p>
            <p className="text-2xl font-bold text-blue-600">{currentStreak}日</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">自己最高連続記録</p>
            <p className="text-2xl font-bold text-green-600">{maxStreak}日</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <h2 className="text-xl font-bold p-4 border-b">解答履歴</h2>
        {history.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            まだ履歴がありません
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">日付</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">難易度</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">タイム</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">順位</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {format(new Date(item.date), 'M月d日 (E)', { locale: ja })}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {getDifficultyName(item.difficulty)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {formatTime(item.timeSpent)}秒
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {item.rank}位
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}; 