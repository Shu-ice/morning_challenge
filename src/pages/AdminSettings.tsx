import React, { useState, useEffect } from 'react';
import { DifficultyRank, difficultyToJapanese } from '@/types/difficulty';
import '../styles/AdminSettings.css';

// 計算タイプの設定インターフェース
interface OperationSettings {
  enabled: boolean;
  minDigits: number; // 最小桁数（第一オペランド）
  maxDigits: number; // 最大桁数（第一オペランド）
  minDigits2?: number; // 最小桁数（第二オペランド）
  maxDigits2?: number; // 最大桁数（第二オペランド）
  decimalEnabled?: boolean; // 小数を有効にするかどうか
  decimalPlaces?: number; // 小数点以下の桁数（小数の場合のみ）
}

// 難易度ごとの設定インターフェース
interface DifficultySettings {
  addition: OperationSettings;
  subtraction: OperationSettings;
  multiplication: OperationSettings;
  division: OperationSettings;
  decimal: OperationSettings; // 旧式の小数設定（後方互換性のため残す）
  termsCount: number; // 計算の項の数（2～5）
  useBrackets: boolean; // 難易度ごとに括弧の使用を設定
  maxAnswerDecimalPlaces: number; // 答えの最大小数点以下桁数
}

// すべての難易度の設定
interface ProblemSettings {
  beginner: DifficultySettings;
  intermediate: DifficultySettings;
  advanced: DifficultySettings;
  expert: DifficultySettings;
}

