import { Problem } from '@/types';
import { DifficultyRank, difficultyToJapanese, japaneseToDifficulty } from '@/types/difficulty';
import { logger } from './logger';

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

// --- 安全な計算ヘルパー関数 (演算子の優先順位を考慮し、丸めなし) ---
const calculateAnswer = (nums: number[], ops: string[], maxDecimalPlaces: number): number | undefined => {
    logger.debug(`[calculateAnswer] Start: nums=${JSON.stringify(nums)}, ops=${JSON.stringify(ops)}`);

    if (nums.length !== ops.length + 1) {
        logger.error("[calculateAnswer] Invalid input length", nums, ops);
        return undefined;
    }
    if (nums.some(isNaN) || nums.some(n => !Number.isFinite(n))) {
        logger.error("[calculateAnswer] Invalid number input (NaN or Infinity)", nums);
        return undefined;
    }

    // 計算前にすべての除算演算子をチェック
    for (let i = 0; i < ops.length; i++) {
        if (ops[i] === '÷') {
            // 現在の数値と次の数値
            const dividend = nums[i];
            const divisor = nums[i + 1];
            
            // ゼロ除算チェック
            if (divisor === 0) {
                logger.warn(`[calculateAnswer] Zero division detected: ${dividend} / ${divisor}`);
                return undefined;
            }
        }
    }

    const numbers = [...nums];
    const operators = [...ops];

    // 1. 乗算と除算 (中間丸めなし)
    logger.debug(`[calculateAnswer] Before Mul/Div: numbers=${JSON.stringify(numbers)}, operators=${JSON.stringify(operators)}`);
    for (let i = 0; i < operators.length; ) {
        if (operators[i] === '×' || operators[i] === '÷') {
            const left = numbers[i];
            const right = numbers[i + 1];
            let result: number;
            if (operators[i] === '×') {
                result = left * right;
                logger.debug(`[calculateAnswer] Mul: ${left} * ${right} = ${result}`);
            } else { // '÷'
                if (right === 0) return undefined; // Should be caught above, but double check
                result = left / right;
                logger.debug(`[calculateAnswer] Div: ${left} / ${right} = ${result}`);
            }
            if (!Number.isFinite(result)) {
                 logger.warn(`[calculateAnswer] Infinite result after Mul/Div: ${result}`);
                 return undefined;
            }
            numbers.splice(i, 2, result);
            operators.splice(i, 1);
        } else {
            i++;
        }
    }
    logger.debug(`[calculateAnswer] After Mul/Div: numbers=${JSON.stringify(numbers)}, operators=${JSON.stringify(operators)}`);

    // 2. 加算と減算
    let finalResult = numbers[0];
    logger.debug(`[calculateAnswer] Before Add/Sub: finalResult=${finalResult}, numbers=${JSON.stringify(numbers)}, operators=${JSON.stringify(operators)}`);
    for (let i = 0; i < operators.length; i++) {
        const right = numbers[i + 1];
        const op = operators[i];
        const prevResult = finalResult;
        if (op === '+') {
            finalResult += right;
        } else { // '-'
            finalResult -= right;
        }
        logger.debug(`[calculateAnswer] Add/Sub step ${i}: ${prevResult} ${op} ${right} = ${finalResult}`);
    }

    // 最終チェック (無限大とマイナス)
        if (!Number.isFinite(finalResult)) {
        logger.error("[calculateAnswer] Final result is Infinity or NaN", finalResult);
          return undefined;
        }

    // マイナスの結果もそのまま返す（問題生成時のみマイナスをundefinedに）
    if (finalResult < 0 && ops[0] !== '-') {
        logger.warn(`[calculateAnswer] Final result is negative: ${finalResult}`);
        return undefined; // 問題生成時にはマイナスは生成しない
    }

    logger.debug(`[calculateAnswer] End: finalResult=${finalResult}`);
    return finalResult;
};

