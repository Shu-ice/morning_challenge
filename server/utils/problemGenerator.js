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
        case DifficultyRank.BEGINNER:
            // 小学1,2年生レベル：1桁の足し算・引き算のみ
            return { terms: 2, digits: 1, ops: ['+', '-'], decimals: 0, allowNegative: false, maxValue: 20 };
        case DifficultyRank.INTERMEDIATE:
            // 小学3,4年生レベル：2桁の四則演算、かけ算九九、簡単な割り算
            return { terms: 2, digits: 2, ops: ['+', '-', '×', '÷'], decimals: 0, allowNegative: false, maxValue: 100 };
        case DifficultyRank.ADVANCED:
            // 小学5,6年生レベル：3桁までの計算、小数（1桁まで）
            return { terms: 2, digits: 3, ops: ['+', '-', '×', '÷'], decimals: 1, allowNegative: false, maxValue: 1000 }; 
        case DifficultyRank.EXPERT:
            // 計算力に自信がある子ども向け：より複雑な計算
            return { terms: 2, digits: 3, ops: ['+', '-', '×', '÷'], decimals: 2, allowNegative: false, maxValue: 1000 }; 
        default:
            return { terms: 2, digits: 1, ops: ['+'], decimals: 0, allowNegative: false, maxValue: 20 };
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

