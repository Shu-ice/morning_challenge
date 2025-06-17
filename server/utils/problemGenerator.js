// server/utils/problemGenerator.js

const { logger } = require('./logger');
import dayjs from 'dayjs'; // 追加: generateProblemsForNextDay で使用
import DailyProblemSet from '../models/DailyProblemSet.js'; // 追加: generateProblemsForNextDay で使用
import { DifficultyRank } from '../constants/difficultyRank.js'; // 独立ファイルからインポート

// DifficultyRank をバックエンドで定義（削除）
export { DifficultyRank } from '../constants/difficultyRank.js'; // 再エクスポート

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
        logger.error("[BE_calculateAnswer] Invalid input length");
        return undefined;
    }
    if (nums.some(isNaN) || nums.some(n => !Number.isFinite(n))) {
        logger.error("[BE_calculateAnswer] Invalid number input");
        return undefined;
    }

    for (let i = 0; i < ops.length; i++) {
        if (ops[i] === '÷') {
            const divisor = nums[i + 1];
            if (divisor === 0) {
                logger.warn(`[BE_calculateAnswer] Zero division detected`);
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
                 logger.warn(`[BE_calculateAnswer] Infinite result after Mul/Div`);
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
        logger.error("[BE_calculateAnswer] Final result is Infinity or NaN");
          return undefined;
    }

    return finalResult;
};

const isCleanNumber = (num, allowedDecimalPlaces) => {
    logger.debug(`[isCleanNumber DEBUG] Input: num=${num}, allowedDecimalPlaces=${allowedDecimalPlaces}`);

    if (!Number.isFinite(num)) {
        logger.debug(`[isCleanNumber DEBUG] Result: false (num is not finite: ${num})`);
        return false;
    }

    // 整数チェック (ほぼ整数とみなせるか)
    if (Math.abs(num - Math.round(num)) < 1e-9) {
        if (allowedDecimalPlaces >= 0) { // どんな小数点以下の桁数指定でも整数はOK
            logger.debug(`[isCleanNumber DEBUG] Result: true (num is effectively integer: ${num})`);
            return true;
        }
    }

    // 小数点以下の桁数チェック
    const s = String(num);
    const decimalPart = s.split('.')[1];

    if (!decimalPart) { // 小数点がない (整数だが上記でtrueにならなかったケース、例: allowedDecimalPlaces < 0 はありえないが念のため)
        logger.debug(`[isCleanNumber DEBUG] Result: true (num is integer string: ${s}, no decimal part)`);
        return true; 
    }

    // 末尾の0を除いた実際の小数部の長さを取得
    const actualDecimalLength = decimalPart.replace(/0+$/, '').length;
    
    if (actualDecimalLength > allowedDecimalPlaces) {
        logger.debug(`[isCleanNumber DEBUG] Result: false (actualDecimalLength ${actualDecimalLength} > allowedDecimalPlaces ${allowedDecimalPlaces} for num ${num})`);
        return false;
    }

    // 指定された桁数で丸めた際に元の数値とほぼ同じかチェック (浮動小数点誤差対策)
    // allowedDecimalPlaces が 0 の場合は整数との比較になる
    const factor = Math.pow(10, allowedDecimalPlaces);
    const roundedNum = Math.round(num * factor) / factor;

    if (Math.abs(num - roundedNum) >= 1e-9) { // 1e-9 は許容誤差
        logger.debug(`[isCleanNumber DEBUG] Result: false (num ${num} vs roundedNum ${roundedNum} difference is too large)`);
        return false;
    }
    
    logger.debug(`[isCleanNumber DEBUG] Result: true (num ${num} passed all checks for allowedDecimalPlaces ${allowedDecimalPlaces})`);
    return true;
};

// ★ 難易度に基づくパラメータ設定（日本の小学生学習指導要領準拠）
const getParamsForDifficulty = (difficulty) => {
    switch (difficulty) {
        case DifficultyRank.BEGINNER: // 初級（小学1・2年生相当）
            return {
                problemTypes: [
                    'add_subtract_2digit',      // 2けた同士のたしざん・ひきざん
                    'add_subtract_3digit_2digit', // 3けたと2けたのたしざん・ひきざん
                    'multiplication_table'       // 九九
                ],
                problemComposition: {
                    'add_subtract_2digit': 3,      // 3問
                    'add_subtract_3digit_2digit': 3, // 3問
                    'multiplication_table': 4       // 4問
                },
                digitRanges: { 
                    add_subtract_2digit: {
                        num1: [10, 99],    // 2けた
                        num2: [10, 99]     // 2けた
                    },
                    add_subtract_3digit_2digit: {
                        num1: [100, 999],  // 3けた
                        num2: [10, 99]     // 2けた
                    },
                    multiplication_table: {
                        num1: [1, 9],      // 1けた
                        num2: [1, 9]       // 1けた
                    }
                },
                ops: ['+', '-', '×'], 
                forceIntegerResult: true,
                allowNegativeResult: false,
                maxResultValue: 1000,
                decimals: 0
            };
            
        case DifficultyRank.INTERMEDIATE: // 中級（小学3・4年生相当）
            return {
                problemTypes: [
                    'add_subtract_4digit',      // 4けたと3けた/4けたのたしざん・ひきざん
                    'multiply_2digit_2digit',   // 2けた×2けたのかけざん
                    'multiply_3digit_2digit',   // 3けた×2けたのかけざん
                    'divide_3digit_1digit',     // 3けた÷1けたのわりざん
                    'divide_3digit_2digit'      // 3けた÷2けたのわりざん
                ],
                problemComposition: {
                    'add_subtract_4digit': 2,      // 2問
                    'multiply_2digit_2digit': 2,   // 2問
                    'multiply_3digit_2digit': 2,   // 2問
                    'divide_3digit_1digit': 2,     // 2問
                    'divide_3digit_2digit': 2      // 2問
                },
                digitRanges: {
                    add_subtract_4digit: {
                        num1: [1000, 9999],  // 4けた
                        num2: [100, 9999]    // 3けた～4けた
                    },
                    multiply_2digit_2digit: {
                        num1: [10, 99],      // 2けた
                        num2: [10, 99]       // 2けた
                    },
                    multiply_3digit_2digit: {
                        num1: [100, 999],    // 3けた
                        num2: [10, 99]       // 2けた
                    },
                    divide_3digit_1digit: {
                        // 割り切れる数を作るために逆算で生成
                        divisor: [2, 9],     // 1けた（1は除く）
                        quotient: [100, 999] // 商が3けた
                    },
                    divide_3digit_2digit: {
                        // 割り切れる数を作るために逆算で生成
                        divisor: [10, 99],   // 2けた
                        quotient: [10, 99]   // 商が2けた
                    }
                },
                ops: ['+', '-', '×', '÷'],
                forceIntegerResult: true,
                allowNegativeResult: false,
                maxResultValue: 100000,
                decimals: 0
            };
            
        case DifficultyRank.ADVANCED: // 上級（小学5・6年生相当）
            return {
                problemTypes: [
                    'add_subtract_5digit',      // 5けたと4けた/5けたのたしざん・ひきざん
                    'multiply_4digit_2digit',   // 4けた×2けたのかけざん
                    'multiply_4digit_3digit',   // 4けた×3けたのかけざん
                    'divide_4digit_2digit',     // 4けた÷2けたのわりざん
                    'divide_5digit_3digit'      // 5けた÷3けたのわりざん
                ],
                problemComposition: {
                    'add_subtract_5digit': 2,      // 2問
                    'multiply_4digit_2digit': 2,   // 2問
                    'multiply_4digit_3digit': 2,   // 2問
                    'divide_4digit_2digit': 2,     // 2問
                    'divide_5digit_3digit': 2      // 2問
                },
                digitRanges: {
                    add_subtract_5digit: {
                        num1: [10000, 99999], // 5けた
                        num2: [1000, 99999]   // 4けた～5けた
                    },
                    multiply_4digit_2digit: {
                        num1: [1000, 9999],   // 4けた
                        num2: [10, 99]        // 2けた
                    },
                    multiply_4digit_3digit: {
                        num1: [1000, 9999],   // 4けた
                        num2: [100, 999]      // 3けた
                    },
                    divide_4digit_2digit: {
                        // 割り切れる数を作るために逆算で生成
                        divisor: [10, 99],    // 2けた
                        quotient: [100, 999]  // 商が3けた
                    },
                    divide_5digit_3digit: {
                        // 割り切れる数を作るために逆算で生成
                        divisor: [100, 999],  // 3けた
                        quotient: [100, 999]  // 商が3けた
                    }
                },
                ops: ['+', '-', '×', '÷'],
                forceIntegerResult: true,
                allowNegativeResult: false,
                maxResultValue: 1000000,
                decimals: 0
            };
            
        case DifficultyRank.EXPERT: // 超級（小学生上級者・中学準備）
            return {
                problemTypes: [
                    'add_subtract_6digit',      // 6けたと5けた/6けたのたしざん・ひきざん
                    'multiply_5digit_3digit',   // 5けた×3けたのかけざん
                    'multiply_5digit_4digit',   // 5けた×4けたのかけざん
                    'divide_5digit_3digit',     // 5けた÷3けたのわりざん
                    'divide_6digit_4digit'      // 6けた÷4けたのわりざん
                ],
                problemComposition: {
                    'add_subtract_6digit': 2,      // 2問
                    'multiply_5digit_3digit': 2,   // 2問
                    'multiply_5digit_4digit': 2,   // 2問
                    'divide_5digit_3digit': 2,     // 2問
                    'divide_6digit_4digit': 2      // 2問
                },
                digitRanges: {
                    add_subtract_6digit: {
                        num1: [100000, 999999], // 6けた
                        num2: [10000, 999999]   // 5けた～6けた
                    },
                    multiply_5digit_3digit: {
                        num1: [10000, 99999],   // 5けた
                        num2: [100, 999]        // 3けた
                    },
                    multiply_5digit_4digit: {
                        num1: [10000, 99999],   // 5けた
                        num2: [1000, 9999]      // 4けた
                    },
                    divide_5digit_3digit: {
                        // 割り切れる数を作るために逆算で生成
                        divisor: [100, 999],    // 3けた
                        quotient: [100, 999]    // 商が3けた
                    },
                    divide_6digit_4digit: {
                        // 割り切れる数を作るために逆算で生成
                        divisor: [1000, 9999],  // 4けた
                        quotient: [100, 999]    // 商が3けた
                    }
                },
                ops: ['+', '-', '×', '÷'],
                forceIntegerResult: true,
                allowNegativeResult: false,
                maxResultValue: 1000000000, // 10億に増加（5桁×4桁の掛け算に対応）
                decimals: 0
            };
            
        default:
            return {
                problemTypes: ['add_subtract_2digit'],
                problemComposition: { 'add_subtract_2digit': 10 },
                digitRanges: { add_subtract_2digit: { num1: [10, 99], num2: [10, 99] } },
                ops: ['+', '-'],
                forceIntegerResult: true,
                allowNegativeResult: false,
                maxResultValue: 200,
                decimals: 0
            };
    }
};

// 選択肢生成関数
const generateOptions = (answer, difficulty, seed) => {
    // 既存のロジック（問題なし）
    if (answer === undefined) {
        logger.error("[BE_generateOptions] Answer is undefined");
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

    while (options.length < 4 && attempts < maxAttempts * 4) { // maxAttempts * 4 = 400
        attempts++;
        let option;
        const offsetMagnitude = getRandomInt(-rangeMagnitude, rangeMagnitude, seed + attempts * 10);
        const offset = isDecimal ? offsetMagnitude / factor : offsetMagnitude;

        option = Math.round((roundedAnswer + offset) * factor) / factor;
        if (Object.is(option, -0)) option = 0; // Avoid -0

        // CORRECTED CONDITION: Allow negative options if params.allowNegativeResult is true
        if (!options.includes(option) && option !== roundedAnswer && (params.allowNegativeResult || option >= 0)) {
            options.push(option);
        }
    }

    // Loop 2: Fallback options if not enough were generated
    const fallbackMaxAttempts = maxAttempts * 4; // Ensure this loop also contributes to total attempts and terminates
    while(options.length < 4 && attempts < fallbackMaxAttempts) { 
       attempts++; // Increment total attempts
       
       let fallbackOptionBaseValue = Math.max(10, Math.abs(roundedAnswer) * 2 + 10); 
       let fallbackOption = getRandomInt(0, Math.round(fallbackOptionBaseValue * factor), seed + attempts + options.length * 2) / factor;
       
       if (params.allowNegativeResult && roundedAnswer < 0 && seededRandom(seed + attempts * 5) > 0.5) {
           fallbackOption = -fallbackOption;
       }
       if (isDecimal) fallbackOption = parseFloat(fallbackOption.toFixed(decimals));
       if (Object.is(fallbackOption, -0)) fallbackOption = 0; // Avoid -0

        // CORRECTED CONDITION: Allow negative options if params.allowNegativeResult is true
        if (!options.includes(fallbackOption) && fallbackOption !== roundedAnswer && (params.allowNegativeResult || fallbackOption >= 0)) {
             options.push(fallbackOption);
        }
    }

    // Ensure options array always has 4 elements (robust padding)
    if (options.length < 4) {
        logger.warn(`[BE_generateOptions] Generated only ${options.length} options for answer ${roundedAnswer} (difficulty: ${difficulty}). Padding to ensure 4.`);
        let padAttempt = 0;
        const baseStep = Number.isInteger(roundedAnswer) ? 1 : Math.pow(10, -decimals); // Define a base step for padding, e.g., 1 or 0.1 or 0.01

        while (options.length < 4 && padAttempt < 20) { // Limit padding attempts
            padAttempt++;
            // Try positive and negative offsets from the answer, scaled by attempt
            let potentialOption = roundedAnswer + (baseStep * padAttempt * (padAttempt % 2 === 0 ? 1 : -1));

            if (isDecimal) {
                potentialOption = parseFloat(potentialOption.toFixed(decimals));
            } else {
                potentialOption = Math.round(potentialOption);
            }
            if (Object.is(potentialOption, -0)) potentialOption = 0;

            if (!options.includes(potentialOption) &&
                potentialOption !== roundedAnswer &&
                (params.allowNegativeResult || potentialOption >= 0)) {
                options.push(potentialOption);
            }
        }

        // If still not enough, add more distinct, potentially random, valid options
        let finalPadAttempt = 0;
        while (options.length < 4 && finalPadAttempt < 20) { // Limit final padding attempts
            finalPadAttempt++;
            let genericOption;
            // Generate a somewhat random number, then adjust to be valid
            genericOption = (Math.random() - 0.5) * 2 * Math.max(10, Math.abs(roundedAnswer) * 2); // Spread around answer's magnitude
            genericOption += roundedAnswer; // Center it near answer initially

            if (isDecimal) genericOption = parseFloat(genericOption.toFixed(decimals));
            else genericOption = Math.round(genericOption);
            
            if (!params.allowNegativeResult && genericOption < 0) {
                genericOption = Math.abs(genericOption); // Make positive if needed
            }
            if (isDecimal) genericOption = parseFloat(genericOption.toFixed(decimals)); // Re-apply decimal fix
            if (Object.is(genericOption, -0)) genericOption = 0;

            if (!options.includes(genericOption) && genericOption !== roundedAnswer) {
                 options.push(genericOption);
            }
        }
        
        // Ultra-final resort: ensure 4 unique numbers, can be very random if all else failed
        options = Array.from(new Set(options)); // Make unique
        let emergencyIdx = 0;
        while(options.length < 4){
            let fillValue = parseFloat((Math.random() * 200 - 100 + emergencyIdx).toFixed(decimals));
            if(!params.allowNegativeResult && fillValue < 0) fillValue = Math.abs(fillValue);
            if(Object.is(fillValue, -0)) fillValue = 0;
            
            // Ensure it's distinct from existing options and the answer
            if(!options.includes(fillValue) && fillValue !== roundedAnswer) {
                options.push(fillValue);
            } else { // if collision, just use a timestamp-randomized value
                options.push(parseFloat((Date.now()%10000 + Math.random()*100 + emergencyIdx).toFixed(decimals)));
            }
            emergencyIdx++;
            if (emergencyIdx > 20 && options.length < 4) { // Prevent infinite loop in extreme edge case
                 options.push(Date.now() + Math.random()); // Push definitely unique value
            }
        }
        options = Array.from(new Set(options)).slice(0,4); // Final cut to 4 unique
         // One last check for length, if Set reduced it below 4
        while(options.length < 4) {
            options.push(parseFloat((Date.now() + Math.random() + options.length).toFixed(decimals)));
        }
        options = options.slice(0,4); // Absolutely ensure it is 4
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
    if (difficulty === DifficultyRank.BEGINNER) return 'add_subtract_2digit'; // デフォルト変更
    logger.warn(`[selectProblemType] No problemTypes defined for ${difficulty}, or empty.`);
    return params.ops && params.ops.length > 0 ? 'generic_calculation' : null; 
  }

  const randomValue = seededRandom(seed);
  let cumulativePercentage = 0;

  if (difficulty === DifficultyRank.BEGINNER && params.problemComposition) {
    const spec = params.problemComposition;
    const mtPercentage = params.problemTypes.includes('multiplication_table') ? (spec.multiplication_table || 0) : 0;

    cumulativePercentage += mtPercentage;
    if (randomValue < cumulativePercentage && params.problemTypes.includes('multiplication_table')) return 'multiplication_table';

    // 残りが add_subtract_2digit しかない場合はそれを返す
    if (params.problemTypes.includes('add_subtract_2digit')) return 'add_subtract_2digit';
    
    // フォールバック（通常ここには来ないはず）
    return params.problemTypes[0];

  } else if (difficulty === DifficultyRank.INTERMEDIATE && params.problemComposition) {
    const spec = params.problemComposition;
    const randomValue = seededRandom(seed);

    // 問題タイプの選択（割合に基づく）
    if (randomValue < spec.add_subtract_4digit) {
      // 4けたと3けた/4けたのたしざん・ひきざん問題（20%）
      return 'add_subtract_4digit';
    } else if (randomValue < (spec.add_subtract_4digit + spec.multiply_2digit_2digit)) {
      // 2けた×2けたのかけざん問題（20%）
      return 'multiply_2digit_2digit';
    } else if (randomValue < (spec.add_subtract_4digit + spec.multiply_2digit_2digit + spec.multiply_3digit_2digit)) {
      // 3けた×2けたのかけざん問題（20%）
      return 'multiply_3digit_2digit';
    } else if (randomValue < (spec.add_subtract_4digit + spec.multiply_2digit_2digit + spec.multiply_3digit_2digit + spec.divide_3digit_1digit)) {
      // 3けた÷1けたのわりざん問題（20%）
      return 'divide_3digit_1digit';
    } else {
      // 3けた÷2けたのわりざん問題（20%）
      return 'divide_3digit_2digit';
    }
  } else if (difficulty === DifficultyRank.ADVANCED && params.problemComposition) {
    const spec = params.problemComposition;
    const randomVal = seededRandom(seed + 200); // シード値を他と変える
    if (randomVal < spec.add_subtract_5digit) {
      // 5けたと4けた/5けたのたしざん・ひきざん問題 (40%)
      return 'add_subtract_5digit';
    } else if (randomVal < (spec.add_subtract_5digit + spec.multiply_4digit_2digit)) {
      // 4けた×2けたのかけざん問題 (20%)
      return 'multiply_4digit_2digit';
    } else if (randomVal < (spec.add_subtract_5digit + spec.multiply_4digit_2digit + spec.multiply_4digit_3digit)) {
      // 4けた×3けたのかけざん問題 (20%)
      return 'multiply_4digit_3digit';
    } else if (randomVal < (spec.add_subtract_5digit + spec.multiply_4digit_2digit + spec.multiply_4digit_3digit + spec.divide_4digit_2digit)) {
      // 4けた÷2けたのわりざん問題 (10%)
      return 'divide_4digit_2digit';
    } else {
      // 5けた÷3けたのわりざん問題 (10%)
      return 'divide_5digit_3digit';
    }
  } else if (difficulty === DifficultyRank.EXPERT && params.problemComposition) {
    const spec = params.problemComposition;
    const randomVal = seededRandom(seed + 300);
    if (randomVal < spec.add_subtract_6digit) {
      // 6けたと5けた/6けたのたしざん・ひきざん問題 (40%)
      return 'add_subtract_6digit';
    } else if (randomVal < (spec.add_subtract_6digit + spec.multiply_5digit_3digit)) {
      // 5けた×3けたのかけざん問題 (20%)
      return 'multiply_5digit_3digit';
    } else if (randomVal < (spec.add_subtract_6digit + spec.multiply_5digit_3digit + spec.multiply_5digit_4digit)) {
      // 5けた×4けたのかけざん問題 (20%)
      return 'multiply_5digit_4digit';
    } else if (randomVal < (spec.add_subtract_6digit + spec.multiply_5digit_3digit + spec.multiply_5digit_4digit + spec.divide_5digit_3digit)) {
      // 5けた÷3けたのわりざん問題 (10%)
      return 'divide_5digit_3digit';
    } else {
      // 6けた÷4けたのわりざん問題 (10%)
      return 'divide_6digit_4digit';
    }
  }
  
  const typeIndex = getRandomInt(0, params.problemTypes.length - 1, seed + 1); 
  return params.problemTypes[typeIndex];
};

// 単一問題生成関数
const generateSingleProblemInternal = async (difficulty, seed) => {
    const funcStartTime = Date.now();
    logger.debug(`[ProblemGenerator DEBUG] generateSingleProblemInternal CALLED - difficulty: ${difficulty}, seed: ${seed}`);

    const params = getParamsForDifficulty(difficulty);
  let attempts = 0;
    const MAX_ATTEMPTS_INTERNAL = params.maxAttempts || 200; // 難易度ごとに設定可能に、デフォルト200
    let problem = null;
    let problemType = "unknown"; // 初期化
    let lastError = null;

    try {
        while (attempts < MAX_ATTEMPTS_INTERNAL) {
    attempts++;
            const currentSeed = seed + attempts; // 試行ごとにシードを変更
            problemType = selectProblemType(difficulty, currentSeed); // ループ内で問題タイプを再選択する可能性も考慮

            logger.debug(`[ProblemGenerator DEBUG] Attempt #${attempts}/${MAX_ATTEMPTS_INTERNAL} for ${difficulty} (seed: ${currentSeed}, type: ${problemType})`);

            let question, answer, options;
            let nums = [], ops = [];
            let generatedDetails = null;

            // --- ここから各問題タイプの生成ロジック (既存のものをベースにログ追加) ---
            // この部分は元の関数の構造に大きく依存するため、以下は例示的なログポイントです。
            // 実際のコードに合わせてログを挿入する必要があります。

            if (problemType === 'add_subtract_2digit') {
                const [range1, range2] = params.digitRanges.add_subtract_2digit;
                let num1 = getRandomInt(Math.pow(10, range1[0]-1), Math.pow(10, range1[1])-1, currentSeed + 1);
                let num2 = getRandomInt(Math.pow(10, range2[0]-1), Math.pow(10, range2[1])-1, currentSeed + 2);
                const opIndex = getRandomInt(0, 1, currentSeed + 3); // 0: +, 1: -
                const op = opIndex === 0 ? '+' : '-';

                if (op === '-' && num1 < num2 && !params.allowNegativeResult) {
                    [num1, num2] = [num2, num1]; // 結果が負にならないように入れ替え
                }
                question = `${num1} ${op} ${num2} = ?`;
                nums = [num1, num2];
                ops = [op];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated add_subtract_2digit: ${question}`);

            } else if (problemType === 'multiplication_table') {
                const num1 = getRandomInt(1, 9, currentSeed + 1);
                const num2 = getRandomInt(1, 9, currentSeed + 2);
                question = `${num1} × ${num2} = ?`;
        nums = [num1, num2];
        ops = ['×'];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated multiplication_table: ${question}`);

            } else if (problemType === 'add_subtract_4digit') {
                const op = seededRandom(currentSeed + 30) > 0.5 ? '+' : '-';
                const termRanges = params.digitRanges.add_subtract_4digit || [[2,3],[2,3]]; // Default from getParamsForDifficulty
                
                const num1Digits = getRandomInt(termRanges[0][0], termRanges[0][1], currentSeed + 31);
                const num2Digits = getRandomInt(termRanges[1][0], termRanges[1][1], currentSeed + 32);

                let num1 = getRandomInt(Math.pow(10, num1Digits - 1), Math.pow(10, num1Digits) - 1, currentSeed + 33);
                let num2 = getRandomInt(Math.pow(10, num2Digits - 1), Math.pow(10, num2Digits) - 1, currentSeed + 34);

                if (op === '-' && num1 < num2 && !params.allowNegativeResult) {
                    // Ensure num1 is greater or equal to num2 for subtraction if negative results are not allowed.
                    // This might involve swapping or regenerating one of the numbers.
                    // For simplicity here, we swap. More complex logic could regenerate to ensure variety.
                    [num1, num2] = [num2, num1];
                }
                // Further check if after potential swap, num1 - num2 would be negative
                // This can happen if allowNegativeResult is false, and previous swap wasn't enough or numbers were equal.
                if (op === '-' && (num1 - num2 < 0) && !params.allowNegativeResult) {
                    // This case should ideally be handled by careful range settings or more robust generation.
                    // If we reach here, it implies num1 was smaller, they were swapped, but num2 (original num1) is still too small.
                    // Or, they were equal, resulting in 0, which is fine.
                    // If it's still negative, one option is to regenerate or force a simpler case.
                    // For now, we rely on the initial swap. If result is still negative and not allowed, validation will catch it.
                    // console.warn(`[ProblemGenerator DEBUG] add_subtract_2_3digit: Subtraction might result in negative, num1=${num1}, num2=${num2}`);
                }

                question = `${num1} ${op} ${num2} = ?`;
        nums = [num1, num2];
                ops = [op];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated add_subtract_4digit: ${question}, Seed: ${currentSeed}`);
      } else if (problemType === 'multiply_2digit_2digit') {
                const termRanges = params.digitRanges.multiply_2digit_2digit || [[2,2],[2,2]]; // Default from getParamsForDifficulty
                
                const num1Digits = getRandomInt(termRanges[0][0], termRanges[0][1], currentSeed + 41);
                const num2Digits = getRandomInt(termRanges[1][0], termRanges[1][1], currentSeed + 42); // Should be 2-digit

                const num1 = getRandomInt(Math.pow(10, num1Digits - 1), Math.pow(10, num1Digits) - 1, currentSeed + 43);
                const num2 = getRandomInt(Math.pow(10, num2Digits - 1), Math.pow(10, num2Digits) - 1, currentSeed + 44);
                
                const op = '×';
                question = `${num1} ${op} ${num2} = ?`;
        nums = [num1, num2];
                ops = [op];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated multiply_2digit_2digit: ${question}, Seed: ${currentSeed}`);
            } else if (problemType === 'multiply_3digit_2digit') {
                const termRanges = params.digitRanges.multiply_3digit_2digit || [[2,3],[1,1]]; // Default from getParamsForDifficulty
                
                const num1Digits = getRandomInt(termRanges[0][0], termRanges[0][1], currentSeed + 51);
                const num2Digits = getRandomInt(termRanges[1][0], termRanges[1][1], currentSeed + 52); // Should typically be 1-digit

                const num1 = getRandomInt(Math.pow(10, num1Digits - 1), Math.pow(10, num1Digits) - 1, currentSeed + 53);
                const num2 = getRandomInt(Math.pow(10, num2Digits - 1), Math.pow(10, num2Digits) - 1, currentSeed + 54);
                
                const op = '×';
                question = `${num1} ${op} ${num2} = ?`;
        nums = [num1, num2];
                ops = [op];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated multiply_3digit_2digit: ${question}, Seed: ${currentSeed}`);
            } else if (problemType === 'divide_3digit_1digit') {
                const termRanges = params.digitRanges.divide_3digit_1digit || [[2,3],[1,1]]; // Default: (2-3 digit) / (1 digit)
                
                const divisorDigits = getRandomInt(termRanges[1][0], termRanges[1][1], currentSeed + 61);
                let divisor = getRandomInt(Math.pow(10, divisorDigits - 1), Math.pow(10, divisorDigits) - 1, currentSeed + 62);
                if (divisor === 0) divisor = 1; // Avoid division by zero, though range should prevent this.

                // To ensure a clean division and respect dividend digit range, we can determine a quotient range.
                const dividendMaxDigits = termRanges[0][1];
                const dividendMinDigits = termRanges[0][0];
                
                // Max possible quotient such that quotient * divisor approx Math.pow(10, dividendMaxDigits) - 1
                // Min possible quotient such that quotient * divisor approx Math.pow(10, dividendMinDigits - 1)
                let maxQuotient = Math.floor((Math.pow(10, dividendMaxDigits) -1) / divisor) ;
                let minQuotient = Math.ceil(Math.pow(10, dividendMinDigits - 1) / divisor);

                if (minQuotient === 0 && (Math.pow(10, dividendMinDigits -1) > 0) ) minQuotient = 1; // Ensure quotient is at least 1 if dividend is non-zero
                if (minQuotient > maxQuotient || maxQuotient <=0) { // Invalid quotient range, try to adjust divisor or skip
                     // This can happen if divisor is too large for the dividend range.
                     // Fallback: make divisor smaller or regenerate. For now, log and potentially skip.
                     logger.warn(`[ProblemGenerator WARN] divide_3digit_1digit: Divisor ${divisor} might be too large for dividend range ${dividendMinDigits}-${dividendMaxDigits} digits. MaxQ ${maxQuotient}, MinQ ${minQuotient}. Attempting to adjust divisor.`);
                     // Attempt to reduce divisor to a single digit number if it's not already
                     if (divisorDigits > 1) {
                         divisor = getRandomInt(2, 9, currentSeed + 622); // Fallback to simple 1-digit divisor (2-9)
                         maxQuotient = Math.floor((Math.pow(10, dividendMaxDigits) -1) / divisor) ;
                         minQuotient = Math.ceil(Math.pow(10, dividendMinDigits - 1) / divisor);
                         if (minQuotient === 0 && (Math.pow(10, dividendMinDigits -1) > 0) ) minQuotient = 1;
                     }
                     if (minQuotient > maxQuotient || maxQuotient <=0) { // Still bad
                         logger.error(`[ProblemGenerator ERROR] divide_3digit_1digit: Could not determine valid quotient range for divisor ${divisor}. Skipping.`);
                         lastError = `Invalid quotient range for divisor ${divisor}`;
                         continue; // Skip to next attempt in the while loop
                     }
                }

                const quotient = getRandomInt(minQuotient, maxQuotient, currentSeed + 63);
                const dividend = divisor * quotient;

                const op = '÷';
                question = `${dividend} ${op} ${divisor} = ?`;
                nums = [dividend, divisor];
                ops = [op];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated divide_3digit_1digit (clean): ${question}, Quotient: ${quotient}, Seed: ${currentSeed}`);
            } else if (problemType === 'divide_3digit_2digit') {
                const termRanges = params.digitRanges.divide_3digit_2digit || [[2,3],[1,1]]; // Default: (2-3 digit) / (1 digit)
                
                const divisorDigits = getRandomInt(termRanges[1][0], termRanges[1][1], currentSeed + 71);
                let divisor = getRandomInt(Math.pow(10, divisorDigits - 1), Math.pow(10, divisorDigits) - 1, currentSeed + 72);
                if (divisor === 0) divisor = 1; // Avoid division by zero, though range should prevent this.

                // To ensure a clean division and respect dividend digit range, we can determine a quotient range.
                const dividendMaxDigits = termRanges[0][1];
                const dividendMinDigits = termRanges[0][0];
                
                // Max possible quotient such that quotient * divisor approx Math.pow(10, dividendMaxDigits) - 1
                // Min possible quotient such that quotient * divisor approx Math.pow(10, dividendMinDigits - 1)
                let maxQuotient = Math.floor((Math.pow(10, dividendMaxDigits) -1) / divisor) ;
                let minQuotient = Math.ceil(Math.pow(10, dividendMinDigits - 1) / divisor);

                if (minQuotient === 0 && (Math.pow(10, dividendMinDigits -1) > 0) ) minQuotient = 1; // Ensure quotient is at least 1 if dividend is non-zero
                if (minQuotient > maxQuotient || maxQuotient <=0) { // Invalid quotient range, try to adjust divisor or skip
                     // This can happen if divisor is too large for the dividend range.
                     // Fallback: make divisor smaller or regenerate. For now, log and potentially skip.
                     logger.warn(`[ProblemGenerator WARN] divide_3digit_2digit: Divisor ${divisor} might be too large for dividend range ${dividendMinDigits}-${dividendMaxDigits} digits. MaxQ ${maxQuotient}, MinQ ${minQuotient}. Attempting to adjust divisor.`);
                     // Attempt to reduce divisor to a single digit number if it's not already
                     if (divisorDigits > 1) {
                         divisor = getRandomInt(2, 9, currentSeed + 722); // Fallback to simple 1-digit divisor (2-9)
                         maxQuotient = Math.floor((Math.pow(10, dividendMaxDigits) -1) / divisor) ;
                         minQuotient = Math.ceil(Math.pow(10, dividendMinDigits - 1) / divisor);
                         if (minQuotient === 0 && (Math.pow(10, dividendMinDigits -1) > 0) ) minQuotient = 1;
                     }
                     if (minQuotient > maxQuotient || maxQuotient <=0) { // Still bad
                         logger.error(`[ProblemGenerator ERROR] divide_3digit_2digit: Could not determine valid quotient range for divisor ${divisor}. Skipping.`);
                         lastError = `Invalid quotient range for divisor ${divisor}`;
                         continue; // Skip to next attempt in the while loop
                     }
                }

                const quotient = getRandomInt(minQuotient, maxQuotient, currentSeed + 73);
                const dividend = divisor * quotient;

                const op = '÷';
                question = `${dividend} ${op} ${divisor} = ?`;
                nums = [dividend, divisor];
                ops = [op];
                generatedDetails = { nums, ops, questionString: question };
                logger.debug(`[ProblemGenerator DEBUG] Generated divide_3digit_2digit (clean): ${question}, Quotient: ${quotient}, Seed: ${currentSeed}`);
            } else {
                logger.warn(`[ProblemGenerator WARN] Unknown or unhandled problemType: ${problemType} in attempt ${attempts}. Skipping.`);
                lastError = `Unknown problemType: ${problemType}`;
                continue; // 次の試行へ
            }
            
            // 仮に generatedDetails が { nums: [...], ops: [...], questionString: "..." } を持つとする
            if (generatedDetails) {
                question = generatedDetails.questionString;
                nums = generatedDetails.nums;
                ops = generatedDetails.ops;
                answer = calculateAnswer(nums, ops, params.decimals);
                logger.debug(`[ProblemGenerator DEBUG] Attempt ${attempts}: type=${problemType}, Q=${question}, RawAnswer=${answer}, Seed=${currentSeed}`);
            } else {
                logger.warn(`[ProblemGenerator WARN] No details generated for type ${problemType}, attempt ${attempts}`);
                lastError = `No details for ${problemType}`;
            }

            // --- バリデーション (answer が計算できた後) ---
            if (answer !== undefined && Number.isFinite(answer)) {
                const isIntOk = params.forceIntegerResult ? Number.isInteger(answer) : true;
                const isNegativeOk = params.allowNegativeResult ? true : answer >= 0;
                const isValueOk = (params.maxResultValue === undefined || answer <= params.maxResultValue) && 
                                  (params.minResultValue === undefined || answer >= params.minResultValue);
                const isClean = isCleanNumber(answer, params.decimals);
                const allConditions = {
                    isIntOk, isNegativeOk, isValueOk, isClean,
                    forceInt: params.forceIntegerResult, actualInt: Number.isInteger(answer),
                    allowNeg: params.allowNegativeResult, actualNeg: answer < 0,
                    maxVal: params.maxResultValue, minVal: params.minResultValue, actualVal: answer,
                    decimals: params.decimals
                };
                logger.debug(`[ProblemGenerator DEBUG] Attempt ${attempts} Validation: Answer=${answer}, Conditions=${JSON.stringify(allConditions)}`);

                if (isIntOk && isNegativeOk && isValueOk && isClean) {
                    options = []; // ★ 選択肢生成をスキップし、空配列を設定
                    problem = { question, answer, options, problemType };
                    logger.info(`[ProblemGenerator INFO] SUCCESS: ${difficulty}, type: ${problemType}, Q: ${question}, A: ${answer} (Attempts: ${attempts}, ${Date.now() - funcStartTime}ms)`);
                    lastError = null;
                    break; // ループ脱出
                } else {
                    lastError = `Validation failed: ${JSON.stringify(allConditions)}`;
                }
            } else {
                logger.debug(`[ProblemGenerator DEBUG] Attempt ${attempts}: Answer is undefined or not finite (${answer})`);
                lastError = `Answer undefined or not finite: ${answer}`;
            }

            // タイムアウトチェック (ループ内部)
            if (checkTimeout(funcStartTime, 5000)) { // 5秒でこの内部ループは警告 (長すぎ)
                logger.warn(`[ProblemGenerator WARN] INNER LOOP TIMEOUT for ${difficulty}, type ${problemType}, attempt ${attempts}. Duration: ${Date.now() - funcStartTime}ms`);
                lastError = `Inner loop timeout after 5s`;
                // break; // このループを抜けるか、あるいは全体を抜けるかは設計次第
            }
        } // end while

        if (!problem) {
            logger.warn(`[ProblemGenerator WARN] FAILED to generate ${difficulty} problem (type: ${problemType}) after ${MAX_ATTEMPTS_INTERNAL} attempts. LastError: ${lastError}. Duration: ${Date.now() - funcStartTime}ms. Trying fallback...`);
            problem = await generateFallbackProblem(difficulty, seed + attempts + 1); // フォールバック
            if (problem) {
                logger.info(`[ProblemGenerator INFO] Fallback problem generated for ${difficulty}. Duration: ${Date.now() - funcStartTime}ms`);
            } else {
                logger.error(`[ProblemGenerator ERROR] FALLBACK FAILED for ${difficulty}. Duration: ${Date.now() - funcStartTime}ms`);
            }
        }

    } catch (error) {
        logger.error(`[ProblemGenerator ERROR] EXCEPTION in generateSingleProblemInternal for ${difficulty}, seed ${seed}, attempt ${attempts}, type ${problemType}. Error: ${error.message}`, error.stack);
        lastError = `Exception: ${error.message}`;
        problem = null; // エラー時は問題なしとする
    }

    const funcEndTime = Date.now();
    logger.debug(`[ProblemGenerator DEBUG] generateSingleProblemInternal COMPLETED - ${difficulty}, seed: ${seed}. Found: ${!!problem}. Attempts: ${attempts}. Total Duration: ${funcEndTime - funcStartTime}ms. LastError: ${lastError}`);
    return problem;
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
    logger.warn(`Failed to generate problem using normal algorithm. Using simplified generator for ${difficulty}`);
    const simpleProblem = await generateSimpleProblem(difficulty, seed);
    if (simpleProblem) {
      const { v4: uuidv4 } = await import('uuid');
      return { ...simpleProblem, id: uuidv4() };
    }
    throw new Error('Simplified generator also failed');
  } catch (error) {
    logger.error(`Error in problem generation: ${error.message}. Using fallback.`);
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
      logger.warn(`[ProblemGenerator] Expert難易度では最大10問に制限されています (${count}要求 -> 10生成)`);
    }

    let generatedCount = 0;
    let generationAttempts = 0;
    const maxGenerationAttempts = actualCount * 15;
    const usedQuestions = new Set();

    for (let i = 0; i < actualCount && generationAttempts < maxGenerationAttempts; i++) {
        generationAttempts++;
        
        if (checkTimeout(startTime, 25000)) {
          logger.warn(`[generateProblemsByDifficulty] Timeout detected after generating ${generatedCount} problems. Returning partial results.`);
          
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
         logger.warn(`[ProblemGenerator] 要求された${actualCount}問のうち、${generatedCount}問のみ生成されました`);
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
    // より良いランダム性を確保するため、複数の要素を組み合わせてシード値を生成
    const actualSeed = seed || (Date.now() + Math.random() * 1000000 + (requestId ? requestId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0));
    logger.info(`[ProblemGenerator] 新基準に基づく${count}問の生成開始 (${difficulty}) シード値: ${actualSeed}`);
    
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
    
    // 新基準に基づく問題構成で生成
    const problems = await generateProblemSetByComposition(difficulty, requestId);

    if (problems.length === 0) {
      logger.warn(`新基準での問題生成に失敗したため、フォールバック問題を使用します`);
      const fallbackProblems = [];
      for (let i = 0; i < Math.min(count, 5); i++) {
        // フォールバック問題でもランダム性を確保
        const fallbackSeed = actualSeed + i * 1000 + Math.random() * 10000;
        fallbackProblems.push(await generateFallbackProblem(difficulty, fallbackSeed));
      }
      return fallbackProblems.map(p => ({
        id: p.id,
        question: p.question,
        answer: p.answer,
        options: p.options
      }));
    }
    
    const endTime = performance.now();
    logger.info(`[ProblemGenerator] ${problems.length}問の生成完了 (${difficulty}). 所要時間: ${(endTime - startTime).toFixed(2)}ms`);
    
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
    logger.error('[ProblemGenerator] 問題生成中の重大エラー:', error);
    logger.error("Error Name: ", error.name);
    logger.error("Error Message: ", error.message);
    if (error.stack) {
        logger.error("Error Stack: ", error.stack);
    }
    
    if (requestId) {
      processingStatusMap.set(requestId, {
        ...processingStatusMap.get(requestId),
        status: 'error',
        endTime: Date.now(),
        error: error.message
      });
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
/* // コメントアウト開始: この ensureProblemsForToday は server.js のものと重複しており、未使用
const ensureProblemsForToday = async () => {
    const funcStartTime = Date.now();
    logger.info(`[ProblemGenerator INFO] ensureProblemsForToday CALLED.`);
    const today = getTodayDateStringJST(); // この関数も problemGenerator.js 内にはない
    let allProblemsGeneratedSuccessfully = true;

    try {
        logger.debug(`[ProblemGenerator DEBUG] Checking/Generating problems for date: ${today}`);
      for (const difficulty of Object.values(DifficultyRank)) {
            const difficultyStartTime = Date.now();
            logger.debug(`[ProblemGenerator DEBUG] Processing difficulty: ${difficulty} for date: ${today}`);
            
            let problemsExist = false; 
            try {
                 // ProblemModel は未定義
                 // const count = await ProblemModel.countDocuments({ date: today, difficulty: difficulty });
                 // problemsExist = count > 0;
                 // console.log(`[ProblemGenerator DEBUG] Problems for ${today}, ${difficulty}: ${count} found (exists=${problemsExist})`);
                 // 仮の処理として、DailyProblemSetで確認 (ただし、この関数自体が未使用)
                 const setCount = await DailyProblemSet.countDocuments({ date: today, difficulty: difficulty });
                 problemsExist = setCount > 0;
                 logger.debug(`[ProblemGenerator (unused) DEBUG] Problems for ${today}, ${difficulty}: ${setCount} found (exists=${problemsExist})`);

            } catch (dbError) {
                logger.error(`[ProblemGenerator ERROR] DB error checking problems for ${today}, ${difficulty}: ${dbError.message}`, dbError.stack);
                allProblemsGeneratedSuccessfully = false;
                continue; 
            }

            if (!problemsExist) {
                logger.info(`[ProblemGenerator INFO] No problems for ${today}, ${difficulty}. Generating new set (10 problems).`);
                const generationTaskStartTime = Date.now();
                try {
                    const generatedProblems = await generateProblems(difficulty, 10, Date.now(), null);
                    
                    // ★★★ DB保存処理がここにはない ★★★ (server.js側で対応済み)
                    if (generatedProblems && generatedProblems.length > 0) {
                        logger.info(`[ProblemGenerator INFO] Successfully generated ${generatedProblems.length} problems for ${today}, ${difficulty}. Duration: ${Date.now() - generationTaskStartTime}ms`);
                } else {
                        logger.warn(`[ProblemGenerator WARN] generateProblems returned empty or null for ${today}, ${difficulty}. Duration: ${Date.now() - generationTaskStartTime}ms`);
                        allProblemsGeneratedSuccessfully = false; 
                    }
                } catch (error) {
                    logger.error(`[ProblemGenerator ERROR] EXCEPTION during generateProblems for ${today}, ${difficulty}. Duration: ${Date.now() - generationTaskStartTime}ms. Error: ${error.message}`, error.stack);
                    allProblemsGeneratedSuccessfully = false;
                }
            } else {
                logger.info(`[ProblemGenerator INFO] Problems already exist for ${today}, ${difficulty}. Skipping generation.`);
            }
            logger.debug(`[ProblemGenerator DEBUG] Difficulty ${difficulty} processing time: ${Date.now() - difficultyStartTime}ms`);
        }
    } catch (overallError) {
        logger.error(`[ProblemGenerator ERROR] OVERALL EXCEPTION in ensureProblemsForToday for date ${today}. Error: ${overallError.message}`, overallError.stack);
        allProblemsGeneratedSuccessfully = false;
    }

    const funcEndTime = Date.now();
    logger.info(`[ProblemGenerator INFO] ensureProblemsForToday COMPLETED. All successful: ${allProblemsGeneratedSuccessfully}. Total duration: ${funcEndTime - funcStartTime}ms`);
    if (!allProblemsGeneratedSuccessfully) {
        logger.error(`[ProblemGenerator MAJOR ERROR] One or more problem sets FAILED to generate for ${today}.`);
    }
};
*/ // コメントアウト終了

const generateProblemsForNextDay = async () => {
  try {
    const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
    logger.info(`[自動生成] ${tomorrow}の問題セットを生成します...`);
    for (const difficulty of Object.values(DifficultyRank)) {
      const existingSet = await DailyProblemSet.findOne({ date: tomorrow, difficulty });
      if (existingSet) {
        logger.info(`[自動生成] ${tomorrow}の${difficulty}難易度の問題セットは既に存在します。スキップします。`);
        continue;
      }
      logger.info(`[自動生成] ${tomorrow}の${difficulty}難易度の問題を生成します...`);
      try {
        // より良いランダム性を確保するため、日付・難易度・現在時刻・ランダム値を組み合わせ
        const baseSeed = `${tomorrow}_${difficulty}`.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const seed = baseSeed + Date.now() + Math.random() * 1000000;
        const problems = await generateProblems(difficulty, 10, seed);
        if (!problems || problems.length === 0) {
          logger.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成に失敗しました。`);
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
        logger.info(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成完了 (${problems.length}問)`);
      } catch (error) {
        logger.error(`[自動生成] ${tomorrow}の${difficulty}難易度の問題生成中にエラー:`, error);
      }
    }
    logger.info(`[自動生成] ${tomorrow}の全難易度の問題生成が完了しました。`);
  } catch (error) {
    logger.error('[自動生成] 翌日問題の生成中にエラー:', error);
  }
};

// Final exports
export {
    // DifficultyRank, // Removed due to direct export at definition
    // generateProblems, // Removed due to direct export at definition
    // getProcessingStatus, // Removed due to direct export at definition
    // ensureProblemsForToday, // コメントアウトしたため削除
    generateProblemsForNextDay,
    // Potentially other specific generator functions if they need to be called directly for testing/admin
    // generateSingleProblem // Example if needed
};

// module.exports = { ... } // CommonJS alternative, ensure consistency with project type

// ★ 新基準に基づく問題集生成関数
const generateProblemSetByComposition = async (difficulty, requestId = null) => {
    const params = getParamsForDifficulty(difficulty);
    const problemComposition = params.problemComposition;
    
    if (!problemComposition) {
        logger.warn(`[generateProblemSetByComposition] No problemComposition defined for ${difficulty}`);
        return await generateProblemsByDifficulty(difficulty, 10, requestId);
    }
    
    const allProblems = [];
    // より良いランダム性を確保するため、複数の要素を組み合わせてシード値を初期化
    let seedCounter = getDateSeed() + Date.now() + Math.random() * 1000000 + (requestId ? requestId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0);
    
    // 各問題タイプごとに指定数の問題を生成
    for (const [problemType, count] of Object.entries(problemComposition)) {
        logger.debug(`[ProblemSet] Generating ${count} problems of type: ${problemType}`);
        
        for (let i = 0; i < count; i++) {
            // 各問題で異なるシード値を使用
            seedCounter += (i + 1) * 1000 + Math.random() * 10000;
            const problem = await generateSpecificProblem(problemType, difficulty, seedCounter);
            
            if (problem) {
                allProblems.push(problem);
                logger.debug(`[ProblemSet] Generated ${problemType} #${i + 1}: ${problem.question}`);
            } else {
                logger.warn(`[ProblemSet] Failed to generate ${problemType} #${i + 1}`);
            }
        }
    }
    
    // 問題をシャッフル（シャッフル用のシード値も更新）
    const shuffleSeed = seedCounter + Math.random() * 100000;
    return shuffleArray(allProblems, shuffleSeed);
};

// ★ 特定タイプの問題生成
const generateSpecificProblem = async (problemType, difficulty, seed) => {
    const params = getParamsForDifficulty(difficulty);
    const maxAttempts = 50;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const currentSeed = seed + attempt;
        let nums = [], ops = [], question = "";
        
        try {
            // 問題タイプ別の生成ロジック
            if (problemType === 'add_subtract_2digit') {
                const { num1, num2 } = params.digitRanges.add_subtract_2digit;
                let n1 = getRandomInt(num1[0], num1[1], currentSeed);
                let n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                const op = seededRandom(currentSeed + 2) > 0.5 ? '+' : '-';
                
                if (op === '-' && n1 < n2) [n1, n2] = [n2, n1];
                nums = [n1, n2]; ops = [op];
                question = `${n1} ${op} ${n2} = ?`;
                
            } else if (problemType === 'add_subtract_3digit_2digit') {
                const { num1, num2 } = params.digitRanges.add_subtract_3digit_2digit;
                let n1 = getRandomInt(num1[0], num1[1], currentSeed);
                let n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                const op = seededRandom(currentSeed + 2) > 0.5 ? '+' : '-';
                
                if (op === '-' && n1 < n2) [n1, n2] = [n2, n1];
                nums = [n1, n2]; ops = [op];
                question = `${n1} ${op} ${n2} = ?`;
                
            } else if (problemType === 'multiplication_table') {
                const { num1, num2 } = params.digitRanges.multiplication_table;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else if (problemType === 'add_subtract_4digit') {
                const { num1, num2 } = params.digitRanges.add_subtract_4digit;
                let n1 = getRandomInt(num1[0], num1[1], currentSeed);
                let n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                const op = seededRandom(currentSeed + 2) > 0.5 ? '+' : '-';
                
                if (op === '-' && n1 < n2) [n1, n2] = [n2, n1];
                nums = [n1, n2]; ops = [op];
                question = `${n1} ${op} ${n2} = ?`;
                
            } else if (problemType === 'multiply_2digit_2digit') {
                const { num1, num2 } = params.digitRanges.multiply_2digit_2digit;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else if (problemType === 'multiply_3digit_2digit') {
                const { num1, num2 } = params.digitRanges.multiply_3digit_2digit;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else if (problemType.includes('divide_')) {
                // 割り切れる割り算問題の生成（逆算方式）
                const divisionConfig = params.digitRanges[problemType];
                if (divisionConfig && divisionConfig.divisor && divisionConfig.quotient) {
                    const divisor = getRandomInt(divisionConfig.divisor[0], divisionConfig.divisor[1], currentSeed);
                    const quotient = getRandomInt(divisionConfig.quotient[0], divisionConfig.quotient[1], currentSeed + 1);
                    const dividend = divisor * quotient; // 必ず割り切れる
                    
                    nums = [dividend, divisor]; ops = ['÷'];
                    question = `${dividend} ÷ ${divisor} = ?`;
                } else {
                    continue; // 設定が不正な場合は次の試行へ
                }
                
            } else if (problemType === 'add_subtract_5digit') {
                const { num1, num2 } = params.digitRanges.add_subtract_5digit;
                let n1 = getRandomInt(num1[0], num1[1], currentSeed);
                let n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                const op = seededRandom(currentSeed + 2) > 0.5 ? '+' : '-';
                
                if (op === '-' && n1 < n2) [n1, n2] = [n2, n1];
                nums = [n1, n2]; ops = [op];
                question = `${n1} ${op} ${n2} = ?`;
                
            } else if (problemType === 'multiply_4digit_2digit') {
                const { num1, num2 } = params.digitRanges.multiply_4digit_2digit;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else if (problemType === 'multiply_4digit_3digit') {
                const { num1, num2 } = params.digitRanges.multiply_4digit_3digit;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else if (problemType === 'add_subtract_6digit') {
                const { num1, num2 } = params.digitRanges.add_subtract_6digit;
                let n1 = getRandomInt(num1[0], num1[1], currentSeed);
                let n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                const op = seededRandom(currentSeed + 2) > 0.5 ? '+' : '-';
                
                if (op === '-' && n1 < n2) [n1, n2] = [n2, n1];
                nums = [n1, n2]; ops = [op];
                question = `${n1} ${op} ${n2} = ?`;
                
            } else if (problemType === 'multiply_5digit_3digit') {
                const { num1, num2 } = params.digitRanges.multiply_5digit_3digit;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else if (problemType === 'multiply_5digit_4digit') {
                const { num1, num2 } = params.digitRanges.multiply_5digit_4digit;
                const n1 = getRandomInt(num1[0], num1[1], currentSeed);
                const n2 = getRandomInt(num2[0], num2[1], currentSeed + 1);
                nums = [n1, n2]; ops = ['×'];
                question = `${n1} × ${n2} = ?`;
                
            } else {
                logger.warn(`[generateSpecificProblem] Unknown problem type: ${problemType}`);
                continue;
            }
            
            // 答えを計算
            const answer = calculateAnswer(nums, ops, params.decimals);
            if (answer === undefined || !isCleanNumber(answer, params.decimals)) {
                continue;
            }
            
            // 負の数チェック
            if (!params.allowNegativeResult && answer < 0) {
                continue;
            }
            
            // 結果の範囲チェック
            if (answer > params.maxResultValue) {
                continue;
            }
            
            // 選択肢生成
            const options = generateOptions(answer, difficulty, currentSeed);
            
            return {
                id: `${difficulty}_${problemType}_${currentSeed}`,
                question,
                options,
                answer,
                difficulty,
                type: problemType
            };
            
        } catch (error) {
            logger.warn(`[generateSpecificProblem] Error in attempt ${attempt}:`, error.message);
            continue;
        }
    }
    
    logger.error(`[generateSpecificProblem] Failed to generate ${problemType} after ${maxAttempts} attempts`);
    return null;
};

// ★ 配列シャッフル関数
const shuffleArray = (array, seed) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(seed + i) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};
