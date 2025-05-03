import React, { useState, useEffect } from 'react';
import '../styles/Rankings.css';
import { Results, UserData } from '@/types';
import { difficultyToJapanese, DifficultyRank, japaneseToDifficulty } from '@/types/difficulty';

interface RankingsProps {
  results?: Results;
}

interface RankingItem extends Results {
  timestamp?: string;
  username?: string;
  grade?: string;
  calculatedRank?: number;
}

// ユーザーデータを取得するヘルパー関数
const getUserData = (): UserData | null => {
  try {
    const userDataString = localStorage.getItem('userData');
    return userDataString ? JSON.parse(userDataString) : null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

export const Rankings: React.FC<RankingsProps> = ({ results }) => {
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [currentUser, setCurrentUser] = useState<UserData | null>(getUserData());
  
  useEffect(() => {
    // ローカルストレージからランキングデータを取得
    const storedRankings = localStorage.getItem('rankings');
    if (storedRankings) {
      try {
        setRankings(JSON.parse(storedRankings));
      } catch (error) {
        console.error("Failed to load rankings:", error);
        setRankings([]);
      }
    }
    
    // 結果画面から指定された難易度を取得
    const difficultyFromResults = localStorage.getItem('selectedDifficultyFromResults');
    if (difficultyFromResults) {
      setSelectedDifficulty(difficultyFromResults as DifficultyRank);
      // 一度使用したら削除
      localStorage.removeItem('selectedDifficultyFromResults');
    } else if (results && results.difficulty) {
      // 直接結果から渡された難易度があれば使用
      setSelectedDifficulty(results.difficulty);
    }
  }, [results]);

  useEffect(() => {
    // 新しい結果をランキングに追加（resultsが存在する場合のみ）
    if (results) {
      const userData = getUserData();
      setCurrentUser(userData);
      
      const newRankingItem: RankingItem = {
        ...results,
        timestamp: new Date().toISOString(),
        username: userData?.username || '名無し',
        grade: userData?.grade || '不明'
      };
      
      // 既存のランキングに追加（重複チェックはしないが、同一タイムスタンプは避ける）
      setRankings(prevRankings => {
        const updated = [...prevRankings.filter(r => r.timestamp !== newRankingItem.timestamp), newRankingItem];
        
        // 難易度ごとにフィルタリング、ソート、上位保持
        const difficulties = ['beginner', 'intermediate', 'advanced', 'expert'];
        let finalRankings: RankingItem[] = [];
        difficulties.forEach(diff => {
          const diffRankings = updated
            .filter(r => r.difficulty === diff)
            .sort((a, b) => {
              if (a.correctAnswers !== b.correctAnswers) {
                return b.correctAnswers - a.correctAnswers;
              }
              return a.timeSpent - b.timeSpent;
            })
            .slice(0, 20); // 各難易度で上位20件
          finalRankings = [...finalRankings, ...diffRankings];
        });
        
        // ローカルストレージに保存
        localStorage.setItem('rankings', JSON.stringify(finalRankings));
        return finalRankings;
      });
    }
  }, [results]);

  // 難易度でフィルタリング
  const filteredRankings = rankings.filter(r => r && r.difficulty && r.difficulty === selectedDifficulty);

  // ランキング計算とソート
  const sortedRankings = filteredRankings
    .sort((a, b) => {
      if (a.correctAnswers !== b.correctAnswers) {
        return b.correctAnswers - a.correctAnswers;
      }
      return a.timeSpent - b.timeSpent;
    })
    .map((item, index) => ({
      ...item,
      calculatedRank: index + 1
    }));
  
  // 所要時間のフォーマット (秒単位で小数点以下2桁まで表示)
  const formatTimeSpent = (timeInSeconds: number) => {
    // 小数点以下が整数の場合も小数点以下2桁まで表示（四捨五入せず元の値を維持）
    return `${timeInSeconds.toFixed(2)}秒`;
  };

  return (
    <div className="rankings-container">
      <h1>ランキング</h1>
      
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="difficulty-select">難易度:</label>
          <select 
            id="difficulty-select"
            value={selectedDifficulty} 
            onChange={(e) => setSelectedDifficulty(e.target.value as DifficultyRank)}
            className="filter-select"
          >
            <option value="beginner">初級</option>
            <option value="intermediate">中級</option>
            <option value="advanced">上級</option>
            <option value="expert">超級</option>
          </select>
        </div>
      </div>
      
        <div className="rankings-list">
          <div className="rankings-header">
          <div>順位</div>
          <div>ユーザー</div>
          <div>学年</div>
          <div>正解数</div>
          <div>所要時間</div>
          </div>
          
        {sortedRankings.length > 0 ? (
          sortedRankings.map((ranking, index) => {
            // 現在のユーザーかどうかを判定
            const isCurrentUser = currentUser && ranking.username === currentUser.username;
            // クラス名を動的に設定
            const itemClassName = `ranking-item ${index < 3 ? `top-${index + 1}` : ''} ${isCurrentUser ? 'current-user-rank' : ''}`;

            return (
              <div 
                key={`${ranking.timestamp || index}-${ranking.username}`}
                className={itemClassName}
              >
                <div className="rank-column">{ranking.calculatedRank}</div>
                <div className="user-column">{ranking.username || '名無し'}</div>
                <div className="grade-column">{ranking.grade || '不明'}</div>
                <div className="score-column">{ranking.correctAnswers}/{ranking.totalProblems}</div>
                <div className="time-column">
                  {formatTimeSpent(ranking.timeSpent)}
                </div>
              </div>
            );
          })
        ) : (
          <div className="no-rankings">まだランキングデータがありません</div>
          )}
        </div>
    </div>
  );
};

export default Rankings;