// server/utils/problemGenerator.js

// ★ DifficultyRank をバックエンドで定義
export const DifficultyRank = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
};

// --- ヘルパー関数 ---

// パフォーマンス改善: キャッシュオブジェクトを追加
const randomCache = new Map();
const MAX_CACHE_SIZE = 1000;

// 問題生成キャッシュを追加
const problemCache = {
  beginner: new Map(),
  intermediate: new Map(),
  advanced: new Map(),
  expert: new Map()
};

// 問題生成の進捗状況を追跡するためのマップ
const processingStatusMap = new Map();

// シード値に基づくランダム生成
const seededRandom = (seed) => {
  // キャッシュ済みの値があれば再利用
  if (randomCache.has(seed)) {
    return randomCache.get(seed);
  }
  
  const x = Math.sin(seed) * 10000;
  const result = x - Math.floor(x);
  
  // キャッシュサイズ管理
  if (randomCache.size >= MAX_CACHE_SIZE) {
    // 古いキーを削除（単純実装）
    const oldestKey = randomCache.keys().next().value;
    randomCache.delete(oldestKey);
  }
  
  // 結果をキャッシュ
  randomCache.set(seed, result);
  return result;
};

const getDateSeed = () => {
  const now = new Date();
  const dateString = `${now.getFullYear()}${now.getMonth()}${now.getDate()}`;
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed += dateString.charCodeAt(i);
  }
  return seed;
};

const getRandomInt = (min, max, seed) => {
  const m = Math.max(min, max);
  const n = Math.min(min, max);
  const random = seededRandom(seed);
  return Math.floor(random * (m - n + 1)) + n;
};

const getRandomFloat = (min, max, seed, decimals = 2) => {
    const random = seededRandom(seed);
    const value = random * (max - min) + min;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};

const getOpSymbol = (opIndex) => {
  const symbols = ['+', '-', '×', '÷'];
  return symbols[opIndex] || '+';
};

