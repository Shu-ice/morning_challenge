import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HomeProps } from '../types/components';
import { DIFFICULTY_LABELS, DifficultyRank, DIFFICULTY_COLORS, DIFFICULTY_INFO } from '../types/difficulty';
import '../styles/Home.css';

const Home: React.FC<HomeProps> = ({ onStartPractice, isTimeValid, defaultDifficulty }) => {
  const { user } = useAuth();

  const getDifficultyInfo = (difficulty: DifficultyRank) => {
    return DIFFICULTY_INFO[difficulty];
  };

  if (!isTimeValid) {
    return (
      <div className="home-container">
        <div className="time-restriction">
          <div className="time-restriction-content">
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
        <h1 className="home-title">
          <ruby>朝<rt>あさ</rt></ruby>の<ruby>計算<rt>けいさん</rt></ruby>チャレンジ
        </h1>
        <p className="welcome-message">
          おはようございます、{user?.username}さん！<br/>
          <ruby>今日<rt>きょう</rt></ruby>も<ruby>一緒<rt>いっしょ</rt></ruby>に<ruby>頑張<rt>がんば</rt></ruby>りましょう
        </p>
        <div className="motivation-badge">
          <ruby>毎日<rt>まいにち</rt></ruby>の<ruby>積<rt>つ</rt></ruby>み<ruby>重<rt>かさ</rt></ruby>ねが<ruby>力<rt>ちから</rt></ruby>になります
        </div>
      </section>

      {/* 難易度選択セクション */}
      <section className="difficulty-section">
        <h2 className="section-title">
          <ruby>難易度<rt>なんいど</rt></ruby>を<ruby>選択<rt>せんたく</rt></ruby>してください
        </h2>
        
        <div className="difficulty-grid">
          {(Object.keys(DIFFICULTY_LABELS) as DifficultyRank[]).map((difficulty) => {
            const info = getDifficultyInfo(difficulty);
            return (
              <div 
                key={difficulty}
                onClick={() => onStartPractice(difficulty)}
                className={`difficulty-card ${
                  defaultDifficulty === difficulty ? 'recommended' : ''
                }`}
                data-difficulty={difficulty}
              >
                <div className="difficulty-icon"></div>
                
                <h3 className="difficulty-title">
                  <ruby>{info.title}<rt>{info.reading}</rt></ruby>
                </h3>
                
                <p className="difficulty-description">
                  {info.description}
                </p>

                <p className="difficulty-problems">
                  {info.problems}
                </p>
                
                <div className="difficulty-recommendation">
                  {info.recommendation}
                </div>
                
                <div className="difficulty-arrow">
                  <ruby>始<rt>はじ</rt></ruby>める →
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Home;