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