const calculateAnswer = (nums, ops, maxDecimalPlaces) => {
    // 計算ロジック（既存のままでOK）
    if (nums.length !== ops.length + 1) {
        console.error("[BE_calculateAnswer] Invalid input length");
        return undefined;
    }
    if (nums.some(isNaN) || nums.some(n => !Number.isFinite(n))) {
        console.error("[BE_calculateAnswer] Invalid number input");
        return undefined;
    }

    for (let i = 0; i < ops.length; i++) {
        if (ops[i] === '÷') {
            const divisor = nums[i + 1];
            if (divisor === 0) {
                console.warn(`[BE_calculateAnswer] Zero division detected`);
                return undefined;
            }
        }
    }

    const numbers = [...nums];
    const operators = [...ops];

    for (let i = 0; i < operators.length; ) {
        if (operators[i] === '×' || operators[i] === '÷') {
            const left = numbers[i];
            const right = numbers[i + 1];
            let result;
            if (operators[i] === '×') {
                result = left * right;
            } else {
                if (right === 0) return undefined;
                result = left / right;
            }
            if (!Number.isFinite(result)) {
                 console.warn(`[BE_calculateAnswer] Infinite result after Mul/Div`);
                 return undefined;
            }
            numbers.splice(i, 2, result);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }

    let finalResult = numbers[0];
    for (let i = 0; i < operators.length; i++) {
        const right = numbers[i + 1];
        const op = operators[i];
        if (op === '+') {
            finalResult += right;
        } else {
            finalResult -= right;
        }
    }

    if (!Number.isFinite(finalResult)) {
        console.error("[BE_calculateAnswer] Final result is Infinity or NaN");
          return undefined;
    }

    return finalResult;
};

const isCleanNumber = (num, allowedDecimalPlaces) => {
    if (Number.isInteger(num)) return true;
    const s = String(num);
    const decimalPart = s.split('.')[1];
    if (!decimalPart) return true;
    if (decimalPart.length > allowedDecimalPlaces) return false;
    const factor = Math.pow(10, allowedDecimalPlaces);
    return Math.abs(num - Math.round(num * factor) / factor) < 1e-9;
};

// ★ 難易度に基づくパラメータ設定（学習指導要領に基づいて調整）
const getParamsForDifficulty = (difficulty) => {
    switch (difficulty) {
        case DifficultyRank.BEGINNER: // 小学1・2年生
            return {
                problemTypes: ['add_subtract_2digit_1digit', 'multiplication_table'],
                termsRange: [2, 2], 
                digitRanges: { 
                    default: [1, 1], // 使われない想定だがフォールバック用
                    add_subtract_2digit_1digit: [[1, 2], [1, 1]], // 第1項:1-2桁, 第2項:1桁
                    multiplication_table: [1, 1], 
                },
                ops: ['+', '-','×'], 
                forceIntegerResult: true,
                allowNegativeResult: false,
                maxResultValue: 150, // 2桁+1桁の結果や九九の結果を考慮して少し上げる (例: 99+9=108, 9x9=81)
                decimals: 0,
                beginnerSpecific: {
                    multiplicationTablePercentage: 0.5, // 九九の割合 50%
                    addSubtract2digit1digitPercentage: 0.5, // 2桁と1桁の加減算の割合 50%
                }
            };
        case DifficultyRank.INTERMEDIATE: // 小学3・4年生
            return {
                problemTypes: [
                    'add_subtract_2_3digit',      // 3年生：3桁の加減
                    'multiply_2_3digit_by_1digit', // 3年生：2桁×1桁、3年生：3桁×1桁
                    'multiply_2digit_by_2digit',   // 4年生：2桁×2桁
                    'divide_with_remainder',       // 3年生：2桁÷1桁、4年生：3桁÷1桁
                    'simple_decimals_add_subtract' // 4年生：小数の加減（小数点以下1桁）
                ],
                termsRange: [2, 2], // 基本的に2項の計算
                digitRanges: {
                    default: [2, 3],
                    add_subtract_2_3digit: [[2, 3], [2, 3]], // 3桁までの加減
                    multiply_2_3digit_by_1digit: [[2, 3], [1, 1]], // (2-3桁) × (1桁)
                    multiply_2digit_by_2digit: [[2, 2], [2, 2]],   // (2桁) × (2桁)
                    divide_with_remainder: [[2, 3], [1, 1]],       // (2-3桁) ÷ (1桁)
                    simple_decimals_add_subtract: [[1, 2], [1, 2]] // 小数点以下1桁までの数の加減
                },
                ops: ['+', '-', '×', '÷'],
                forceIntegerResult: true, // 割り算は必ず割り切れる数を使用
                allowNegativeResult: false,
                maxResultValue: 10000, // 3桁×3桁の最大値（999×9=8991）を考慮
                decimals: 1, // 小数第一位まで
                intermediateSpecific: {
                    divisionRemainderPercentage: 0.0, // 余りのある割り算は出さない
                    decimalProblemPercentage: 0.2, // 小数問題の割合（4年生レベル）
                    multiplicationPercentage: 0.4, // かけ算の割合
                    divisionPercentage: 0.2, // わり算の割合
                    addSubtractPercentage: 0.2 // たし算・ひき算の割合
                }
            };
        case DifficultyRank.ADVANCED: // 小学5・6年生
            return {
                problemTypes: [
                    'decimal_multiply_divide', // 5年生: 小数の乗除
                    'fraction_add_subtract_different_denominators', // 5年生: 異分母分数の加減
                    'fraction_multiply_divide', // 6年生: 分数の乗除
                    'mixed_calculations_parentheses' // 5・6年生: 括弧を含む四則混合
                ],
                termsRange: [2, 4], // 計算に関わる項の数
                digitRanges: { // 各問題タイプでの整数部の桁数や分子分母の桁数
                    default: [1, 3], // フォールバック用
                    decimal_multiply_divide: [[1, 3], [1, 2]], // 例: 12.3 × 4.5 や 123.4 ÷ 5.67
                    fraction_add_subtract_different_denominators: [[1, 2], [1, 2]], // 分数の分子/分母の桁数
                    fraction_multiply_divide: [[1, 2], [1, 2]],
                    mixed_calculations_parentheses: [[1, 3], [1, 3], [1, 2]], // 混合計算で扱う数値の桁数
                },
                ops: ['+', '-', '×', '÷'],
                forceIntegerResult: false, // 小数・分数の結果を許可
                allowNegativeResult: false, // 負の数はなし
                maxResultValue: 100000, // 結果の最大値 (調整可能)
                decimals: 2, // 小数第二位まで
                allowParentheses: true, // 括弧の使用を許可
                advancedSpecific: {
                    decimalProblemPercentage: 0.3,   // 小数問題の割合 30%
                    fractionProblemPercentage: 0.4,  // 分数問題の割合 40%
                    mixedProblemPercentage: 0.3,     // 混合計算問題の割合 30%
                }
            };
        case DifficultyRank.EXPERT: // 超級 (すごい小学生)
            return {
                problemTypes: [
                    'complex_mixed_calculations_parentheses', // より複雑な括弧付き混合計算
                    'large_number_operations', // 大きな桁数の整数の計算
                    'strategic_calculations' // 工夫を要する計算 (問題生成で表現)
                ],
                termsRange: [3, 5],
                digitRanges: {
                    default: [2, 4],
                    complex_mixed_calculations_parentheses: [[2, 4], [2, 3], [1, 3]],
                    large_number_operations: [[3, 5], [2, 4]],
                    strategic_calculations: [[2, 4], [2, 4]] // 例: (A × B) + (A × C)
                },
                ops: ['+', '-', '×', '÷'],
                forceIntegerResult: false, // 結果が整数でなくても良い
                allowNegativeResult: false, // 負の数はなし (ユーザー指示)
                maxResultValue: 1000000, // 結果の最大値
                decimals: 3, // 小数第三位まで考慮 (問題による)
                allowParentheses: true,
                expertSpecific: {
                    complexMixedPercentage: 0.5, // 複雑な混合計算 50%
                    largeNumPercentage: 0.3,     // 大きな数 30%
                    strategicPercentage: 0.2     // 工夫する計算 20%
                }
            };
        default: // フォールバック (基本的に使われない想定)
            return { problemTypes: ['add_subtract_1digit'], termsRange: [2,2], digitRanges: { default: [1,1], add_subtract_1digit: [1,1]}, ops: ['+'], forceIntegerResult: true, allowNegativeResult: false, maxResultValue: 20, decimals: 0 };
    }
};

// 選択肢生成関数
const generateOptions = (answer, difficulty, seed) => {
    // 既存のロジック（問題なし）
    if (answer === undefined) {
        console.error("[BE_generateOptions] Answer is undefined");
        return [1, 2, 3, 4]; // ダミー
    }

    const isDecimal = !Number.isInteger(answer);
    const params = getParamsForDifficulty(difficulty);
    const decimals = isDecimal ? params.decimals : 0; 
    const factor = Math.pow(10, decimals);
    const roundedAnswer = Math.round(answer * factor) / factor;

    const options = [roundedAnswer];
    const maxAttempts = 100;
    let attempts = 0;

    let rangeMagnitude = 5;
    if (difficulty === DifficultyRank.INTERMEDIATE) rangeMagnitude = 10;
    if (difficulty === DifficultyRank.ADVANCED) rangeMagnitude = isDecimal ? 5 : 20;
    if (difficulty === DifficultyRank.EXPERT) rangeMagnitude = isDecimal ? 8 : 30; // 選択肢の範囲を少し狭める

    const range = isDecimal ? rangeMagnitude / factor : rangeMagnitude;

    while (options.length < 4 && attempts < maxAttempts * 4) {
        attempts++;
        let option;
        const offsetMagnitude = getRandomInt(-rangeMagnitude, rangeMagnitude, seed + attempts * 10);
        const offset = isDecimal ? offsetMagnitude / factor : offsetMagnitude;

        option = Math.round((roundedAnswer + offset) * factor) / factor;

        if (!options.includes(option) && option !== roundedAnswer && option >= 0) {
            options.push(option);
        }
    }

    while(options.length < 4) {
       let fallbackOption = Math.round(getRandomInt(0, Math.abs(roundedAnswer) * 2 + 10, seed + attempts + options.length * 2) * factor)/factor;
        if (!options.includes(fallbackOption) && fallbackOption !== roundedAnswer && fallbackOption >= 0) {
             options.push(fallbackOption);
        }
    }

    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i + 500 + attempts) * (i + 1));
        if(i !== j) {
           [options[i], options[j]] = [options[j], options[i]];
        }
    }
    return options;
};