// 単一問題生成関数
const generateSingleProblemInternal = (difficulty, seed) => {
  const params = getParamsForDifficulty(difficulty);
  const allowedDecimalPlaces = params.decimals;
  const startTime = Date.now();

  // キャッシュチェック - 同じシード値で生成された問題を再利用
  const cacheKey = `${seed}`;
  if (problemCache[difficulty].has(cacheKey)) {
    return problemCache[difficulty].get(cacheKey);
  }

  let attempts = 0;
  // パフォーマンス改善: 難易度ごとの最大試行回数をさらに最適化
  const maxAttempts = difficulty === DifficultyRank.BEGINNER ? 30 : 
                      difficulty === DifficultyRank.INTERMEDIATE ? 50 : 
                      difficulty === DifficultyRank.ADVANCED ? 80 : 100; // expertは100回に制限
  
  // 全難易度で割り切れる除算を生成
  const shouldGenerateCleanDivision = true;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // タイムアウトチェック - 10秒以上かかる場合は早期脱出
    if (checkTimeout(startTime, 10000)) {
      console.warn(`[generateSingleProblemInternal] Timeout detected after ${attempts} attempts for difficulty ${difficulty}. Returning fallback problem.`);
      const fallbackProblem = generateFallbackProblem(difficulty, seed);
      // フォールバック結果もキャッシュ
      problemCache[difficulty].set(cacheKey, fallbackProblem);
      return fallbackProblem;
    }
    
    let calculationNums = [];
    let calculationOps = [];
    let involvesDivision = false;
    let currentSeed = seed + attempts * 10;

    // 1. 演算子決定
    for (let i = 0; i < params.terms - 1; i++) {
        const opIndex = Math.floor(seededRandom(currentSeed++) * params.ops.length);
        const opSymbol = params.ops[opIndex];
        calculationOps.push(opSymbol);
        if (opSymbol === '÷') involvesDivision = true;
    }

    // 初級レベルでは引き算の場合、常に結果が正になるようにする
    const hasSubtraction = calculationOps.includes('-');
    
    // 割り算を含む場合は、割り切れる問題を生成
    if (involvesDivision) {
      calculationNums = generateCleanDivisionProblem(calculationOps, currentSeed, params);
    } else {
      // 通常の数値生成
      for (let i = 0; i < params.terms; i++) {
         const generateDecimal = allowedDecimalPlaces > 0 && 
                                (difficulty === DifficultyRank.ADVANCED || 
                                 difficulty === DifficultyRank.EXPERT);
         // 数値の範囲を難易度に応じて調整
         const digits = params.digits;
         let min, max;
         
         if (difficulty === DifficultyRank.BEGINNER) {
           // 初級レベル：1〜20までの数値
           min = 1;
           max = Math.min(params.maxValue, 20);
         } else if (difficulty === DifficultyRank.INTERMEDIATE) {
           // 中級レベル：簡単な2桁の数値
           min = i === 0 ? 11 : 1;  // 最初の数は2桁から
           max = Math.min(params.maxValue, 99);
         } else {
           // 上級・ちょう級：難易度に応じた上限値
           min = Math.pow(10, digits - 1);
           max = Math.min(Math.pow(10, digits) - 1, params.maxValue);
         }
         
         let num;
         if (!generateDecimal) {
             num = getRandomInt(min, max, currentSeed++);
         } else {
             // 小数は学習指導要領に合わせて調整
             const decimalMin = min / Math.pow(10, allowedDecimalPlaces);
             const decimalMax = max / Math.pow(10, allowedDecimalPlaces);
             num = getRandomFloat(decimalMin, decimalMax, currentSeed++, allowedDecimalPlaces);
         }
         calculationNums.push(num);
      }
      
      // 初級レベルで引き算の場合、常に結果が正になるようにする（引かれる数≧引く数）
      if (hasSubtraction && difficulty === DifficultyRank.BEGINNER) {
        const subtractionIndex = calculationOps.indexOf('-');
        if (subtractionIndex !== -1 && calculationNums[subtractionIndex] > calculationNums[subtractionIndex + 1]) {
          // 入れ替え
          [calculationNums[subtractionIndex], calculationNums[subtractionIndex + 1]] = 
          [calculationNums[subtractionIndex + 1], calculationNums[subtractionIndex]];
        }
      }
    }

    // 計算と検証
    const answer = calculateAnswer(calculationNums, calculationOps, params.decimals);
    if (answer !== undefined && 
        answer >= 0 && // 常に正の結果のみを許可
        isCleanNumber(answer, params.decimals)) {
      
      // 問題文を生成
      const question = calculationNums.reduce((str, num, i) => {
        const displayNum = Number.isInteger(num) ? num : num.toFixed(params.decimals);
        if (i === 0) return displayNum.toString();
        
        // 演算子を挿入
        return `${str} ${calculationOps[i-1]} ${displayNum}`;
      }, '');
      
      // 選択肢を生成
      const options = generateOptions(answer, difficulty, seed);
      
      const result = {
        question,
        answer,
        options
      };
      
      // 結果をキャッシュに保存（キャッシュサイズ管理）
      const difficultyCache = problemCache[difficulty];
      if (difficultyCache.size >= 100) { // 各難易度につき最大100問をキャッシュ
        const oldestKey = difficultyCache.keys().next().value;
        difficultyCache.delete(oldestKey);
      }
      difficultyCache.set(cacheKey, result);
      
      return result;
    }
  }
  
  // 再帰を避け、適切なレベルのデフォルト問題を返す
  console.warn(`Could not generate valid problem after ${maxAttempts} attempts for ${difficulty}`);
  const fallbackProblem = generateFallbackProblem(difficulty, seed);
  
  // フォールバック結果もキャッシュ
  problemCache[difficulty].set(cacheKey, fallbackProblem);
  return fallbackProblem;
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
const generateFallbackProblem = (difficulty, seed) => {
  // シード値に基づいた決定論的な問題生成
  const seedMod = Math.abs(seed) % 1000;
  const a = 1 + (seedMod % 9);
  const b = 2 + (Math.floor(seedMod / 10) % 8);
  
  const answer = a + b;
  
  // シードに基づいて選択肢を生成
  const options = [answer];
  
  // 間違った選択肢を生成（正解に近い数値）
  while (options.length < 4) {
    const offset = [-2, -1, 1, 2, 3][Math.floor(seededRandom(seed + options.length * 100) * 5)];
    const wrongAnswer = answer + offset;
    
    // 既存の選択肢と重複しないことを確認
    if (!options.includes(wrongAnswer) && wrongAnswer > 0) {
      options.push(wrongAnswer);
    }
  }
  
  // シードに基づいて選択肢をシャッフル
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 100) * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  
  return {
    question: `${a} + ${b} = ?`,
    answer: answer,
    options: options,
    type: 'addition'
  };
};