// デフォルト設定
const defaultSettings: ProblemSettings = {
  beginner: {
    addition: { enabled: true, minDigits: 1, maxDigits: 1, minDigits2: 1, maxDigits2: 1, decimalEnabled: false },
    subtraction: { enabled: true, minDigits: 1, maxDigits: 1, minDigits2: 1, maxDigits2: 1, decimalEnabled: false },
    multiplication: { enabled: false, minDigits: 1, maxDigits: 1, minDigits2: 1, maxDigits2: 1, decimalEnabled: false },
    division: { enabled: false, minDigits: 1, maxDigits: 1, minDigits2: 1, maxDigits2: 1, decimalEnabled: false },
    decimal: { enabled: false, minDigits: 1, maxDigits: 1, decimalPlaces: 1 },
    termsCount: 2,
    useBrackets: false, // デフォルトは括弧なし
    maxAnswerDecimalPlaces: 2, // デフォルトは2桁
  },
  intermediate: {
    addition: { enabled: true, minDigits: 1, maxDigits: 2, minDigits2: 1, maxDigits2: 2, decimalEnabled: false },
    subtraction: { enabled: true, minDigits: 1, maxDigits: 2, minDigits2: 1, maxDigits2: 2, decimalEnabled: false },
    multiplication: { enabled: true, minDigits: 1, maxDigits: 1, minDigits2: 1, maxDigits2: 1, decimalEnabled: false },
    division: { enabled: true, minDigits: 1, maxDigits: 1, minDigits2: 1, maxDigits2: 1, decimalEnabled: false },
    decimal: { enabled: false, minDigits: 1, maxDigits: 1, decimalPlaces: 1 },
    termsCount: 2,
    useBrackets: false,
    maxAnswerDecimalPlaces: 2,
  },
  advanced: {
    addition: { enabled: true, minDigits: 2, maxDigits: 2, minDigits2: 2, maxDigits2: 2, decimalEnabled: false },
    subtraction: { enabled: true, minDigits: 2, maxDigits: 2, minDigits2: 2, maxDigits2: 2, decimalEnabled: false },
    multiplication: { enabled: true, minDigits: 1, maxDigits: 2, minDigits2: 1, maxDigits2: 2, decimalEnabled: false },
    division: { enabled: true, minDigits: 1, maxDigits: 2, minDigits2: 1, maxDigits2: 2, decimalEnabled: false },
    decimal: { enabled: true, minDigits: 1, maxDigits: 2, decimalPlaces: 1 },
    termsCount: 2,
    useBrackets: true, // 上級はデフォルトで括弧あり
    maxAnswerDecimalPlaces: 2,
  },
  expert: {
    addition: { enabled: true, minDigits: 2, maxDigits: 3, minDigits2: 2, maxDigits2: 3, decimalEnabled: false },
    subtraction: { enabled: true, minDigits: 2, maxDigits: 3, minDigits2: 2, maxDigits2: 3, decimalEnabled: false },
    multiplication: { enabled: true, minDigits: 2, maxDigits: 2, minDigits2: 2, maxDigits2: 2, decimalEnabled: false },
    division: { enabled: true, minDigits: 2, maxDigits: 2, minDigits2: 2, maxDigits2: 2, decimalEnabled: false },
    decimal: { enabled: true, minDigits: 1, maxDigits: 2, decimalPlaces: 2 },
    termsCount: 3,
    useBrackets: true, // 超級もデフォルトで括弧あり
    maxAnswerDecimalPlaces: 3, // 超級は3桁まで
  }
};

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<ProblemSettings>(defaultSettings);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyRank>('beginner');
  const [saveStatus, setSaveStatus] = useState<string>('');

  // 現在選択されている難易度の設定
  const currentSettings = settings[selectedDifficulty] || defaultSettings[selectedDifficulty];

  // 設定の読み込み (useBracketsとmaxAnswerDecimalPlacesもマージ)
  useEffect(() => {
    const savedSettings = localStorage.getItem('problemSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        const mergedSettings = { ...defaultSettings };
        for (const diff of Object.keys(defaultSettings) as DifficultyRank[]) {
          if (parsedSettings[diff]) {
             mergedSettings[diff] = { ...defaultSettings[diff] };
             
             if (parsedSettings[diff].termsCount !== undefined) {
               mergedSettings[diff].termsCount = parsedSettings[diff].termsCount;
             }
             // 括弧設定のマージ
             if (parsedSettings[diff].useBrackets !== undefined) {
               mergedSettings[diff].useBrackets = parsedSettings[diff].useBrackets;
             }
             // 答えの小数点以下桁数設定のマージ
             if (parsedSettings[diff].maxAnswerDecimalPlaces !== undefined) {
               mergedSettings[diff].maxAnswerDecimalPlaces = parsedSettings[diff].maxAnswerDecimalPlaces;
             }

             for (const op of Object.keys(defaultSettings[diff]) as (keyof DifficultySettings)[]) {
               if (op === 'termsCount' || op === 'useBrackets' || op === 'maxAnswerDecimalPlaces') continue; 
               
               if (parsedSettings[diff][op]) {
                  const parsedOp = parsedSettings[diff][op];
                  // 旧useBracketsを削除
                  if (parsedOp.useBrackets !== undefined) delete parsedOp.useBrackets;

                  mergedSettings[diff][op] = {
                     ...defaultSettings[diff][op],
                     ...parsedOp,
                     minDigits: parsedOp.minDigits !== undefined ? parsedOp.minDigits : (parsedOp.digits || defaultSettings[diff][op].minDigits),
                     maxDigits: parsedOp.maxDigits !== undefined ? parsedOp.maxDigits : (parsedOp.digits || defaultSettings[diff][op].maxDigits)
                  };
               } else {
                  mergedSettings[diff][op] = defaultSettings[diff][op];
               }
             }
          } else {
             mergedSettings[diff] = defaultSettings[diff];
          }
        }
        setSettings(mergedSettings);
      } catch (error) {
        console.error('設定の読み込みまたはマージに失敗しました:', error);
        setSettings(defaultSettings);
      }
    }
  }, []);

  // 設定の保存
  const saveSettings = () => {
    try {
      localStorage.setItem('problemSettings', JSON.stringify(settings));
      setSaveStatus('設定を保存しました！');
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);
    } catch (error) {
      console.error('設定の保存に失敗しました:', error);
      setSaveStatus('設定の保存に失敗しました');
    }
  };

  // リセット
  const resetSettings = () => {
    if (window.confirm('設定をデフォルトに戻しますか？')) {
      setSettings(defaultSettings);
      setSaveStatus('設定をリセットしました');
      setTimeout(() => {
        setSaveStatus('');
      }, 3000);
    }
  };

  // 設定の更新ハンドラ
  const handleToggleOperation = (
    difficulty: DifficultyRank,
    operation: keyof DifficultySettings
  ) => {
    setSettings(prev => {
      const diffSettings = prev[difficulty] || defaultSettings[difficulty];
      const opSettings = diffSettings[operation] as OperationSettings;
      
      return {
        ...prev,
        [difficulty]: {
          ...diffSettings,
          [operation]: {
            ...opSettings,
            enabled: !opSettings.enabled
          }
        }
      };
    });
  };

  // 桁数ドロップダウンの変更ハンドラ (共通化)
  const handleDigitChange = (
    difficulty: DifficultyRank,
    operation: keyof DifficultySettings,
    type: 'min' | 'max',
    operand: 1 | 2, // 1: 第一オペランド, 2: 第二オペランド
    value: number
  ) => {
    // NaNチェックを追加
    if (isNaN(value)) {
      value = 1; // 不正な値の場合は1にフォールバック
    }
    
    setSettings(prev => {
      // prev[difficulty] や prev[difficulty][operation] が存在しないケースを考慮
      const currentDiffSettings = prev[difficulty] || defaultSettings[difficulty];
      const currentOpSettings = currentDiffSettings[operation] as OperationSettings;
      
      // 第一オペランドの場合
      if (operand === 1) {
        let newMin = type === 'min' ? value : currentOpSettings.minDigits;
        let newMax = type === 'max' ? value : currentOpSettings.maxDigits;
        
        // min <= max の制約を維持
        if (type === 'min' && value > newMax) {
          newMax = value;
        }
        if (type === 'max' && value < newMin) {
          newMin = value;
        }
        
        // 最小値は1以上にする
        newMin = Math.max(1, newMin);
        newMax = Math.max(1, newMax);

        return {
          ...prev,
          [difficulty]: {
            ...currentDiffSettings,
            [operation]: {
              ...currentOpSettings,
              minDigits: newMin,
              maxDigits: newMax
            }
          }
        };
      } 
      // 第二オペランドの場合
      else {
        let newMin = type === 'min' ? value : (currentOpSettings.minDigits2 || currentOpSettings.minDigits);
        let newMax = type === 'max' ? value : (currentOpSettings.maxDigits2 || currentOpSettings.maxDigits);
        
        // min <= max の制約を維持
        if (type === 'min' && value > newMax) {
          newMax = value;
        }
        if (type === 'max' && value < newMin) {
          newMin = value;
        }
        
        // 最小値は1以上にする
        newMin = Math.max(1, newMin);
        newMax = Math.max(1, newMax);

        return {
          ...prev,
          [difficulty]: {
            ...currentDiffSettings,
            [operation]: {
              ...currentOpSettings,
              minDigits2: newMin,
              maxDigits2: newMax
            }
          }
        };
      }
    });
  };

  // 小数設定の変更ハンドラ
  const handleDecimalToggle = (
    difficulty: DifficultyRank,
    operation: keyof DifficultySettings
  ) => {
    setSettings(prev => {
      const currentDiffSettings = prev[difficulty] || defaultSettings[difficulty];
      const currentOpSettings = currentDiffSettings[operation] as OperationSettings;
      
      return {
        ...prev,
        [difficulty]: {
          ...currentDiffSettings,
          [operation]: {
            ...currentOpSettings,
            decimalEnabled: !currentOpSettings.decimalEnabled
          }
        }
      };
    });
  };

  // 小数点以下の桁数設定ハンドラ (難易度の decimal.decimalPlaces を更新)
  const handleDecimalPlacesChange = (
    difficulty: DifficultyRank,
    value: number
  ) => {
    if (isNaN(value) || value < 1) {
      value = 1;
    }
    
    setSettings(prev => {
      const currentDiffSettings = prev[difficulty] || defaultSettings[difficulty];
      
      return {
        ...prev,
        [difficulty]: {
          ...currentDiffSettings,
          decimal: {
            ...currentDiffSettings.decimal,
            decimalPlaces: value
          }
        }
      };
    });
  };

  // 項の数の変更ハンドラ (括弧との連動を解除)
  const handleTermsCountChange = (
    difficulty: DifficultyRank,
    value: number
  ) => {
    const termsCount = Math.max(2, Math.min(5, value)); // 2～5に制限
    setSettings(prev => ({
      ...prev,
      [difficulty]: {
        ...prev[difficulty],
        termsCount: termsCount
        // useBracketsは変更しない
      }
    }));
  };

  // 括弧の使用設定ハンドラ (難易度ごと)
  const handleGlobalBracketsToggle = (difficulty: DifficultyRank) => {
    setSettings(prev => ({
      ...prev,
      [difficulty]: {
        ...prev[difficulty],
        useBrackets: !prev[difficulty].useBrackets
      }
    }));
  };

  // 答えの最大小数点以下桁数の変更ハンドラ
  const handleMaxAnswerDecimalPlacesChange = (
    difficulty: DifficultyRank,
    value: number
  ) => {
    const places = Math.max(1, Math.min(5, value)); // 1～5に制限
    setSettings(prev => ({
      ...prev,
      [difficulty]: {
        ...prev[difficulty],
        maxAnswerDecimalPlaces: places
      }
    }));
  };

  // ドロップダウンのオプションを生成する関数
  const renderDigitOptions = (maxDigits: number) => {
    const options = [];
    for (let i = 1; i <= maxDigits; i++) {
      options.push(<option key={i} value={i}>{i}</option>);
    }
    return options;
  };

  // 足し算/引き算/掛け算/割り算 のレンダリング関数 (括弧トグルを削除)
  const renderOperationSettings = (op: keyof DifficultySettings) => {
    if (op === 'termsCount' || op === 'decimal' || op === 'useBrackets' || op === 'maxAnswerDecimalPlaces') return null;
    
    const opSettings = currentSettings[op] || defaultSettings[selectedDifficulty][op];
    const opNames = {
      addition: { name: 'たし算', first: 'たされる数', second: 'たす数' },
      subtraction: { name: 'ひき算', first: 'ひかれる数', second: 'ひく数' },
      multiplication: { name: 'かけ算', first: 'かけられる数', second: 'かける数' },
      division: { name: 'わり算', first: 'わられる数', second: 'わる数' }
    };
    
    const opInfo = opNames[op as keyof typeof opNames];
    if (!opInfo) return null;

    return (
      <div className="setting-card" key={`${selectedDifficulty}-${op}`}>
        <div className="setting-header">
          <h3>{opInfo.name}</h3>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={opSettings.enabled}
              onChange={() => handleToggleOperation(selectedDifficulty, op)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="setting-content">
          <div className="digit-range-field">
            <label>{opInfo.first}の桁数:</label>
            <div className="digit-range-inputs">
              <select
                value={opSettings.minDigits}
                onChange={(e) => handleDigitChange(selectedDifficulty, op, 'min', 1, parseInt(e.target.value))}
                disabled={!opSettings.enabled}
                className="digit-select"
              >
                {renderDigitOptions(5)}
              </select>
              <span className="digit-range-separator">〜</span>
              <select
                value={opSettings.maxDigits}
                onChange={(e) => handleDigitChange(selectedDifficulty, op, 'max', 1, parseInt(e.target.value))}
                disabled={!opSettings.enabled}
                className="digit-select"
              >
                {renderDigitOptions(5)}
              </select>
              <span className="digit-unit">けた</span>
            </div>
          </div>
          <div className="digit-range-field">
            <label>{opInfo.second}の桁数:</label>
            <div className="digit-range-inputs">
              <select
                value={opSettings.minDigits2 || opSettings.minDigits}
                onChange={(e) => handleDigitChange(selectedDifficulty, op, 'min', 2, parseInt(e.target.value))}
                disabled={!opSettings.enabled}
                className="digit-select"
              >
                {renderDigitOptions(5)}
              </select>
              <span className="digit-range-separator">〜</span>
              <select
                value={opSettings.maxDigits2 || opSettings.maxDigits}
                onChange={(e) => handleDigitChange(selectedDifficulty, op, 'max', 2, parseInt(e.target.value))}
                disabled={!opSettings.enabled}
                className="digit-select"
              >
                {renderDigitOptions(5)}
              </select>
              <span className="digit-unit">けた</span>
            </div>
          </div>
          <div className="setting-field">
            <label>小数を含む:</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={!!opSettings.decimalEnabled}
                onChange={() => handleDecimalToggle(selectedDifficulty, op)}
                disabled={!opSettings.enabled}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-settings-container">
      <h1 className="admin-title">問題設定</h1>
      
      <div className="difficulty-selector">
        <h2>難易度を選択</h2>
        <div className="difficulty-tabs">
          {(['beginner', 'intermediate', 'advanced', 'expert'] as DifficultyRank[]).map(difficulty => (
            <button
              key={difficulty}
              className={`difficulty-tab ${selectedDifficulty === difficulty ? 'active' : ''}`}
              onClick={() => setSelectedDifficulty(difficulty)}
            >
              {difficultyToJapanese(difficulty)}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-panel">
        <h2>{difficultyToJapanese(selectedDifficulty)}の設定</h2>
        
        {/* 項の数と括弧の設定をまとめる */}
        <div className="settings-section">
          <h3>計算の構造</h3>
           <div className="setting-item">
            <label>項の数：</label>
            <select
              value={currentSettings.termsCount}
              onChange={(e) => handleTermsCountChange(selectedDifficulty, parseInt(e.target.value))}
            >
              <option value="2">2項（例：a + b）</option>
              <option value="3">3項（例：a + b + c）</option>
              <option value="4">4項（例：a + b + c + d）</option>
              <option value="5">5項（例：a + b + c + d + e）</option>
            </select>
            <div className="help-text">問題に含まれる数値の数</div>
          </div>
          <div className="setting-item">
            <label>括弧を使用する:</label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={currentSettings.useBrackets}
                onChange={() => handleGlobalBracketsToggle(selectedDifficulty)}
                // 3項未満の場合は無効化してもよいが、設定自体は可能にする
                // disabled={currentSettings.termsCount < 3}
              />
              <span className="toggle-slider"></span>
            </label>
             <div className="help-text">3項以上の計算で括弧が使われる可能性があります</div>
          </div>
        </div>

         {/* 答えの小数点以下桁数の設定 */}
        <div className="settings-section">
          <h3>答えの形式</h3>
          <div className="setting-item">
            <label>答えの最大小数点以下桁数:</label>
            <select
              value={currentSettings.maxAnswerDecimalPlaces}
              onChange={(e) => handleMaxAnswerDecimalPlacesChange(selectedDifficulty, parseInt(e.target.value))}
            >
              <option value="1">1桁</option>
              <option value="2">2桁</option>
              <option value="3">3桁</option>
              <option value="4">4桁</option>
              <option value="5">5桁</option>
            </select>
            <div className="help-text">計算結果の小数点以下の最大桁数</div>
          </div>
        </div>

        <div className="settings-grid">
          {/* 四則演算の設定 */}
          {(['addition', 'subtraction', 'multiplication', 'division'] as const).map(op => 
            renderOperationSettings(op)
          )}

          {/* 小数点以下の桁数設定（全演算共通） */}
          <div className="setting-card" key={`${selectedDifficulty}-decimal-places`}>
            <div className="setting-header">
              <h3>小数点以下の桁数</h3>
            </div>
            <div className="setting-content">
              <div className="setting-field">
                <label>小数点以下の桁数:</label>
                <select
                  value={currentSettings.decimal.decimalPlaces || 1}
                  onChange={(e) => handleDecimalPlacesChange(selectedDifficulty, parseInt(e.target.value))}
                  className="digit-select"
                >
                  <option value={1}>1桁</option>
                  <option value={2}>2桁</option>
                  <option value={3}>3桁</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* 小数の設定 (レガシー) - 非表示 */}
          {false && (() => {
             const opSettings = currentSettings.decimal || defaultSettings[selectedDifficulty].decimal;
             return (
                <div className="setting-card" key={`${selectedDifficulty}-decimal`}>
                  <div className="setting-header">
                    <h3>小数</h3>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={opSettings.enabled}
                        onChange={() => handleToggleOperation(selectedDifficulty, 'decimal')}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="setting-content">
                    <div className="digit-range-field">
                      <label>整数の桁数範囲:</label>
                      <div className="digit-range-inputs">
                        <select
                          value={opSettings.minDigits}
                          onChange={(e) => handleDigitChange(selectedDifficulty, 'decimal', 'min', 1, parseInt(e.target.value))}
                          disabled={!opSettings.enabled}
                          className="digit-select"
                        >
                          {renderDigitOptions(3)}
                        </select>
                        <span className="digit-range-separator">〜</span>
                        <select
                          value={opSettings.maxDigits}
                          onChange={(e) => handleDigitChange(selectedDifficulty, 'decimal', 'max', 1, parseInt(e.target.value))}
                          disabled={!opSettings.enabled}
                          className="digit-select"
                        >
                          {renderDigitOptions(3)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="setting-field">
                      <label>小数点以下の桁数:</label>
                      <select
                        value={opSettings.decimalPlaces || 1}
                        onChange={(e) => handleDecimalPlacesChange(selectedDifficulty, parseInt(e.target.value))}
                        disabled={!opSettings.enabled}
                        className="digit-select"
                      >
                        <option value={1}>1桁</option>
                        <option value={2}>2桁</option>
                        <option value={3}>3桁</option>
                      </select>
                    </div>
                  </div>
                </div>
             );
          })()}
        </div>
        
        <div className="settings-actions">
          <button className="save-button" onClick={saveSettings}>設定を保存</button>
          <button className="reset-button" onClick={resetSettings}>デフォルトに戻す</button>
          {saveStatus && <p className="save-status">{saveStatus}</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings; 