// タイムアウトを検出するための関数
const checkTimeout = (startTime, maxTime = 15000) => {
  const elapsedTime = Date.now() - startTime;
  return elapsedTime > maxTime;
};

// 新しいヘルパー関数: 問題タイプを選択
const selectProblemType = (difficulty, seed) => {
  const params = getParamsForDifficulty(difficulty);
  if (!params.problemTypes || params.problemTypes.length === 0) {
    if (difficulty === DifficultyRank.BEGINNER) return 'add_subtract_2digit_1digit'; // デフォルト変更
    console.warn(`[selectProblemType] No problemTypes defined for ${difficulty}, or empty.`);
    return params.ops && params.ops.length > 0 ? 'generic_calculation' : null; 
  }

  const randomValue = seededRandom(seed);
  let cumulativePercentage = 0;

  if (difficulty === DifficultyRank.BEGINNER && params.beginnerSpecific) {
    const spec = params.beginnerSpecific;
    const mtPercentage = params.problemTypes.includes('multiplication_table') ? (spec.multiplicationTablePercentage || 0) : 0;
    const as2d1dPercentage = params.problemTypes.includes('add_subtract_2digit_1digit') ? (spec.addSubtract2digit1digitPercentage || 0) : 0;

    cumulativePercentage += mtPercentage;
    if (randomValue < cumulativePercentage && params.problemTypes.includes('multiplication_table')) return 'multiplication_table';

    // 残りが add_subtract_2digit_1digit しかない場合はそれを返す
    if (params.problemTypes.includes('add_subtract_2digit_1digit')) return 'add_subtract_2digit_1digit';
    
    // フォールバック（通常ここには来ないはず）
    return params.problemTypes[0];

  } else if (difficulty === DifficultyRank.INTERMEDIATE && params.intermediateSpecific) {
    const spec = params.intermediateSpecific;
    const randomValue = seededRandom(seed);

    // 問題タイプの選択（割合に基づく）
    if (randomValue < spec.multiplicationPercentage) {
      // かけ算問題（40%）
      const multRandom = seededRandom(seed + 100);
      return multRandom < 0.7 ? 'multiply_2_3digit_by_1digit' : 'multiply_2digit_by_2digit';
    } else if (randomValue < (spec.multiplicationPercentage + spec.divisionPercentage)) {
      // わり算問題（20%）
      return 'divide_with_remainder';
    } else if (randomValue < (spec.multiplicationPercentage + spec.divisionPercentage + spec.addSubtractPercentage)) {
      // たし算・ひき算問題（20%）
      return 'add_subtract_2_3digit';
    } else {
      // 小数のたし算・ひき算問題（20%）
      return 'simple_decimals_add_subtract';
    }
  } else if (difficulty === DifficultyRank.ADVANCED && params.advancedSpecific) {
    const spec = params.advancedSpecific;
    const randomVal = seededRandom(seed + 200); // シード値を他と変える
    if (randomVal < spec.fractionProblemPercentage) {
      // 分数問題 (40%)
      const fractionRandom = seededRandom(seed + 210);
      if (fractionRandom < 0.5 && params.problemTypes.includes('fraction_add_subtract_different_denominators')) {
        return 'fraction_add_subtract_different_denominators';
      } else if (params.problemTypes.includes('fraction_multiply_divide')) {
        return 'fraction_multiply_divide';
      }
    } else if (randomVal < (spec.fractionProblemPercentage + spec.decimalProblemPercentage)) {
      // 小数問題 (30%)
      if (params.problemTypes.includes('decimal_multiply_divide')) {
        return 'decimal_multiply_divide';
      }
    } else { // 残り (30%)
      // 混合計算問題
      if (params.problemTypes.includes('mixed_calculations_parentheses')) {
        return 'mixed_calculations_parentheses';
      }
    }
    // フォールバック (指定された割合でタイプが見つからない場合など)
    return params.problemTypes[getRandomInt(0, params.problemTypes.length - 1, seed + 220)];
  } else if (difficulty === DifficultyRank.EXPERT && params.expertSpecific) {
    const spec = params.expertSpecific;
    const randomVal = seededRandom(seed + 300);
    if (randomVal < spec.complexMixedPercentage) {
      // 複雑な混合計算 (50%)
      if (params.problemTypes.includes('complex_mixed_calculations_parentheses')) {
        return 'complex_mixed_calculations_parentheses';
      }
    } else if (randomVal < (spec.complexMixedPercentage + spec.largeNumPercentage)) {
      // 大きな数 (30%)
      if (params.problemTypes.includes('large_number_operations')) {
        return 'large_number_operations';
      }
    } else { // 残り (20%)
      // 工夫する計算
      if (params.problemTypes.includes('strategic_calculations')) {
        return 'strategic_calculations';
      }
    }
    // フォールバック
    return params.problemTypes[getRandomInt(0, params.problemTypes.length - 1, seed + 310)];
  }
  
  const typeIndex = getRandomInt(0, params.problemTypes.length - 1, seed + 1); 
  return params.problemTypes[typeIndex];
};

