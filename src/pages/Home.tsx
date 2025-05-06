import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { HomeProps } from '../types/components';
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS, DifficultyRank } from '../types/difficulty';

const Home: React.FC<HomeProps> = ({ onStartPractice, isTimeValid, defaultDifficulty }) => {
  const { user } = useAuth();

  if (!isTimeValid) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          現在は練習時間外です
        </h2>
        <p className="text-gray-600">
          練習時間は朝6:30から8:00までです。
        </p>
      </div>
    );
    }
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          朝の計算チャレンジ
        </h1>
        <p className="text-gray-600">
          {user?.username}さん、今日も頑張りましょう！
        </p>
          </div>
          
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(DIFFICULTY_LABELS) as DifficultyRank[]).map((difficulty) => (
          <button 
            key={difficulty}
            onClick={() => onStartPractice(difficulty)}
            className={`p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow ${
              DIFFICULTY_COLORS[difficulty]
            }`}
          >
            <h3 className="text-xl font-semibold mb-2">{DIFFICULTY_LABELS[difficulty]}</h3>
            <p className="text-sm opacity-75">
              {difficulty === 'beginner' && '基本的な計算問題'}
              {difficulty === 'intermediate' && '少し難しい計算問題'}
              {difficulty === 'advanced' && '高度な計算問題'}
              {difficulty === 'expert' && '最難関の計算問題'}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Home;