// generateOptions は変更なし (ただし、呼び出し元で answer が undefined でないことを確認)
// ... (generateOptions 関数のコード) ...
// 既存の generateOptions 関数 (answer が undefined の可能性に対応)
const generateOptions = (answer: number | undefined, difficulty: DifficultyRank, seed: number): number[] => {
    if (answer === undefined) {
        logger.error("[generateOptions] Answer is undefined, cannot generate options.");
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
             logger.error(`[generateOptions] Max attempts reached. Options: ${options}`);
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
  useBrackets: boolean; // 難易度ごとに括弧の使用を設定
  maxAnswerDecimalPlaces: number; // 答えの最大小数点以下桁数
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
    termsCount: 2,
    useBrackets: false,
    maxAnswerDecimalPlaces: 2
  },
  intermediate: {
    addition: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    subtraction: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    multiplication: { enabled: true, minDigits: 1, maxDigits: 1, digits: 1 },
    division: { enabled: true, minDigits: 1, maxDigits: 1, digits: 1 },
    decimal: { enabled: false, minDigits: 1, maxDigits: 1, digits: 1, decimalPlaces: 1 },
    termsCount: 2,
    useBrackets: false,
    maxAnswerDecimalPlaces: 2
  },
  advanced: {
    addition: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    subtraction: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    multiplication: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    division: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2 },
    decimal: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2, decimalPlaces: 1 },
    termsCount: 2,
    useBrackets: false,
    maxAnswerDecimalPlaces: 2
  },
  expert: {
    addition: { enabled: true, minDigits: 2, maxDigits: 3, digits: 3 },
    subtraction: { enabled: true, minDigits: 2, maxDigits: 3, digits: 3 },
    multiplication: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    division: { enabled: true, minDigits: 2, maxDigits: 2, digits: 2 },
    decimal: { enabled: true, minDigits: 1, maxDigits: 2, digits: 2, decimalPlaces: 2 },
    termsCount: 3,
    useBrackets: false,
    maxAnswerDecimalPlaces: 2
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
    logger.error("Failed to load problem settings:", error);
  }
  return defaultSettings;
};

// 桁数を取得するヘルパー (変更なし)
const getDigitsOrRange = (settings: OperationSettings, forSecondOperand = false) => {
    if (forSecondOperand) {
      const minDigits = settings.minDigits2 ?? settings.minDigits ?? settings.digits ?? 1;
      const maxDigits = settings.maxDigits2 ?? settings.maxDigits ?? settings.digits ?? 1;
      return { minDigits, maxDigits };
    } else {
      const minDigits = settings.minDigits ?? settings.digits ?? 1;
      const maxDigits = settings.maxDigits ?? settings.digits ?? 1;
      return { minDigits, maxDigits };
    }
};

// 数値を生成するヘルパー (変更なし)
const generateNumberByDigits = (digits: number, seedOffset: number, useDecimal: boolean, decimalPlaces: number) => {
    if (!useDecimal) { // 整数
      if (digits === 1) return getRandomInt(1, 9, seedOffset);
      const min = Math.pow(10, digits - 1);
      const max = Math.pow(10, digits) - 1;
      return getRandomInt(min, max, seedOffset);
    } else { // 小数
      if (digits === 1) return getRandomFloat(0.1, 9.9, seedOffset, decimalPlaces);
      const min = Math.pow(10, digits - 1) / Math.pow(10, decimalPlaces);
      const max = (Math.pow(10, digits) - 1) / Math.pow(10, decimalPlaces);
      return getRandomFloat(min, max, seedOffset, decimalPlaces);
    }
};

// ★ 答えが「きれい」かどうかをチェックする関数
const isCleanNumber = (num: number, allowedDecimalPlaces: number): boolean => {
    if (Number.isInteger(num)) return true;
    // 文字列にして小数点以下の桁数をチェック & 不自然な誤差がないか確認
    const s = String(num);
    const decimalPart = s.split('.')[1];
    if (!decimalPart) return true; // 整数 (念のため)
    if (decimalPart.length > allowedDecimalPlaces) return false; // 桁数オーバー
    // 非常に小さい誤差を許容して、指定桁数で丸めた値と一致するか確認
    const factor = Math.pow(10, allowedDecimalPlaces);
    return Math.abs(num - Math.round(num * factor) / factor) < 1e-9;
};