// ここに、簡易な問題生成関数を追加（エラー回避用）
const generateSimpleProblem = (difficulty, seed) => {
  // 難易度に応じた問題パターンを選択
  const seedMod = Math.abs(seed) % 1000;
  let a, b, c, operation, answer, question;
  
  switch(difficulty) {
    case DifficultyRank.BEGINNER:
      // 1桁の足し算
      a = 1 + (seedMod % 9);
      b = 1 + ((seedMod + 10) % 9);
      answer = a + b;
      question = `${a} + ${b} = ?`;
      break;
      
    case DifficultyRank.INTERMEDIATE:
      // 2項の四則演算
      a = 5 + (seedMod % 15);
      b = 2 + ((seedMod + 20) % 8);
      
      // 演算子をシード値で決定 (0:+, 1:-, 2:×, 3:÷)
      operation = Math.floor(seededRandom(seed * 2) * 4);
      
      if (operation === 0) {
        answer = a + b;
        question = `${a} + ${b} = ?`;
      } else if (operation === 1) {
        // 引き算（結果が正になるように）
        if (a < b) [a, b] = [b, a];
        answer = a - b;
        question = `${a} - ${b} = ?`;
      } else if (operation === 2) {
        answer = a * b;
        question = `${a} × ${b} = ?`;
      } else {
        // 割り算（結果が整数になるように）
        c = a * b;
        answer = b;
        question = `${c} ÷ ${a} = ?`;
      }
      break;
      
    case DifficultyRank.ADVANCED:
    case DifficultyRank.EXPERT:
    default:
      // 3項の四則演算
      a = 5 + (seedMod % 15);
      b = 2 + ((seedMod + 25) % 18);
      c = 2 + ((seedMod + 50) % 13);
      
      // 簡単な3項の計算
      answer = a + b - c;
      question = `${a} + ${b} - ${c} = ?`;
      break;
  }
  
  // 選択肢生成
  const options = generateOptions(answer, difficulty, seed);
  
  return {
    question,
    answer,
    options
  };
};

// 既存の問題生成ロジックで問題が生成できない場合のフォールバック処理を強化
const generateSingleProblem = (difficulty, seed) => {
  try {
    // 通常の問題生成を試行
    const problem = generateSingleProblemInternal(difficulty, seed);
    
    // 生成成功の場合はそのまま返す
    if (problem && problem.question && Number.isFinite(problem.answer)) {
      return problem;
    }
    
    // 失敗した場合は簡易な問題を生成
    console.warn(`Failed to generate problem using normal algorithm. Using simplified generator for ${difficulty}`);
    return generateSimpleProblem(difficulty, seed);
  } catch (error) {
    // エラー発生時は最も単純な問題を生成
    console.error(`Error in problem generation: ${error.message}. Using fallback.`);
    return generateFallbackProblem(difficulty, seed);
  }
};

// 進行状況をリセットする関数
const resetProcessingStatus = (requestId) => {
  if (processingStatusMap.has(requestId)) {
    processingStatusMap.delete(requestId);
  }
};