// 単一問題生成関数
const generateSingleProblemInternal = async (difficulty, seed) => {
  const params = getParamsForDifficulty(difficulty);
  const allowedDecimalPlaces = params.decimals;
  const startTime = Date.now();

  const cacheKey = `${difficulty}_${seed}`; 
  if (problemCache[difficulty] && problemCache[difficulty].has(cacheKey)) {
    return problemCache[difficulty].get(cacheKey);
  }

  let attempts = 0;
  const maxAttempts = difficulty === DifficultyRank.BEGINNER ? 70 : // BEGINNERの試行回数を少し増やす
                      difficulty === DifficultyRank.INTERMEDIATE ? 80 :
                      difficulty === DifficultyRank.ADVANCED ? 120 : 150;
  
  while (attempts < maxAttempts) {
    attempts++;
    if (checkTimeout(startTime, 20000)) { 
      console.warn(`[ProblemGenerator] Timeout during generation for difficulty ${difficulty}, seed ${seed} (attempt ${attempts})`);
      return generateFallbackProblem(difficulty, seed + attempts);
    }

    const currentSeed = seed + attempts / 100; 
    const problemType = selectProblemType(difficulty, currentSeed);

    if (!problemType || (problemType === 'generic_calculation' && params.problemTypes.length > 1)) {
        if (problemType === 'generic_calculation' && attempts < maxAttempts / 2) continue;
        console.warn(`[ProblemGenerator] Could not reliably select a specific problem type for ${difficulty} (selected: ${problemType}). Using fallback or generic.`);
        if (!problemType) return generateFallbackProblem(difficulty, currentSeed);
    }

    let nums = [];
    let ops = [];
    let questionStr = '';
    let answer = undefined; 
    let typeForProblemObject = problemType; 
         
         if (difficulty === DifficultyRank.BEGINNER) {
      if (problemType === 'multiplication_table') {
        const num1 = getRandomInt(1, 9, currentSeed + 10);
        const num2 = getRandomInt(1, 9, currentSeed + 20);
        nums = [num1, num2];
        ops = ['×'];
        questionStr = `${num1} × ${num2}`;
        answer = num1 * num2;
        typeForProblemObject = 'multiplication_9x9'; 
      } else if (problemType === 'add_subtract_2digit_1digit') {
        const digitConfig = params.digitRanges.add_subtract_2digit_1digit; // [[1,2], [1,1]]
        // 第1項 (1-2桁)
        const num1Digits = getRandomInt(digitConfig[0][0], digitConfig[0][1], currentSeed + 30);
        const num1Min = Math.pow(10, num1Digits - 1);
        const num1Max = Math.pow(10, num1Digits) - 1;
        let num1 = getRandomInt(num1Min, num1Max, currentSeed + 31);

        // 第2項 (1桁)
        const num2Digits = getRandomInt(digitConfig[1][0], digitConfig[1][1], currentSeed + 40); // 実質1桁
        const num2Min = Math.pow(10, num2Digits - 1);
        const num2Max = Math.pow(10, num2Digits) - 1;
        let num2 = getRandomInt(num2Min, num2Max, currentSeed + 41);
        
        // 0を避ける
        if (num1 === 0) num1 = getRandomInt(1, num1Max, currentSeed + 32) || 1;
        if (num2 === 0) num2 = getRandomInt(1, num2Max, currentSeed + 42) || 1;

        const opIndex = getRandomInt(0, 1, currentSeed + 50);
        const op = (opIndex === 0 || !params.ops.includes('-')) ? '+' : '-';
        ops = [op];

        if (op === '-') {
          if (num1 < num2 && !params.allowNegativeResult) {
             // num1 < num2 の場合、単純な入れ替えだと num2 が2桁になる可能性がある
             // num1 (1-2桁) - num2 (1桁) で負にならないように num1 を num2 より大きくする必要がある
             // しかし、num1の最大値は99, num2の最大値は9なので、num1 >= num2 となるように再生成するか調整する
             // 簡単なのは、num1 < num2 なら再試行 (continue) するか、num1 を num2 以上の値で再生成
            if (num1 < num2) { // num1がnum2より小さい場合のみ調整
                if (num1Digits === 1 && num2Digits === 1) { // 両方1桁なら入れ替えOK
                    [num1, num2] = [num2, num1];
         } else {
                    // num1が2桁でnum2より小さい場合、またはnum1が1桁でnum2より小さい場合
                    // num1 を num2 以上になるように再生成 (例: num2 から (num2+50) の範囲で)
                    // ただし、maxResultValue も考慮する必要がある。
                    // ここではシンプルに再試行とする
                    continue; 
                }
            }
          }
        }
        nums = [num1, num2];
        answer = calculateAnswer(nums, ops, allowedDecimalPlaces);
        if (answer === undefined || 
            (answer < 0 && !params.allowNegativeResult) || 
            (params.maxResultValue && (answer > params.maxResultValue || answer < (params.allowNegativeResult ? -params.maxResultValue : 0) ))
           ) {
          continue; 
        }
        questionStr = `${num1} ${op} ${num2}`;
        typeForProblemObject = op === '+' ? 'addition_2d1d' : 'subtraction_2d1d';
      } else {
        console.warn(`[ProblemGenerator] Unknown problemType '${problemType}' for BEGINNER. Attempting fallback.`);
        return generateFallbackProblem(difficulty, currentSeed + 1000); // 未知のタイプならフォールバック
      }
    } else { // INTERMEDIATE 以上、または汎用ロジックへ
      const terms = getRandomInt(params.termsRange[0], params.termsRange[1], currentSeed + 60);
      const currentTermDigitParams = params.digitRanges[problemType] || params.digitRanges.default || [1,2]; 

      // 問題タイプに応じた特別な処理
      if (problemType === 'divide_with_remainder') {
        // 割り算問題の場合、必ず割り切れる数を使用
        const divisor = getRandomInt(1, 9, currentSeed + 70);
        const quotient = getRandomInt(1, 99, currentSeed + 80);
        const dividend = divisor * quotient;
        nums = [dividend, divisor];
        ops = ['÷'];
        answer = quotient;
        questionStr = `${dividend} ÷ ${divisor}`;
        typeForProblemObject = 'division';
      } else if (problemType === 'multiply_2_3digit_by_1digit') {
        // 2-3桁 × 1桁
        const num1 = getRandomInt(10, 999, currentSeed + 70);
        const num2 = getRandomInt(1, 9, currentSeed + 80);
        nums = [num1, num2];
        ops = ['×'];
        answer = num1 * num2;
        questionStr = `${num1} × ${num2}`;
        typeForProblemObject = 'multiplication';
      } else if (problemType === 'multiply_2digit_by_2digit') {
        // 2桁 × 2桁
        const num1 = getRandomInt(10, 99, currentSeed + 70);
        const num2 = getRandomInt(10, 99, currentSeed + 80);
        nums = [num1, num2];
        ops = ['×'];
        answer = num1 * num2;
        questionStr = `${num1} × ${num2}`;
        typeForProblemObject = 'multiplication';
      } else if (problemType === 'simple_decimals_add_subtract') {
        // 小数の加減算（小数点以下1桁まで）
        const num1 = getRandomFloat(1, 99, currentSeed + 70, 1);
        const num2 = getRandomFloat(1, 99, currentSeed + 80, 1);
        nums = [num1, num2];
        const opIndex = getRandomInt(0, 1, currentSeed + 90);
        ops = [opIndex === 0 ? '+' : '-'];
        answer = calculateAnswer(nums, ops, 1);
        // 答えが負の数にならないように調整
        if (answer < 0) {
          [nums[0], nums[1]] = [nums[1], nums[0]];
          answer = calculateAnswer(nums, ops, 1);
        }
        questionStr = `${nums[0]} ${ops[0]} ${nums[1]}`;
        typeForProblemObject = ops[0] === '+' ? 'decimal_addition' : 'decimal_subtraction';
      } else {
        // 通常の整数計算（たし算・ひき算）
        const num1 = getRandomInt(10, 999, currentSeed + 70);
        const num2 = getRandomInt(10, 999, currentSeed + 80);
        nums = [num1, num2];
        const opIndex = getRandomInt(0, 1, currentSeed + 90);
        ops = [opIndex === 0 ? '+' : '-'];
        answer = calculateAnswer(nums, ops, 0);
        // 答えが負の数にならないように調整
        if (answer < 0) {
          [nums[0], nums[1]] = [nums[1], nums[0]];
          answer = calculateAnswer(nums, ops, 0);
        }
        questionStr = `${nums[0]} ${ops[0]} ${nums[1]}`;
        typeForProblemObject = ops[0] === '+' ? 'addition' : 'subtraction';
      }
    }

    // ADVANCED レベルの具体的な問題生成ロジック
    if (difficulty === DifficultyRank.ADVANCED) {
      const terms = getRandomInt(params.termsRange[0], params.termsRange[1], currentSeed + 60);
      const currentTermDigitParams = params.digitRanges[problemType] || params.digitRanges.default || [[1,2],[1,2]];

      if (problemType === 'decimal_multiply_divide') {
        const num1Digits = currentTermDigitParams[0] || [1,3]; // 整数部の桁数範囲
        const num2Digits = currentTermDigitParams[1] || [1,2]; // 整数部の桁数範囲
        const decimalPlaces = params.decimals || 2;

        let num1 = getRandomFloat(Math.pow(10, num1Digits[0]-1), Math.pow(10, num1Digits[1])-1, currentSeed + 70, decimalPlaces);
        let num2 = getRandomFloat(Math.pow(10, num2Digits[0]-1), Math.pow(10, num2Digits[1])-1, currentSeed + 80, decimalPlaces);
        const op = seededRandom(currentSeed + 90) < 0.5 ? '×' : '÷';

        if (op === '÷') {
          if (num2 === 0) num2 = getRandomFloat(1, Math.pow(10, num2Digits[1])-1, currentSeed + 81, decimalPlaces) || 1; // 0除算回避
          answer = num1 / num2;
          // 結果が指定小数桁で割り切れるか、または非常に近いかチェック (要改善)
          if (!isCleanNumber(answer, decimalPlaces + 1)) { // 少し許容度を持たせる
            // 割り切れるペアが見つかるまで再試行 (最大10回程度)
            for (let i=0; i<10; i++) {
              num1 = getRandomFloat(Math.pow(10, num1Digits[0]-1), Math.pow(10, num1Digits[1])-1, currentSeed + 70 + i, decimalPlaces);
              num2 = getRandomFloat(Math.pow(10, num2Digits[0]-1), Math.pow(10, num2Digits[1])-1, currentSeed + 80 + i, decimalPlaces) || 1;
              if (num2 === 0) num2 = 1;
              answer = num1 / num2;
              if (isCleanNumber(answer, decimalPlaces)) break;
              if (i === 9) console.warn(`ADVANCED decimal division: clean pair not found for ${num1}/${num2}`);
            }
          }
        } else {
          answer = num1 * num2;
        }
        questionStr = `${num1} ${op} ${num2}`;
        typeForProblemObject = 'decimal_operation'; // より具体的に decimal_multiplication or decimal_division としても良い
        nums = [num1, num2]; // 検証用に保持
        ops = [op];

      } else if (problemType === 'mixed_calculations_parentheses') {
        // 2項または3項の計算 (例)
        const numTerms = getRandomInt(2, 3, currentSeed + 100);
        nums = [];
        for(let i=0; i<numTerms; i++) {
          const digitRange = currentTermDigitParams[i] || currentTermDigitParams[0] || [1,3];
          nums.push(getRandomInt(Math.pow(10, digitRange[0]-1), Math.pow(10, digitRange[1])-1, currentSeed + 110 + i));
        }
        
        ops = [];
        for(let i=0; i<numTerms-1; i++) {
          ops.push(params.ops[getRandomInt(0, params.ops.length - 1, currentSeed + 120 + i)]);
        }

        // 簡単な括弧の挿入 (例: (A op B) op C or A op (B op C))
        if (numTerms === 3) {
          if (seededRandom(currentSeed + 130) < 0.5) { // (A op B) op C
            questionStr = `(${nums[0]} ${ops[0]} ${nums[1]}) ${ops[1]} ${nums[2]}`;
            const firstResult = calculateAnswer([nums[0], nums[1]], [ops[0]], 0);
            if (firstResult !== undefined && firstResult >= 0) {
              answer = calculateAnswer([firstResult, nums[2]], [ops[1]], 0);
            } else { answer = undefined; } // 途中結果が不正なら全体も不正
          } else { // A op (B op C)
            questionStr = `${nums[0]} ${ops[0]} (${nums[1]} ${ops[1]} ${nums[2]})`;
            const secondResult = calculateAnswer([nums[1], nums[2]], [ops[1]], 0);
            if (secondResult !== undefined && secondResult >= 0) {
              answer = calculateAnswer([nums[0], secondResult], [ops[0]], 0);
            } else { answer = undefined; }
          }
        } else { // numTerms === 2
          questionStr = `${nums[0]} ${ops[0]} ${nums[1]}`;
          answer = calculateAnswer(nums, ops, 0);
        }
        typeForProblemObject = 'mixed_parentheses';
      } else if (problemType === 'fraction_add_subtract_different_denominators' || problemType === 'fraction_multiply_divide'){
        // TODO: 分数計算ロジック (別途実装)
        // 現状はフォールバックに流すか、簡易的な整数問題で代替
        console.warn(`ADVANCED: Fraction problem type '${problemType}' selected but not yet implemented. Falling back or using simple int.`);
        return generateFallbackProblem(difficulty, currentSeed + 500); //仮
      }
    }

    if (answer === undefined || 
        !Number.isFinite(answer) || 
        (!params.allowNegativeResult && answer < 0) || 
        (params.forceIntegerResult && !Number.isInteger(answer)) ||
        (params.maxResultValue !== undefined && Math.abs(answer) > params.maxResultValue) ||
        (questionStr.length === 0) || 
        !isCleanNumber(answer, allowedDecimalPlaces)) 
    {
      console.log(`[genSingleInternal Debug] Validation failed (attempt ${attempts}, type: ${typeForProblemObject}, Q: ${questionStr || 'N/A'}, A: ${answer}). Conditions: answer=${answer}, finite=${Number.isFinite(answer)}, negativeOK=${params.allowNegativeResult}, integerOK=${!params.forceIntegerResult || Number.isInteger(answer)}, maxValueOK=${params.maxResultValue === undefined || Math.abs(answer) <= params.maxResultValue}, cleanNum=${answer !== undefined ? isCleanNumber(answer, allowedDecimalPlaces): 'N/A'}`);
      continue; 
    }
    
    const optionsForProblem = generateOptions(answer, difficulty, currentSeed + 2000); 

    const problem = {
      id: '', 
      question: questionStr,
        answer,
      options: optionsForProblem,
      difficulty, 
      type: typeForProblemObject, 
      seed: currentSeed 
    };
    
    if (!problemCache[difficulty]) problemCache[difficulty] = new Map();
    problemCache[difficulty].set(cacheKey, problem);
    return problem;
  }

  console.warn(`[ProblemGenerator] Max attempts reached for difficulty ${difficulty}, seed ${seed}. Generating fallback.`);
  return generateFallbackProblem(difficulty, seed + attempts);
};