// ★ DifficultySettings のキーのうち、演算操作設定に対応するものだけを定義
const allowedOpKeys: (keyof DifficultySettings)[] = ['addition', 'subtraction', 'multiplication', 'division'];

// 単一の問題生成 (再リファクタリング)
const generateSingleProblemInternal = (difficulty: DifficultyRank, seed: number): { question: string; answer: number; } | null => {
  logger.debug(`[GenProbInt] Start: difficulty=${difficulty}, seed=${seed}`);
  try {
    const settings = getSettings();
    const difficultySettings = settings[difficulty] || defaultSettings[difficulty];
    // ★ 許容する小数点以下の最大桁数 (表示用ではなく、生成可否の判断用)
    const allowedDecimalPlaces = difficultySettings.decimal.enabled ? (difficultySettings.decimal.decimalPlaces ?? 2) : 0;

    // ★ enabledOperations の型を明示的に指定し、allowedOpKeys に基づいてフィルタリング
    const enabledOperations: (keyof DifficultySettings)[] = [];
    allowedOpKeys.forEach(key => {
        const setting = difficultySettings[key];
        // setting が OperationSettings 型であることをより厳密にチェック
        // typeof setting === 'object' だけだと不十分。setting が null でないことと、'enabled' プロパティを持つことを確認
        if (typeof setting === 'object' && setting !== null && 'enabled' in setting && setting.enabled) {
            enabledOperations.push(key);
        }
    });


    if (enabledOperations.length === 0) {
        logger.warn(`[GenProbInt] No operations enabled for difficulty ${difficulty}. Defaulting to addition.`);
        // デフォルトで加算を有効にするなどのフォールバック処理
        // difficultySettings.addition が OperationSettings 型であることを確認
        if(typeof difficultySettings.addition === 'object' && difficultySettings.addition !== null && difficultySettings.addition.enabled) {
             enabledOperations.push('addition');
        } else {
             logger.error(`[GenProbInt] Addition is also disabled. Cannot generate problem.`);
             return null; // 問題生成不可
        }
    }


    let attempts = 0;
    const maxAttempts = 200; // 厳しくするので試行回数を増やす

    while (attempts < maxAttempts) {
        attempts++;
        let calculationNums: number[] = [];
        let calculationOps: string[] = [];
        let involvesDivision = false;
        let currentSeed = seed + attempts * 10; // シードを毎回更新

        // ★ enabledOperations は OperationSettings のキーのみを含むことが保証される
        const opTypeIndex = Math.floor(seededRandom(currentSeed++) * enabledOperations.length);
        const opType = enabledOperations[opTypeIndex]; // 型は keyof DifficultySettings だが、上記ロジックにより OperationSettings のキーのみ
        // ★ opSettings の型アサーション (opTypeが絞られているため安全)
        const opSettings = difficultySettings[opType] as OperationSettings;


        const termsCount = difficultySettings.termsCount || 2;
        const useBrackets = termsCount > 2 ? difficultySettings.useBrackets && seededRandom(currentSeed++) < 0.5 : false;
        const useDecimal = difficultySettings.decimal.enabled; // 難易度全体の設定を見る
        const baseDecimalPlaces = difficultySettings.decimal.decimalPlaces ?? 2;

        // 1. 演算子を決定
        for (let i = 0; i < termsCount - 1; i++) {
             let selectedOpType = opType;
             if (i > 0 && seededRandom(currentSeed++) < 0.3) {
                 // ★ otherOps の型も keyof DifficultySettings (OperationSettings のキー)
                 const otherOps = enabledOperations.filter(op => op !== opType);
                 if (otherOps.length > 0) {
                     const randomIndex = Math.floor(seededRandom(currentSeed++) * otherOps.length);
                     selectedOpType = otherOps[randomIndex];
                 }
             }
             // ★ selectedOpType も OperationSettings のキーのはず
             // allowedOpKeys を使ってインデックスを取得
             const opSymbolIndex = allowedOpKeys.indexOf(selectedOpType);
             // getOpSymbol に渡すインデックスが負にならないようにチェック
             const opSymbol = getOpSymbol(opSymbolIndex >= 0 ? opSymbolIndex : 0); // 見つからない場合は '+'
             calculationOps.push(opSymbol);
             if (opSymbol === '÷') involvesDivision = true;
        }



        // 2. 数値を生成
        // ★ mainOpSettings は opType に基づくので OperationSettings 型のはず
        const mainOpSettings = difficultySettings[opType] as OperationSettings;
        for (let i = 0; i < termsCount; i++) {
             // ★ getDigitsOrRange に渡す mainOpSettings の型が OperationSettings であることを TS が認識できる
             const digitsInfo = getDigitsOrRange(mainOpSettings, i > 0);
             const digits = getRandomInt(digitsInfo.minDigits, digitsInfo.maxDigits, currentSeed++);
             // ★ 割り算が含まれる場合は、小数設定でも整数を生成
             const generateDecimal = useDecimal && !involvesDivision;
             calculationNums.push(generateNumberByDigits(digits, currentSeed++, generateDecimal, baseDecimalPlaces));
        }

        // 3. 割り算の事前チェックと調整 (ここが重要！)
        if (involvesDivision) {
             // 割り算が必ず整数解になるように、被除数 (a) を調整する戦略
             // 例: a / b / c -> cから逆算してbを調整、次にaを調整
             let currentDivisorProduct = 1;
             let possible = true;
             // 後ろから見て、除数の積を計算し、それに応じて前の項を調整
             for (let i = calculationOps.length - 1; i >= 0; i--) {
                 if (calculationOps[i] === '÷') {
                     const divisor = calculationNums[i + 1];
                     if (divisor === 0) { possible = false; break; } // ゼロ除算不可
                     currentDivisorProduct *= divisor;
                     // calculationNums[i] (この割り算の被除数) が currentDivisorProduct で割り切れる必要がある
                     // 必要なら calculationNums[i] を調整する (より複雑なロジックが必要)
                     // -> 今回は簡単化のため、割り切れるかだけチェックし、ダメなら再試行
                      if (calculationNums[i] % currentDivisorProduct !== 0) {
                         // ★ 中間チェック: ここで割り切れない組み合わせは棄却
                         logger.debug(`[GenProbInt] Attempt ${attempts}: Retrying - intermediate division ${calculationNums[i]} / ${currentDivisorProduct} not integer.`);
                         possible = false;
                         break; // このループを抜けて次の while ループへ
                     }
                 } else if (calculationOps[i] === '×') {
                     // 掛け算の場合は、それまでの除数の積をリセット？ or 維持？ -> 維持して、最終的な被除数が割り切れるか見る
                 } else { // + or -
                     currentDivisorProduct = 1; // 加減算でリセット
                 }
             }
             if (!possible) continue; // 割り切れない組み合わせなので再試行
        }

        // 4. 括弧の位置を決定（問題文字列生成用）
        let bracketIndices: { start: number, end: number } | null = null;
        if (useBrackets && calculationOps.length > 1) {
            const possibleStarts = Array.from({ length: calculationOps.length }, (_, i) => i);
            const start = possibleStarts[Math.floor(seededRandom(currentSeed++) * possibleStarts.length)];
            bracketIndices = { start: start, end: start }; // 単一演算を括弧で囲む (例: a + (b*c) + d)
            // TODO: 複数演算を囲む括弧も実装可能 (例: (a+b)*c )
        }

        // 5. 答えを計算 (括弧は考慮せず、演算子の優先順位で)
        //   ※注意: 問題文字列の括弧と計算順序が一致しない可能性がある！
        //   -> より正確には、括弧を考慮した計算ロジックが必要だが、まずは優先順位で計算
        let answer = calculateAnswer(calculationNums, calculationOps, allowedDecimalPlaces);

        // 6. 答えを検証
        if (answer === undefined || answer < 0) {
             logger.debug(`[GenProbInt] Attempt ${attempts}: Invalid answer (undefined or negative): ${answer}`);
             continue;
        }
        // ★ isCleanNumber で検証 (割り算なら整数、それ以外は許容桁数)
        const requiredDecimalPlaces = involvesDivision ? 0 : allowedDecimalPlaces;
        if (!isCleanNumber(answer, requiredDecimalPlaces)) {
             logger.debug(`[GenProbInt] Attempt ${attempts}: Answer ${answer} is not clean (req dec: ${requiredDecimalPlaces}). Retrying.`);
             continue;
        }

        // 7. 問題文字列を生成 (計算に使用した数値・演算子と、決定した括弧位置から)
        let questionText = '';
        let currentNumIndex = 0;
        let currentOpIndex = 0;
        questionText += calculationNums[currentNumIndex++];
        while (currentOpIndex < calculationOps.length) {
            const openBracket = bracketIndices?.start === currentOpIndex;
            const closeBracket = bracketIndices?.end === currentOpIndex;
            if (openBracket) questionText += ' (';
            questionText += ` ${calculationOps[currentOpIndex]} ${calculationNums[currentNumIndex]}`;
            if (closeBracket) questionText += ')';
            currentNumIndex++;
            currentOpIndex++;
        }


        logger.debug(`[GenProbInt] Attempt ${attempts}: Valid problem: Q='${questionText}', A=${answer}`);
        return {
          question: `${questionText} = ?`,
          answer
        };

    } // end while attempts

    logger.error(`[GenProbInt] Failed after ${maxAttempts} attempts for difficulty ${difficulty}.`);
    return null;

  } catch (error) {
    logger.error(`[GenProbInt] Error generating problem:`, error);
    return null;
  }
};

