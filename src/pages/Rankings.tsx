import React, { useState, useEffect } from 'react';
import '../styles/Rankings.css';
import { Results, UserData } from '@/types/index';
import { ProblemResult } from '@/types/index';
import { difficultyToJapanese, DifficultyRank, japaneseToDifficulty } from '@/types/difficulty';
import { GRADE_OPTIONS } from '@/types/grades';
import { rankingAPI } from '../api/index';

interface RankingsProps {
  results?: Results;
}

interface RankingItem {
  totalProblems: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unanswered: number;
  totalTime: number;
  timeSpent: number;
  grade?: string | number;
  problems?: ProblemResult[];
  score: number;
  difficulty: DifficultyRank;
  timestamp?: string;
  username?: string;
  calculatedRank?: number;
  rank?: number;
}

// ユーザーデータを取得するヘルパー関数
const getUserData = (): UserData | null => {
  try {
    // 複数の可能性のあるキー名を確認
    const possibleKeys = ['userData', 'user', 'currentUser'];
    
    for (const key of possibleKeys) {
      const userDataString = localStorage.getItem(key);
      if (userDataString) {
        try {
          const data = JSON.parse(userDataString);
          console.log(`ユーザーデータが見つかりました: ${key}`, data);
          return data;
        } catch (e) {
          console.error(`キー ${key} のユーザーデータの解析に失敗しました:`, e);
        }
      }
    }
    
    // デバッグ: すべてのキーを表示
    console.log('利用可能なすべてのキー:', Object.keys(localStorage));
    return null;
  } catch (error) {
    console.error('Failed to get user data:', error);
    return null;
  }
};

export const Rankings: React.FC<RankingsProps> = ({ results }) => {
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>(() => {
    const savedDifficulty = localStorage.getItem('selectedDifficultyFromResults');
    return (savedDifficulty as DifficultyRank) || 'beginner';
  });
  const [currentUser, setCurrentUser] = useState<UserData | null>(getUserData());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchRankings = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // APIからランキングデータを取得 (難易度で絞り込み)
        const response = await rankingAPI.getDaily(20, selectedDifficulty);
        console.log('ランキングデータ取得:', response);
        
        if (response.success && response.data && response.data.rankings) {
          setRankings(response.data.rankings.map((item: any) => ({
            difficulty: selectedDifficulty,
            timestamp: new Date().toISOString(),
            correctAnswers: item.correctAnswers || 0,
            totalProblems: item.totalProblems || 10,
            timeSpent: item.timeSpent || 0,
            username: item.username || 'ゲスト',
            grade: item.grade || '不明',
            incorrectAnswers: item.incorrectAnswers || 0,
            unanswered: 0,
            totalTime: item.totalTime || item.timeSpent * 1000,
            score: item.score || 0,
            rank: item.rank,
            problems: []
          })));
        } else {
          // データ形式が予想と異なる場合の対応
          console.error('ランキングデータの形式が不正です:', response);
          setError('ランキングデータの形式が不正です');
          setRankings([]);
        }
      } catch (err) {
        console.error('ランキング取得エラー:', err);
        setError('ランキングの取得に失敗しました');
        setRankings([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRankings();
  }, [selectedDifficulty]);

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

  // 学年の表示処理を改善
  const formatGrade = (grade: string | number | undefined): string => {
    if (grade === undefined || grade === null || grade === '') return '不明'; // 空文字列も不明扱い
    
    const gradeStr = String(grade); // 文字列に変換して処理

    // 数値または数値文字列 (小1～小6) の場合は「〜年生」の形式にフォーマット
    if (/^[1-6]$/.test(gradeStr)) {
      return `小${gradeStr}年生`;
    }
    
    // GRADE_OPTIONS からラベルを探す (中学生、高校生など)
    const option = GRADE_OPTIONS.find(opt => opt.value === gradeStr);
    if (option) {
      return option.label;
    }
    
    // その他の場合はそのまま文字列として返す (予期しない値)
    return gradeStr;
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
                <div className="grade-column">{formatGrade(ranking.grade)}</div>
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