/**
 * 除算が整数になる割り算問題を生成する
 */
const generateCleanDivisionProblem = (calculationOps, seed, params) => {
  if (!calculationOps.includes('÷')) return null;
  
  // シードに基づいた乱数生成
  const divisor = getRandomInt(2, 12, seed);
  const maxQuotient = Math.floor(params.maxValue / divisor);
  const quotient = getRandomInt(1, maxQuotient, seed + 1000);
  
  // 答えが整数になる割り算問題を作成
  const dividend = divisor * quotient;
  
  // 問題文を作成
  const question = `${dividend} ÷ ${divisor}`;
  const answer = quotient;
  
  // シードを使って選択肢を生成
  const options = generateOptions(answer, params.difficulty || 'beginner', seed + 2000);
  
  return {
    question,
    answer,
    options,
    type: 'division'
  };
};

// フォールバック問題生成（生成失敗時の代替）
const generateFallbackProblem = async (difficulty, seed) => {
  const seedMod = Math.abs(seed) % 1000;
  const a = 1 + (seedMod % 9);
  const b = 2 + (Math.floor(seedMod / 10) % 8);
  const answer = a + b;
  const options = [answer];
  while (options.length < 4) {
    const offset = [-2, -1, 1, 2, 3][Math.floor(seededRandom(seed + options.length * 100) * 5)];
    const wrongAnswer = answer + offset;
    if (!options.includes(wrongAnswer) && wrongAnswer > 0) {
      options.push(wrongAnswer);
    }
  }
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 100) * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const { v4: uuidv4 } = await import('uuid');
  return {
    id: uuidv4(),
    question: `${a} + ${b} = ?`,
    answer: answer,
    options: options,
    type: 'addition'
  };
};

