import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeProps } from '../types/components';
import { DIFFICULTY_LABELS, DifficultyRank, DIFFICULTY_COLORS, DIFFICULTY_INFO } from '../types/difficulty';
import '../styles/Home.css';

const Home: React.FC<HomeProps> = ({ onStartPractice, isTimeValid, defaultDifficulty }) => {
  const { user } = useAuth();
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>(defaultDifficulty);

  const getDifficultyInfo = (difficulty: DifficultyRank) => {
    return DIFFICULTY_INFO[difficulty];
  };

  const handleDifficultySelect = (difficulty: DifficultyRank) => {
    setSelectedDifficulty(difficulty);
  };

  const handleStartChallenge = () => {
    if (selectedDifficulty) {
      onStartPractice(selectedDifficulty);
    }
  };

  if (!isTimeValid) {
    return (
      <div className="home-container">
        <div className="time-notice">
          <div className="time-icon">⏰</div>
          <div>
            <h3>
              <ruby>現在<rt>げんざい</rt></ruby>は<ruby>練習時間外<rt>れんしゅうじかんがい</rt></ruby>です
            </h3>
            <p>
              <ruby>練習時間<rt>れんしゅうじかん</rt></ruby>は<ruby>朝<rt>あさ</rt></ruby>6:30から8:00までです。<br/>
              また明日の朝にお会いしましょう
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="home-container">
      {/* ヒーローセクション */}
      <section className="hero-section">
        <h1>
          <ruby>朝<rt>あさ</rt></ruby>の<ruby>計算<rt>けいさん</rt></ruby>チャレンジ
        </h1>
        <p className="hero-subtitle">
          おはようございます、{user?.username}さん！
        </p>
        <p>
          <ruby>今日<rt>きょう</rt></ruby>も<ruby>一緒<rt>いっしょ</rt></ruby>に<ruby>頑張<rt>がんば</rt></ruby>りましょう
        </p>
        <div className="motivation-badge">
          <ruby>毎日<rt>まいにち</rt></ruby>の<ruby>積<rt>つ</rt></ruby>み<ruby>重<rt>かさ</rt></ruby>ねが<ruby>力<rt>ちから</rt></ruby>になります
        </div>
      </section>

      {/* ルール説明セクション */}
      <section className="rules-section" style={{ margin: '0.5rem auto', width: '100%', maxWidth: '820px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #F5F7FA 0%, #E2E8F0 100%)',
          borderRadius: '16px',
          padding: '1.5rem 2rem',
          boxShadow: '0 6px 14px rgba(0,0,0,0.08)',
          border: '1px solid #ECEFF5'
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            チャレンジルール
          </h2>
          <ul style={{ listStyle: 'none', paddingLeft: 0, lineHeight: 1.7, color: '#333' }}>
            <li>⏰ チャレンジ<ruby>可能<rt>かのう</rt></ruby><ruby>時間<rt>じかん</rt></ruby>は <strong><ruby>朝<rt>あさ</rt></ruby> 6:30–8:00</strong> だけ！</li>
            <li>🏅 1 <ruby>日<rt>にち</rt></ruby>につき <strong>チャレンジは 1 <ruby>回<rt>かい</rt></ruby></strong> <ruby>限<rt>かぎ</rt></ruby>りです。</li>
            <li>📈 <ruby>回答<rt>かいとう</rt></ruby>を<ruby>送信<rt>そうしん</rt></ruby>すると<ruby>結果<rt>けっか</rt></ruby>が<ruby>保存<rt>ほぞん</rt></ruby>され、<ruby>その日<rt>そのひ</rt></ruby>の<ruby>間<rt>あいだ</rt></ruby>は<ruby>再挑戦<rt>さいちょうせん</rt></ruby>できません。</li>
          </ul>
        </div>
      </section>

      {/* チャレンジ開始カード */}
      <div className="start-challenge-card">
        <div className="grade-selector">
          <h3>
            <ruby>難易度<rt>なんいど</rt></ruby>を<ruby>選択<rt>せんたく</rt></ruby>してください
          </h3>
          
          <div className="difficulty-options">
            {(Object.keys(DIFFICULTY_LABELS) as DifficultyRank[]).map((difficulty) => {
              const info = getDifficultyInfo(difficulty);
              return (
                <div 
                  key={difficulty}
                  onClick={() => handleDifficultySelect(difficulty)}
                  className={`difficulty-card ${selectedDifficulty === difficulty ? 'selected' : ''}`}
                >
                  <div className="difficulty-title">
                    <span className="difficulty-emoji">
                      {difficulty === 'beginner' ? '🟢' : 
                       difficulty === 'intermediate' ? '🟡' : '🔴'}
                    </span>
                    <ruby>{info.title}<rt>{info.reading}</rt></ruby>
                  </div>
                  
                  <div className="difficulty-description">
                    {info.description}
                  </div>

                  <div className="difficulty-details">
                    {info.problems}
                  </div>
                  
                  <div className="difficulty-details">
                    {info.recommendation}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <button 
          onClick={handleStartChallenge}
          className={`start-button ${!selectedDifficulty ? 'disabled' : ''}`}
          disabled={!selectedDifficulty}
        >
          🚀 <ruby>始<rt>はじ</rt></ruby>める
        </button>
        
        <div className="time-info">
          ⏱️ <ruby>制限時間<rt>せいげんじかん</rt></ruby>: 10<ruby>分<rt>ふん</rt></ruby>
        </div>
      </div>

      {/* 機能紹介セクション */}
      <section className="features-section">
        <h2>✨ <ruby>機能<rt>きのう</rt></ruby></h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3><ruby>成績<rt>せいせき</rt></ruby>トラッキング</h3>
            <p>あなたの<ruby>進歩<rt>しんぽ</rt></ruby>を<ruby>記録<rt>きろく</rt></ruby>し、<ruby>成長<rt>せいちょう</rt></ruby>を<ruby>可視化<rt>かしか</rt></ruby>します</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🏆</div>
            <h3>ランキング</h3>
            <p><ruby>他<rt>ほか</rt></ruby>の<ruby>学習者<rt>がくしゅうしゃ</rt></ruby>と<ruby>競争<rt>きょうそう</rt></ruby>して<ruby>モチベーション<rt>もちべーしょん</rt></ruby>を<ruby>保<rt>たも</rt></ruby>ちましょう</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3><ruby>個人<rt>こじん</rt></ruby>カスタマイズ</h3>
            <p>あなたの<ruby>レベル<rt>れべる</rt></ruby>に<ruby>合<rt>あ</rt></ruby>わせた<ruby>問題<rt>もんだい</rt></ruby>を<ruby>提供<rt>ていきょう</rt></ruby>します</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📈</div>
            <h3><ruby>継続<rt>けいぞく</rt></ruby>サポート</h3>
            <p><ruby>毎日<rt>まいにち</rt></ruby>の<ruby>練習<rt>れんしゅう</rt></ruby>で<ruby>計算<rt>けいさん</rt></ruby><ruby>力<rt>りょく</rt></ruby>を<ruby>向上<rt>こうじょう</rt></ruby>させましょう</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;