// generateProblemsByDifficulty は generateSingleProblemInternal を呼び出し、options を追加する
const generateProblemsByDifficulty = (difficulty: DifficultyRank, count: number = 10): Problem[] => {
    logger.info(`[generateProblemsByDifficulty] Generating ${count} problems for difficulty: ${difficulty}`);
    const problems: Problem[] = [];
    const baseSeed = getDateSeed();
    logger.debug(`[generateProblemsByDifficulty] Base seed: ${baseSeed}`);

    let generatedCount = 0;
    let generationAttempts = 0;
    const maxGenerationAttempts = count * 20;
    const usedQuestions: Set<string> = new Set();

    while (generatedCount < count && generationAttempts < maxGenerationAttempts) {
        generationAttempts++;
        const seed = baseSeed + generationAttempts * 1000;

        const problemData = generateSingleProblemInternal(difficulty, seed);

        if (problemData && !usedQuestions.has(problemData.question)) {
            const options = generateOptions(problemData.answer, difficulty, seed + 1);
            if (options && options.length === 4) {
               problems.push({ 
                  id: `${difficulty}-${generatedCount}`,
                  question: problemData.question,
                  answer: problemData.answer,
                  difficulty: difficulty,
                  options: options
               });
               usedQuestions.add(problemData.question);
               generatedCount++;
            } else {
                logger.warn(`[generateProblemsByDifficulty] Failed to generate options for question: ${problemData.question}`);
            }
        } else if (!problemData) {
             // console.warn(`[generateProblemsByDifficulty] generateSingleProblemInternal failed. Retrying (Attempt ${generationAttempts})`);
        }
    }

    if (generatedCount < count) {
         logger.warn(`[generateProblemsByDifficulty] Could only generate ${generatedCount} valid unique problems out of ${count} requested after ${maxGenerationAttempts} attempts for difficulty ${difficulty}.`);
    } else {
        logger.info(`[generateProblemsByDifficulty] Final generated ${problems.length} problems successfully for difficulty ${difficulty}.`);
    }

    return problems;
};

// generateProblems は id を付与する
export const generateProblems = (difficulty: DifficultyRank, count: number = 10): Problem[] => {
  try {
    const generated = generateProblemsByDifficulty(difficulty, count);
    return generated.map((p, index) => ({
        ...p,
        id: String(index),
    }));
  } catch (error) {
    logger.error("Error in generateProblems wrapper:", error);
    return [];
  }
};

export { difficultyToJapanese, japaneseToDifficulty };