// ここに、簡易な問題生成関数を追加（エラー回避用）
const generateSimpleProblem = async (difficulty, seed) => {
  const seedMod = Math.abs(seed) % 1000;
  let a, b, c, operation, answer, question;
  switch(difficulty) {
    case DifficultyRank.BEGINNER:
      a = 1 + (seedMod % 9);
      b = 1 + ((seedMod + 10) % 9);
      answer = a + b;
      question = `${a} + ${b} = ?`;
      break;
    case DifficultyRank.INTERMEDIATE:
      a = 5 + (seedMod % 15);
      b = 2 + ((seedMod + 20) % 8);
      operation = Math.floor(seededRandom(seed * 2) * 4);
      if (operation === 0) {
        answer = a + b;
        question = `${a} + ${b} = ?`;
      } else if (operation === 1) {
        if (a < b) [a, b] = [b, a];
        answer = a - b;
        question = `${a} - ${b} = ?`;
      } else if (operation === 2) {
        answer = a * b;
        question = `${a} × ${b} = ?`;
      } else {
        c = a * b;
        answer = b;
        question = `${c} ÷ ${a} = ?`;
      }
      break;
    case DifficultyRank.ADVANCED:
    case DifficultyRank.EXPERT:
    default:
      a = 5 + (seedMod % 15);
      b = 2 + ((seedMod + 25) % 18);
      c = 2 + ((seedMod + 50) % 13);
      answer = a + b - c;
      question = `${a} + ${b} - ${c} = ?`;
      break;
  }
  const options = generateOptions(answer, difficulty, seed);
  const { v4: uuidv4 } = await import('uuid');
  return {
    id: uuidv4(),
    question,
    answer,
    options
  };
};

