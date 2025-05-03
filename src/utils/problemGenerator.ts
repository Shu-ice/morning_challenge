import { Problem } from '@/types';
import { DifficultyRank, difficultyToJapanese, japaneseToDifficulty } from '@/types/difficulty';

// シード付き乱数生成関数
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// 日付からシード値を生成
const getDateSeed = (): number => {
  const now = new Date();
  const dateString = `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed += dateString.charCodeAt(i);
  }
  return seed;
};

// 整数の乱数を生成
const getRandomInt = (min: number, max: number, seed: number): number => {
  const m = Math.max(min, max);
  const n = Math.min(min, max);
  const random = seededRandom(seed);
  return Math.floor(random * (m - n + 1)) + n;
};

// 小数の乱数を生成 (指定した小数点以下の桁数で丸める)
const getRandomFloat = (min: number, max: number, seed: number, decimals: number = 2): number => {
    const random = seededRandom(seed);
    const value = random * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};

// 演算子記号を返すヘルパー関数
const getOpSymbol = (opIndex: number): string => {
  const symbols = ['+', '-', '×', '÷'];
  return symbols[opIndex] || '+';
};

// --- 安全な計算ヘルパー関数 (演算子の優先順位を考慮) ---
const calculateAnswer = (nums: number[], ops: string[]): number | undefined => {
    if (nums.length !== ops.length + 1) {
        console.error("[calculateAnswer] Invalid input length", nums, ops);
        return undefined;
    }
    if (nums.some(isNaN) || nums.some(n => !Number.isFinite(n))) {
        console.error("[calculateAnswer] Invalid number input (NaN or Infinity)", nums);
        return undefined;
    }

    const numbers = [...nums];
    const operators = [...ops];

    // 1. 乗算と除算を処理
    for (let i = 0; i < operators.length; ) {
        if (operators[i] === '×' || operators[i] === '÷') {
            const left = numbers[i];
            const right = numbers[i + 1];
            let result: number;

            if (operators[i] === '×') {
                result = left * right;
            } else { // '÷'
                if (right === 0) {
                    console.error("[calculateAnswer] Division by zero attempted");
                    return undefined;
                }
                // 割り切れない場合も許容する (生成側で保証)
                result = left / right;
            }

            if (!Number.isFinite(result)) {
              console.error("[calculateAnswer] Calculation resulted in Infinity", left, operators[i], right);
              return undefined;
            }

            numbers.splice(i, 2, result);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }

    // 2. 加算と減算を処理 (左から右へ)
    let finalResult = numbers[0];
    for (let i = 0; i < operators.length; i++) {
        const right = numbers[i + 1];
        if (operators[i] === '+') {
            finalResult += right;
        } else { // '-'
            finalResult -= right;
        }
        if (!Number.isFinite(finalResult)) {
          console.error("[calculateAnswer] Calculation resulted in Infinity during +/-", finalResult, operators[i], right);
          return undefined;
        }
    }

    // 最終結果を返す (丸めは生成側で行うか、必要に応じて)
    return finalResult;
};

// generateOptions は変更なし (ただし、呼び出し元で answer が undefined でないことを確認)
// ... (generateOptions 関数のコード) ...
// 既存の generateOptions 関数 (answer が undefined の可能性に対応)
const generateOptions = (answer: number | undefined, difficulty: DifficultyRank, seed: number): number[] => {
    if (answer === undefined) {
        console.error("[generateOptions] Answer is undefined, cannot generate options.");
        // フォールバック: ダミーの選択肢を返す
        return [1, 2, 3, 4];
    }

    // ... (既存の選択肢生成ロジック) ...
     // console.log(`[generateOptions] answer: ${answer}, difficulty: ${difficulty}, seed: ${seed}`);
      const isDecimal = !Number.isInteger(answer);
      const decimals = isDecimal ? 2 : 0; // 小数点以下2桁まで考慮
      const factor = Math.pow(10, decimals);
      const roundedAnswer = Math.round(answer * factor) / factor;

      const options = [roundedAnswer];
      const maxAttempts = 100;
      let attempts = 0;

      // 難易度に応じた選択肢の「ずれ」の範囲を設定
      let rangeMagnitude = 5;
      if (difficulty === 'intermediate') rangeMagnitude = 10;
      if (difficulty === 'advanced') rangeMagnitude = isDecimal ? 5 : 20; // 小数ならずれを小さく
      if (difficulty === 'expert') rangeMagnitude = isDecimal ? 10 : 50;

      // 小数の場合はずれも小さくする
      const range = isDecimal ? rangeMagnitude / factor : rangeMagnitude;
      // console.log(`[generateOptions] range: ${range} (isDecimal: ${isDecimal})`);

      // 3つの誤った選択肢を追加
      while (options.length < 4 && attempts < maxAttempts * 4) {
        attempts++;
        let option;
        const offsetMagnitude = getRandomInt(-rangeMagnitude, rangeMagnitude, seed + attempts * 10);
        const offset = isDecimal ? offsetMagnitude / factor : offsetMagnitude;

        // 四捨五入して選択肢を生成
        option = Math.round((roundedAnswer + offset) * factor) / factor;

        // 答えと同じ、または既存の選択肢と重複、または負数は避ける (0はOK)
        if (!options.includes(option) && option !== roundedAnswer && option >= 0) {
            options.push(option);
        }

        if (attempts >= maxAttempts * 4 && options.length < 4) {
             console.error(`[generateOptions] Max attempts reached. Options: ${options}`);
             // 強制的に選択肢を追加
             let fallbackOptionBase = roundedAnswer > 10 ? roundedAnswer : 10;
             while(options.length < 4) {
                 let fallbackOption = Math.round((fallbackOptionBase + (options.length * (isDecimal ? 0.1 : 1)) * (seededRandom(seed + attempts + options.length) < 0.5 ? 1 : -1)) * factor) / factor;
                 if(fallbackOption < 0) fallbackOption = Math.abs(fallbackOption) + 1;
                 if (!options.includes(fallbackOption) && fallbackOption !== roundedAnswer && fallbackOption >= 0) {
                     options.push(fallbackOption);
                 } else {
                     // 無限ループ防止のため、適当な乱数で埋める
                     options.push(Math.round(getRandomInt(0, roundedAnswer * 2 + 10, seed + attempts + options.length * 2) * factor)/factor);
                 }
             }
             break;
        }
      } // end while options.length < 4

      // 選択肢をシャッフル
      // console.log('[generateOptions] Shuffling options...');
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i + 500 + attempts) * (i + 1));
        if(i !== j) {
           [options[i], options[j]] = [options[j], options[i]];
        }
      }

      // console.log(`[generateOptions] Final options: ${options}`);
      return options;
};

// 問題設定インターフェース
interface OperationSettings {
  enabled: boolean;
  digits?: number; // 旧バージョンとの互換性のために残す
  minDigits?: number; // 最小桁数（第一オペランド）
  maxDigits?: number; // 最大桁数（第一オペランド）
  minDigits2?: number; // 最小桁数（第二オペランド）
  maxDigits2?: number; // 最大桁数（第二オペランド）
  decimalEnabled?: boolean; // 小数を有効にするかどうか
  decimalPlaces?: number;
  minValue?: number;
  maxValue?: number;
  useBrackets?: boolean; // 括弧を使用するかどうか
}

interface DifficultySettings {
  addition: OperationSettings;
  subtraction: OperationSettings;
  multiplication: OperationSettings;
  division: OperationSettings;
  decimal: OperationSettings;
  termsCount: number; // 難易度全体の設定から取得（必須フィールド）
}

interface ProblemSettings {
  beginner: DifficultySettings;
  intermediate: DifficultySettings;
  advanced: DifficultySettings;
  expert: DifficultySettings;
}

// デフォルト設定
const defaultSettings: ProblemSettings = {
  beginner: {
    addition: { enabled: true, minDigits: 1, maxDigits: 1, digits: 1 },
    subtraction: { enabled: true, minDigits: 1, maxDigits: 1, digits: 1 },
    multiplication: { enabled: false, minDigits: 1, maxDigits: 1, digits: 1 },
    division: { enabled: false, minDigits: 1, maxDigits: 1, digits: 1 },
    decimal: { enabled: false, minDigits: 1, maxDigits: 1, digits: 1, decimalPlaces: 1 },
    termsCount: 2
  },
  intermediate: {
    addition: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    subtraction: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    multiplication: { enabled: true, minDigits: 1, maxDigits: 1, digits: 1 },
    division: { enabled: true, minDigits: 1, maxDigits: 1, digits: 1 },
    decimal: { enabled: false, minDigits: 1, maxDigits: 1, digits: 1, decimalPlaces: 1 },
    termsCount: 2
  },
  advanced: {
    addition: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    subtraction: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    multiplication: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    division: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    decimal: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2, decimalPlaces: 1 },
    termsCount: 2
  },
  expert: {
    addition: { enabled: true, minDigits: 2, maxDigits: 3, digits: 3 },
    subtraction: { enabled: true, minDigits: 2, maxDigits: 3, digits: 3 },
    multiplication: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    division: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    decimal: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2, decimalPlaces: 2 },
    termsCount: 3
  }
};

// 設定を取得する
const getSettings = (): ProblemSettings => {
  try {
    const savedSettings = localStorage.getItem('problemSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
  } catch (error) {
    console.error("Failed to load problem settings:", error);
  }
  return defaultSettings;
};

// 単一の問題生成
const generateSingleProblemInternal = (difficulty: DifficultyRank, seed: number): { question: string; answer: number; } | null => {
  try {
    const settings = getSettings();
    const difficultySettings = settings[difficulty] || defaultSettings[difficulty];

    // 有効な操作のリストを作成
    const enabledOperations: string[] = [];
    if (difficultySettings.addition.enabled) enabledOperations.push('addition');
    if (difficultySettings.subtraction.enabled) enabledOperations.push('subtraction');
    if (difficultySettings.multiplication.enabled) enabledOperations.push('multiplication');
    if (difficultySettings.division.enabled) enabledOperations.push('division');

    // 有効な操作がない場合
    if (enabledOperations.length === 0) {
      // 少なくとも足し算を有効にする
      console.warn(`No operations enabled for difficulty ${difficulty}, defaulting to addition`);
      enabledOperations.push('addition');
    }

    // 操作タイプをランダムに選ぶ
    const opTypeIndex = Math.floor(seededRandom(seed) * enabledOperations.length);
    const opType = enabledOperations[opTypeIndex] as keyof DifficultySettings;
    
    // 選択した操作の設定を取得
    const opSettings = difficultySettings[opType] as OperationSettings;

    // 項の数を取得（設定値または2項）- 難易度全体の設定から取得
    const termsCount = difficultySettings.termsCount || 2;
    
    // 括弧を使用するかどうか（3項演算のみ有効）
    const useBrackets = termsCount > 2 ? (opSettings.useBrackets || false) : false;

    // 小数を含むかどうかの判定（各操作に decimalEnabled が設定されている場合はそれを優先）
    // decimalEnabled が未設定の場合は下位互換性のため decimal の設定を使用
    const useDecimal = opSettings.decimalEnabled ?? difficultySettings.decimal.enabled;
    
    // decimal設定から小数点以下の桁数を取得
    const decimalPlaces = useDecimal ? (difficultySettings.decimal.decimalPlaces || 1) : 0;

    // 桁数または最小・最大値を取得する関数（第一・第二オペランド対応）
    const getDigitsOrRange = (opType: keyof DifficultySettings, forSecondOperand = false) => {
      const settings = difficultySettings[opType] as OperationSettings;
      
      if (forSecondOperand) {
        // 第二オペランド用の設定
        // minDigits2/maxDigits2がない場合は第一オペランドの値を使用
        const minDigits = settings.minDigits2 !== undefined ? settings.minDigits2 : 
                         (settings.minDigits !== undefined ? settings.minDigits : 
                         (settings.digits || 1));
        const maxDigits = settings.maxDigits2 !== undefined ? settings.maxDigits2 : 
                         (settings.maxDigits !== undefined ? settings.maxDigits : 
                         (settings.digits || 1));
        return { minDigits, maxDigits };
      } else {
        // 第一オペランド用の設定
        const minDigits = settings.minDigits !== undefined ? settings.minDigits : (settings.digits || 1);
        const maxDigits = settings.maxDigits !== undefined ? settings.maxDigits : (settings.digits || 1);
        return { minDigits, maxDigits };
      }
    };

    // 第一オペランドと第二オペランドの桁数を取得
    const op1Digits = getDigitsOrRange(opType);
    const op2Digits = getDigitsOrRange(opType, true);

    // 問題生成に使用する数値を生成
    const generateNumberByDigits = (digits: number, seedOffset: number) => {
      // 整数の場合
      if (!useDecimal) {
        // digits が 1 の場合は 1〜9
        if (digits === 1) {
          return getRandomInt(1, 9, seed + seedOffset);
        }
        // digits が 2 以上の場合は 10^(digits-1) 〜 10^digits - 1
        const min = Math.pow(10, digits - 1);
        const max = Math.pow(10, digits) - 1;
        return getRandomInt(min, max, seed + seedOffset);
      } 
      // 小数の場合
      else {
        // 小数の桁数を考慮する
        if (digits === 1) {
          // 1桁整数部分の小数: 0.1〜9.9
          return getRandomFloat(0.1, 9.9, seed + seedOffset, decimalPlaces);
        } else {
          // 2桁以上の整数部分を持つ小数
          const min = Math.pow(10, digits - 1) / Math.pow(10, decimalPlaces);
          const max = (Math.pow(10, digits) - 1) / Math.pow(10, decimalPlaces);
          return getRandomFloat(min, max, seed + seedOffset, decimalPlaces);
        }
      }
    };

    // 3項演算の場合
    if (termsCount === 3) {
      // 3項演算の処理
      const firstOperandDigits = getRandomInt(op1Digits.minDigits, op1Digits.maxDigits, seed + 100);
      const secondOperandDigits = getRandomInt(op2Digits.minDigits, op2Digits.maxDigits, seed + 200);
      const thirdOperandDigits = getRandomInt(op2Digits.minDigits, op2Digits.maxDigits, seed + 300);
      
      let num1, num2, num3, answer;
      
      // 第三項の演算子を決定（同じ種類の演算子または別の演算子）
      let secondOpType = opType;
      if (seededRandom(seed + 50) < 0.3) { // 30%の確率で別の演算子
        const otherOps = ['addition', 'subtraction', 'multiplication', 'division'].filter(op => {
          const opSetting = difficultySettings[op as keyof DifficultySettings] as OperationSettings;
          return op !== opType && opSetting.enabled;
        });
        if (otherOps.length > 0) {
          const randomIndex = Math.floor(seededRandom(seed + 51) * otherOps.length);
          secondOpType = otherOps[randomIndex] as keyof DifficultySettings;
        }
      }
      
      // 括弧の位置（括弧ありの場合）：true = (num1 op1 num2) op2 num3, false = num1, op1 (num2 op2 num3)
      const bracketFirstTwo = useBrackets && seededRandom(seed + 52) < 0.5;
      
      // 各数値を生成
      switch (opType) {
        case 'addition':
          num1 = generateNumberByDigits(firstOperandDigits, 1);
          num2 = generateNumberByDigits(secondOperandDigits, 2);
          num3 = generateNumberByDigits(thirdOperandDigits, 3);
          break;
          
        case 'subtraction':
          num1 = generateNumberByDigits(firstOperandDigits, 4);
          num2 = generateNumberByDigits(secondOperandDigits, 5);
          num3 = generateNumberByDigits(thirdOperandDigits, 6);
          
          // 常に正の結果になるように調整
          if (bracketFirstTwo) {
            // (num1 - num2) - num3の場合、num1 > num2 かつ (num1 - num2) > num3 となるように
            if (num2 >= num1) {
              // num1をnum2より大きくする
              num1 = num2 + getRandomInt(1, 10, seed + 150);
            }
            if (num1 - num2 <= num3) {
              // num3を(num1 - num2)より小さくする
              num3 = Math.max(1, Math.floor((num1 - num2) * 0.8));
            }
          } else {
            // num1 - (num2 - num3)の場合
            if (num3 >= num2) {
              // num2をnum3より大きくする
              num2 = num3 + getRandomInt(1, 10, seed + 151);
            }
            // 最終結果が正になるか確認 (num1 - (num2 - num3))
            if (num1 < (num2 - num3)) {
              num1 = (num2 - num3) + getRandomInt(1, 10, seed + 152);
            }
          }
          break;
          
        case 'multiplication':
          // 各数値を生成（小さめの値にする）
          const multDigits1 = Math.min(firstOperandDigits, 2);  // 乗算は桁数を制限
          const multDigits2 = Math.min(secondOperandDigits, 2);
          const multDigits3 = Math.min(thirdOperandDigits, 2);
          
          num1 = generateNumberByDigits(multDigits1, 8);
          num2 = generateNumberByDigits(multDigits2, 9);
          num3 = generateNumberByDigits(multDigits3, 10);
          break;
          
        case 'division':
          // 割り算の場合は必ず割り切れるように設定
          if (bracketFirstTwo) {
            // (num1 ÷ num2) ÷ num3 の形式
            // num3を先に決める（小さい値）
            num3 = getRandomInt(2, 5, seed + 11);
            // num2も小さめの値（割り切れる）
            num2 = getRandomInt(2, 5, seed + 12);
            // num1はnum2の倍数かつ(num1/num2)がnum3で割り切れる
            const intermediateQuotient = getRandomInt(1, 9, seed + 13) * num3; // 中間結果
            num1 = num2 * intermediateQuotient; // 確実に割り切れる
          } else {
            // num1 ÷ (num2 ÷ num3) の形式 = num1 × (num3 ÷ num2) × num2
            num3 = getRandomInt(2, 5, seed + 14);
            // num2はnum3の倍数にする
            num2 = num3 * getRandomInt(1, 4, seed + 15);
            // 最終的な結果を整数にするため
            const result = getRandomInt(2, 9, seed + 16);
            num1 = result * num2 / num3;
          }
          
          // 「わられる数」が3桁を超えないよう制限
          const divMaxDigits = Math.min(3, op1Digits.maxDigits);
          if (num1 > Math.pow(10, divMaxDigits) - 1) {
            // 数値を縮小して3桁以内に収める
            const scale = (Math.pow(10, divMaxDigits) - 1) / num1;
            // スケールを適用し、割り切れる関係を維持
            if (bracketFirstTwo) {
              // (num1 ÷ num2) ÷ num3
              // スケールは両方かけるのでOK
              num1 = Math.floor(num1 * scale);
              num2 = Math.max(2, Math.floor(num2 * scale));
              // 割り切れるように微調整
              num1 = Math.floor(num1 / num2) * num2;
            } else {
              // num1 ÷ (num2 ÷ num3)
              num1 = Math.floor(num1 * scale);
              // num2/num3の関係は維持
            }
          }
          
          // 0除算を防止
          if (num2 === 0) num2 = 2;
          if (num3 === 0) num3 = 2;
          break;
          
        default:
          console.error(`Unknown operation type: ${opType}`);
          return null;
      }
      
      // 第二の演算子の記号
      const op1Symbol = getOpSymbol(['addition', 'subtraction', 'multiplication', 'division'].indexOf(opType));
      const op2Symbol = getOpSymbol(['addition', 'subtraction', 'multiplication', 'division'].indexOf(secondOpType as string));
      
      // 計算結果
      if (bracketFirstTwo) {
        // (num1 op1 num2) op2 num3
        let intermediateResult;
        switch (opType) {
          case 'addition': intermediateResult = num1 + num2; break;
          case 'subtraction': intermediateResult = num1 - num2; break;
          case 'multiplication': intermediateResult = num1 * num2; break;
          case 'division': intermediateResult = num1 / num2; break;
          default: intermediateResult = 0;
        }
        
        switch (secondOpType) {
          case 'addition': answer = intermediateResult + num3; break;
          case 'subtraction': answer = intermediateResult - num3; break;
          case 'multiplication': answer = intermediateResult * num3; break;
          case 'division': answer = intermediateResult / num3; break;
          default: answer = 0;
        }
      } else {
        // num1 op1 (num2 op2 num3)
        let intermediateResult;
        switch (secondOpType) {
          case 'addition': intermediateResult = num2 + num3; break;
          case 'subtraction': intermediateResult = num2 - num3; break;
          case 'multiplication': intermediateResult = num2 * num3; break;
          case 'division': intermediateResult = num2 / num3; break;
          default: intermediateResult = 0;
        }
        
        switch (opType) {
          case 'addition': answer = num1 + intermediateResult; break;
          case 'subtraction': answer = num1 - intermediateResult; break;
          case 'multiplication': answer = num1 * intermediateResult; break;
          case 'division': answer = num1 / intermediateResult; break;
          default: answer = 0;
        }
      }
      
      // 小数の場合、結果を丸める
      if (useDecimal) {
        const factor = Math.pow(10, decimalPlaces);
        answer = Math.round(answer * factor) / factor;
      }
      
      // 問題文の生成（括弧あり/なし）
      let question;
      if (useBrackets) {
        question = bracketFirstTwo 
          ? `(${num1} ${op1Symbol} ${num2}) ${op2Symbol} ${num3} = ?`
          : `${num1} ${op1Symbol} (${num2} ${op2Symbol} ${num3}) = ?`;
      } else {
        // 括弧なしの場合（演算子の優先順位に注意）
        question = `${num1} ${op1Symbol} ${num2} ${op2Symbol} ${num3} = ?`;
      }
      
      return { question, answer };
    }
    // 2項演算の場合（既存のコード）
    else {
      // 実際の桁数をランダムに決定
      const firstOperandDigits = getRandomInt(op1Digits.minDigits, op1Digits.maxDigits, seed + 100);
      const secondOperandDigits = getRandomInt(op2Digits.minDigits, op2Digits.maxDigits, seed + 200);

      // タイプに応じた問題生成
      let num1, num2, answer;
      let operationSymbol;

      switch (opType) {
        case 'addition':
          num1 = generateNumberByDigits(firstOperandDigits, 1);
          num2 = generateNumberByDigits(secondOperandDigits, 2);
          answer = num1 + num2;
          operationSymbol = '+';
          break;

        case 'subtraction':
          // 引き算はnum1 > num2となるように調整
          num1 = generateNumberByDigits(firstOperandDigits, 3);
          // 第二オペランドが第一オペランドより大きい桁数を持つ場合は調整
          const maxSecondDigit = Math.min(secondOperandDigits, firstOperandDigits);
          num2 = generateNumberByDigits(maxSecondDigit, 4);
          
          // 常に正の結果になるように調整
          if (num2 >= num1) {
            // 単純に入れ替えるのではなく、num1を大きくする
            num1 = num2 + getRandomInt(1, 10, seed + 153);
          }
          answer = num1 - num2;
          operationSymbol = '-';
          break;

        case 'multiplication':
          // 桁数を制限（あまり大きい数の掛け算は小学生には難しい）
          const multDigits1 = Math.min(firstOperandDigits, 3);
          const multDigits2 = Math.min(secondOperandDigits, 3);
          
          num1 = generateNumberByDigits(multDigits1, 5);
          num2 = generateNumberByDigits(multDigits2, 6);
          answer = num1 * num2;
          operationSymbol = '×';
          break;

        case 'division':
          // 割り算は常に割り切れるように調整
          // 小数の場合と整数の場合で処理を分ける
          if (useDecimal) {
            // 小数の場合
            // 答え(商)を先に生成
            const quotient = generateNumberByDigits(firstOperandDigits, 7);
            
            // 除数を生成（あまり大きくしない）
            let divisor;
            if (secondOperandDigits === 1) {
              divisor = getRandomInt(2, 9, seed + 8);
            } else {
              divisor = getRandomInt(2, Math.min(20, Math.pow(10, secondOperandDigits) - 1), seed + 8);
            }
            
            // 小数点以下の桁数を取得
            const decimalFactor = Math.pow(10, decimalPlaces);
            
            // 被除数を計算（整数部分で割り切れるようにする）
            // 小数はあとで追加
            const integerQuotient = Math.floor(quotient);
            num1 = divisor * integerQuotient;
            
            // 小数部分がある場合は調整
            if (quotient > integerQuotient) {
              // 例: 商が 3.5 で除数が 2 なら、被除数は 7
              const decimalPart = Math.round((quotient - integerQuotient) * decimalFactor) / decimalFactor;
              num1 += divisor * decimalPart;
            }
            
            // 値を設定
            num2 = divisor;
            answer = quotient;
          } else {
            // 整数の場合（確実に割り切れるようにする）
            // 除数を先に生成
            let divisor;
            if (secondOperandDigits === 1) {
              // 1桁の場合は2～9
              divisor = getRandomInt(2, 9, seed + 8);
            } else {
              // 2桁以上の場合
              divisor = getRandomInt(Math.pow(10, secondOperandDigits - 1), Math.pow(10, secondOperandDigits) - 1, seed + 8);
            }
            
            // 商を生成（答え）- 桁数は設定範囲内に制限
            let quotient;
            if (firstOperandDigits === 1) {
              quotient = getRandomInt(1, 9, seed + 7);
            } else {
              quotient = getRandomInt(Math.pow(10, firstOperandDigits - 1), Math.pow(10, firstOperandDigits) - 1, seed + 7);
            }
            
            // 被除数を計算（確実に割り切れる）
            let dividend = divisor * quotient;
            
            // わられる数の桁数制限（最大3桁）
            const maxDigits = Math.min(3, op1Digits.maxDigits);
            if (dividend > Math.pow(10, maxDigits) - 1) {
              // 数値を適切な範囲に縮小
              const scale = (Math.pow(10, maxDigits) - 1) / dividend;
              divisor = Math.max(2, Math.floor(divisor * scale));
              quotient = Math.max(1, Math.floor(quotient * scale));
              dividend = divisor * quotient;
            }
            
            // 値を設定
            num1 = dividend;
            num2 = divisor;
            answer = quotient;
          }
          operationSymbol = '÷';
          break;

        default:
          // ここには来ないはずだが、念のため
          console.error(`Unknown operation type: ${opType}`);
          return null;
      }

      // 小数の場合、桁数を調整
      if (useDecimal && decimalPlaces > 0) {
        // 小数点以下の桁数に合わせて丸める
        const factor = Math.pow(10, decimalPlaces);
        
        // 小数の場合、整数を小数に変換する
        // 例: 123 → 12.3 や 1.23 などランダムに小数点を挿入する（桁数は維持）
        if (!operationSymbol.includes('÷')) { // 除算以外（除算は既に処理済み）
          const convertIntegerToDecimal = (num: number, digits: number): number => {
            if (num === 0) return 0;
            
            // 数値を文字列に変換して桁数を取得
            const numStr = Math.abs(num).toString();
            const numDigits = numStr.length;
            
            // 小数点を挿入する位置をランダムに決定（先頭以外）
            const decimalPosition = getRandomInt(1, numDigits, seed + num);
            
            // 文字列を分割して小数点を挿入
            const beforeDecimal = numStr.substring(0, decimalPosition);
            const afterDecimal = numStr.substring(decimalPosition);
            
            // 符号を考慮して値を返す
            const result = parseFloat(`${beforeDecimal}.${afterDecimal}`);
            return num < 0 ? -result : result;
          };

          // 片方または両方の数値を小数に変換（オペレーションによって変える）
          if (opType === 'addition' || opType === 'subtraction') {
            // 加減算の場合は両方変換してもよい
            if (seededRandom(seed + 10) < 0.7) { // 70%の確率で変換
              num1 = convertIntegerToDecimal(num1, firstOperandDigits);
            }
            if (seededRandom(seed + 11) < 0.7) { // 70%の確率で変換
              num2 = convertIntegerToDecimal(num2, secondOperandDigits);
            }
          } else if (opType === 'multiplication') {
            // 乗算の場合はひとつだけ変換
            if (seededRandom(seed + 12) < 0.5) {
              num1 = convertIntegerToDecimal(num1, firstOperandDigits);
            } else {
              num2 = convertIntegerToDecimal(num2, secondOperandDigits);
            }
          }
          
          // 計算し直し
          if (opType === 'addition') answer = num1 + num2;
          if (opType === 'subtraction') answer = num1 - num2;
          if (opType === 'multiplication') answer = num1 * num2;
        }

        // 最終的な丸め処理
        num1 = Math.round(num1 * factor) / factor;
        num2 = Math.round(num2 * factor) / factor;
        answer = Math.round(answer * factor) / factor;
      }

      // 問題文の生成
      const question = `${num1} ${operationSymbol} ${num2} = ?`;

      return {
        question,
        answer
      };
    }
  } catch (error) {
    console.error(`[generateSingleProblemInternal] Error generating problem for difficulty ${difficulty} with seed ${seed}:`, error);
    return null;
  }
};

// generateProblemsByDifficulty は generateSingleProblemInternal を呼び出し、options を追加する
const generateProblemsByDifficulty = (difficulty: DifficultyRank, count: number = 10): Problem[] => {
    console.log(`[generateProblemsByDifficulty] Generating ${count} problems for difficulty: ${difficulty}`);
    const problems: Problem[] = [];
    const baseSeed = getDateSeed();
    console.log(`[generateProblemsByDifficulty] Base seed: ${baseSeed}`);

    let generatedCount = 0;
    let generationAttempts = 0;
    const maxGenerationAttempts = count * 20; // 試行回数をさらに増やす
    const usedQuestions: Set<string> = new Set(); // Avoid duplicate questions

    while (generatedCount < count && generationAttempts < maxGenerationAttempts) {
        generationAttempts++;
        const seed = baseSeed + generationAttempts * 1000;

        const problemData = generateSingleProblemInternal(difficulty, seed);

        if (problemData && !usedQuestions.has(problemData.question)) {
            const options = generateOptions(problemData.answer, difficulty, seed + 1); // Generate options
            if (options && options.length === 4) { // Ensure options were generated
               problems.push({ 
                  // id: generatedCount, // id は generateProblems で付与
                  question: problemData.question,
                  answer: problemData.answer,
                  options: options // ★ options を追加
               });
               usedQuestions.add(problemData.question);
               generatedCount++;
            } else {
                console.warn(`[generateProblemsByDifficulty] Failed to generate options for question: ${problemData.question}`);
            }
        } else if (!problemData) {
             // console.warn(`[generateProblemsByDifficulty] generateSingleProblemInternal failed. Retrying (Attempt ${generationAttempts})`);
        } // If duplicate, just continue loop
    } // end while loop

    if (generatedCount < count) {
         console.warn(`[generateProblemsByDifficulty] Could only generate ${generatedCount} valid unique problems out of ${count} requested after ${maxGenerationAttempts} attempts for difficulty ${difficulty}.`);
    } else {
        console.log(`[generateProblemsByDifficulty] Final generated ${problems.length} problems successfully for difficulty ${difficulty}.`);
    }

    return problems;
};

// generateProblems は id を付与する
export const generateProblems = (difficulty: DifficultyRank, count: number = 10): Problem[] => {
  try {
    const generated = generateProblemsByDifficulty(difficulty, count);
    // Problem 型に必要なプロパティ (question, answer, options) は generateProblemsByDifficulty から来る
    return generated.map((p, index) => ({
        ...p, // スプレッド構文で既存のプロパティをコピー
        id: index, // id を追加
    }));
  } catch (error) {
    console.error("Error in generateProblems wrapper:", error);
    return [];
  }
};

export { difficultyToJapanese, japaneseToDifficulty }; 