// 難易度ごとの問題生成
const generateProblemsByDifficulty = (difficulty, count = 10, requestId = null) => {
    const problems = [];
    const baseSeed = getDateSeed();
    const startTime = Date.now();
    
    // 処理状態を記録
    if (requestId) {
      processingStatusMap.set(requestId, {
        startTime,
        difficulty,
        count,
        progress: 0,
        status: 'processing'
      });
    }

    // expert難易度の場合は問題数を制限（タイムアウト防止）
    const actualCount = difficulty === DifficultyRank.EXPERT && count > 10 ? 10 : count;
    if (difficulty === DifficultyRank.EXPERT && count > 10) {
      console.warn(`[ProblemGenerator] Expert難易度では最大10問に制限されています (${count}要求 -> 10生成)`);
    }

    let generatedCount = 0;
    let generationAttempts = 0;
    const maxGenerationAttempts = actualCount * 15; // 試行回数も削減
    const usedQuestions = new Set();

    // 並行処理を避けるためにシリアルに処理
    for (let i = 0; i < actualCount && generationAttempts < maxGenerationAttempts; i++) {
        generationAttempts++;
        
        // 30秒のタイムアウトチェック
        if (checkTimeout(startTime, 25000)) {
          console.warn(`[generateProblemsByDifficulty] Timeout detected after generating ${generatedCount} problems. Returning partial results.`);
          
          // 状態を更新
          if (requestId) {
            processingStatusMap.set(requestId, {
              ...processingStatusMap.get(requestId),
              progress: (generatedCount / actualCount) * 100,
              status: 'timeout',
              endTime: Date.now()
            });
          }
          
          // 部分的な結果を返す
          return problems;
        }
        
        const seed = baseSeed + i * 1000 + generationAttempts;
        const problemData = generateSingleProblem(difficulty, seed);

        if (problemData && !usedQuestions.has(problemData.question)) {
            problems.push({ 
               question: problemData.question,
               answer: problemData.answer,
               options: problemData.options
            });
            usedQuestions.add(problemData.question);
            generatedCount++;
            
            // 進捗状況を更新
            if (requestId) {
              processingStatusMap.set(requestId, {
                ...processingStatusMap.get(requestId),
                progress: (generatedCount / actualCount) * 100
              });
            }
        } else {
            // 重複問題または生成失敗の場合、インデックスを1つ戻す
            i--;
        }
    }

    // 完了状態を更新
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
export const generateProblems = (difficulty, count = 10, seed = null, requestId = null) => {
  try {
    // シード値がなければ現在時刻をシードとして使用
    const actualSeed = seed || Date.now();
    console.log(`[ProblemGenerator] ${count}問の生成開始 (${difficulty}) シード値: ${actualSeed}`);
    
    // 要求された処理の開始を記録
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
    
    // 決定論的な問題生成のためのシード値を設定
    let seedValue = typeof actualSeed === 'string' 
      ? actualSeed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : Number(actualSeed);
    
    const problems = [];
    const maxAttempts = count * 5; // 最大試行回数 
    let attempts = 0;
    
    while (problems.length < count && attempts < maxAttempts) {
      attempts++;
      
      // シード値を問題ごとに変えるが、再現性を保つ
      const problemSeed = seedValue + attempts * 1000;
      
      try {
        // 難易度に基づいて問題を生成
        const problem = generateSingleProblem(difficulty, problemSeed);
        
        if (problem && problem.answer !== undefined) {
          // 重複チェック
          const isDuplicate = problems.some(p => p.question === problem.question);
          
          if (!isDuplicate) {
            problems.push(problem);
            
            // 進捗状況を更新
            if (requestId) {
              const progress = Math.round((problems.length / count) * 100);
              processingStatusMap.set(requestId, {
                ...processingStatusMap.get(requestId),
                progress,
                problems: [...problems], // 中間結果を保存
              });
            }
          }
        }
      } catch (error) {
        console.warn(`問題生成中のエラー（スキップして続行）: ${error.message}`);
      }
      
      // リクエストがタイムアウトした場合は途中結果を返す
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
    
    // 生成した問題数が0の場合はフォールバック問題を生成
    if (problems.length === 0) {
      console.warn(`問題生成に失敗したため、フォールバック問題を使用します`);
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        // シード値に基づくフォールバック問題
        const fallbackSeed = seedValue + i * 1000;
        problems.push(generateFallbackProblem(difficulty, fallbackSeed));
      }
    }
    
    // パフォーマンス測定
    const endTime = performance.now();
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    const memUsed = (memAfter - memBefore).toFixed(2);
    
    console.log(`[ProblemGenerator] ${problems.length}問生成完了 (${difficulty}), 使用メモリ: ${memUsed}MB`);
    
    if (requestId) {
      processingStatusMap.set(requestId, {
        ...processingStatusMap.get(requestId),
        status: 'completed',
        endTime: Date.now(),
        count: problems.length
      });
    }
    
    return problems;
  } catch (error) {
    console.error('[ProblemGenerator] 問題生成中の重大エラー:', error);
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