// 既存の問題生成ロジックで問題が生成できない場合のフォールバック処理を強化
const generateSingleProblem = async (difficulty, seed) => {
  try {
    const problem = await generateSingleProblemInternal(difficulty, seed);
    if (problem && problem.question && Number.isFinite(problem.answer)) {
      const { v4: uuidv4 } = await import('uuid');
      return { ...problem, id: uuidv4() };
    }
    console.warn(`Failed to generate problem using normal algorithm. Using simplified generator for ${difficulty}`);
    const simpleProblem = await generateSimpleProblem(difficulty, seed);
    if (simpleProblem) {
      const { v4: uuidv4 } = await import('uuid');
      return { ...simpleProblem, id: uuidv4() };
    }
    throw new Error('Simplified generator also failed');
  } catch (error) {
    console.error(`Error in problem generation: ${error.message}. Using fallback.`);
    const fallbackProblem = await generateFallbackProblem(difficulty, seed);
    const { v4: uuidv4 } = await import('uuid');
    return { ...fallbackProblem, id: uuidv4() };
  }
};

// 進行状況をリセットする関数
const resetProcessingStatus = (requestId) => {
  if (processingStatusMap.has(requestId)) {
    processingStatusMap.delete(requestId);
  }
};

// 難易度ごとの問題生成
const generateProblemsByDifficulty = async (difficulty, count = 10, requestId = null) => {
    const problems = [];
    const baseSeed = getDateSeed();
    const startTime = Date.now();
    
    if (requestId) {
      processingStatusMap.set(requestId, {
        startTime,
        difficulty,
        count,
        progress: 0,
        status: 'processing'
      });
    }

    const actualCount = difficulty === DifficultyRank.EXPERT && count > 10 ? 10 : count;
    if (difficulty === DifficultyRank.EXPERT && count > 10) {
      console.warn(`[ProblemGenerator] Expert難易度では最大10問に制限されています (${count}要求 -> 10生成)`);
    }

    let generatedCount = 0;
    let generationAttempts = 0;
    const maxGenerationAttempts = actualCount * 15;
    const usedQuestions = new Set();

    for (let i = 0; i < actualCount && generationAttempts < maxGenerationAttempts; i++) {
        generationAttempts++;
        
        if (checkTimeout(startTime, 25000)) {
          console.warn(`[generateProblemsByDifficulty] Timeout detected after generating ${generatedCount} problems. Returning partial results.`);
          
          if (requestId) {
            processingStatusMap.set(requestId, {
              ...processingStatusMap.get(requestId),
              progress: (generatedCount / actualCount) * 100,
              status: 'timeout',
              endTime: Date.now()
            });
          }
          
          return problems;
        }
        
        const seed = baseSeed + i * 1000 + generationAttempts;
        const problemData = await generateSingleProblem(difficulty, seed);

        if (problemData && !usedQuestions.has(problemData.question) && problemData.id) {
            problems.push({ 
               id: problemData.id,
               question: problemData.question,
               answer: problemData.answer,
               options: problemData.options
            });
            usedQuestions.add(problemData.question);
            generatedCount++;
            
            if (requestId) {
              processingStatusMap.set(requestId, {
                ...processingStatusMap.get(requestId),
                progress: (generatedCount / actualCount) * 100
              });
            }
        } else {
            i--;
        }
    }

    if (requestId) {
      processingStatusMap.set(requestId, {
        ...processingStatusMap.get(requestId),
        progress: 100,
        status: generatedCount < actualCount ? 'partial' : 'completed',
        endTime: Date.now()
      });
    }

    if (generatedCount < actualCount) {
         console.warn(`[ProblemGenerator] 要求された${actualCount}問のうち、${generatedCount}問のみ生成されました`);
    }
    return problems;
};

/**
 * @desc    指定された難易度の問題を生成する関数
 * @param {string} difficulty - 難易度
 * @param {number} count - 生成する問題数
 * @param {number|string} seed - 決定論的生成のためのシード値（省略可）
 * @param {string} requestId - 処理状態追跡用ID
 * @returns {Array} 生成された問題のリスト
 */
export const generateProblems = async (difficulty, count = 10, seed = null, requestId = null) => {
  try {
    const actualSeed = seed || Date.now();
    console.log(`[ProblemGenerator] ${count}問の生成開始 (${difficulty}) シード値: ${actualSeed}`);
    
    if (requestId) {
      const now = Date.now();
      processingStatusMap.set(requestId, {
        startTime: now,
        status: 'processing',
        params: { difficulty, count },
        progress: 0
      });
    }
    
    const startTime = performance.now();
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    
    let seedValue = typeof actualSeed === 'string' 
      ? actualSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : Number(actualSeed);
    
    const problems = [];
    const maxAttempts = count * 5;
    let attempts = 0;
    
    const generateLoop = async () => {
    while (problems.length < count && attempts < maxAttempts) {
      attempts++;
      const problemSeed = seedValue + attempts * 1000;
      try {
          const problem = await generateSingleProblem(difficulty, problemSeed);
        
          if (problem && problem.answer !== undefined && problem.id) {
          const isDuplicate = problems.some(p => p.question === problem.question);
          if (!isDuplicate) {
            problems.push(problem);
            if (requestId) {
              const progress = Math.round((problems.length / count) * 100);
              processingStatusMap.set(requestId, {
                ...processingStatusMap.get(requestId),
                progress,
                  problems: [...problems],
              });
            }
            } else {
              console.log(`[generateLoop Debug] Duplicate problem skipped: ${problem.question}`); 
          }
          } else {
            console.log(`[generateLoop Debug] Invalid problem object received from generateSingleProblem (seed: ${problemSeed}):`, problem);
        }
      } catch (error) {
          console.warn(`[generateLoop Debug] Error during generateSingleProblem (seed: ${problemSeed}, attempt: ${attempts}): ${error.message}`);
      }
      if (requestId && checkTimeout(startTime) && problems.length > 0) {
        console.warn(`問題生成がタイムアウト: ${problems.length}/${count}問生成済み`);
        processingStatusMap.set(requestId, {
          ...processingStatusMap.get(requestId),
          status: 'timeout',
          endTime: Date.now()
        });
        break;
      }
    }
    };
    
    await generateLoop();

    if (problems.length === 0) {
      console.warn(`問題生成に失敗したため、フォールバック問題を使用します`);
      for (let i = 0; i < Math.min(count, 5); i++) {
        const fallbackSeed = seedValue + i * 1000;
        problems.push(await generateFallbackProblem(difficulty, fallbackSeed));
      }
    }
    
    const endTime = performance.now();
    console.log(`[ProblemGenerator] ${problems.length}問の生成完了 (${difficulty}). 所要時間: ${(endTime - startTime).toFixed(2)}ms`);
    if (requestId) {
      processingStatusMap.set(requestId, {
        ...processingStatusMap.get(requestId),
        status: 'completed',
        endTime: Date.now(),
        count: problems.length
      });
    }
    
    return problems.map(p => ({
      id: p.id,
      question: p.question,
      answer: p.answer,
      options: p.options
    }));
  } catch (error) {
    console.error('[ProblemGenerator] 問題生成中の重大エラー:', error);
    console.error("Error Name: ", error.name);
    console.error("Error Message: ", error.message);
    if (error.stack) {
        console.error("Error Stack: ", error.stack);
    }
    return [];
  }
};

// 処理状況の取得関数を追加
export const getProcessingStatus = (requestId) => {
  if (!requestId || !processingStatusMap.has(requestId)) {
    return null;
  }
  return processingStatusMap.get(requestId);
};

// ensureProblemsForToday と generateProblemsForNextDay を async に変更
const ensureProblemsForToday = async () => {
    try {
        const today = getTodayDateStringJST();
        console.log(`[Init] ${today} の問題存在確認...`);
        let problemsGenerated = false;
      for (const difficulty of Object.values(DifficultyRank)) {
            const existingSet = await DailyProblemSet.findOne({ date: today, difficulty });
        if (!existingSet) {
                console.log(`[Init] ${today} の ${difficulty} 問題が存在しないため生成します...`);
                const seed = `${today}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const problems = await generateProblems(difficulty, 10, seed);
                if (problems && problems.length > 0) {
                    await DailyProblemSet.create({
                        date: today,
                        difficulty,
                        problems: problems.map(p => ({ id: p.id, question: p.question, correctAnswer: p.answer, options: p.options }))
                    });
                    console.log(`[Init] ${today} の ${difficulty} 問題 (${problems.length}問) を生成・保存しました。`);
                    problemsGenerated = true;
                } else {
                    console.error(`[Init] ${today} の ${difficulty} 問題の生成に失敗しました。`);
                }
            }
        }
        if (!problemsGenerated) {
            console.log(`[Init] ${today} の全難易度の問題は既に存在します。`);
        }
    } catch (error) {
        console.error('[Init] 今日の問題確認/生成中にエラー:', error);
    }
};

const generateProblemsForNextDay = async () => {
  try {
    const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
    console.log(`[自動生成] ${tomorrow}の問題セットを生成します...`);
    for (const difficulty of Object.values(DifficultyRank)) {
      const existingSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
      if (existingSet) {
        console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題セットは既に存在します。スキップします。`);
        continue;
      }
      console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題を生成します...`);
      try {
        const seed = `${tomorrow}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const problems = await generateProblems(difficulty, 10, seed);
        if (!problems || problems.length === 0) {
          console.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成に失敗しました。`);
          continue;
        }
        const newProblemSet = new DailyProblemSet({
          date: tomorrow,
          difficulty,
          problems: problems.map(p => ({
            id: p.id,
            question: p.question,
            correctAnswer: p.answer,
            options: p.options
          }))
        });
        await newProblemSet.save();
        console.log(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成完了 (${problems.length}問)`);
      } catch (error) {
        console.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成中にエラー:`, error);
      }
    }
    console.log(`[自動生成] ${tomorrow}の全難易度の問題生成が完了しました。`);
  } catch (error) {
    console.error('[自動生成] 翌日問題の生成中にエラー:', error);
  }
}; 