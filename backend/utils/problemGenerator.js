/**
 * 学年に応じた問題を生成するユーティリティ
 */

import seedrandom from 'seedrandom'; // シード値を扱うために import

// --- 難易度ごとの設定 ---
const DIFFICULTY_CONFIGS = {
  beginner: { // 小1-2想定
    problemTypes: ['integer_addition', 'integer_subtraction'],
    count: 10,
    params: {
      integer_addition: { maxResult: 20, maxTerms: 2, termRange: [1, 9] },
      integer_subtraction: { maxMinuend: 20, termRange: [1, 9] }, // 被減数が最大20
    },
  },
  intermediate: { // 小3-4想定
    problemTypes: ['integer_addition', 'integer_subtraction', 'integer_multiplication', 'simple_division'],
    count: 10,
    params: {
      integer_addition: { maxResult: 1000, maxTerms: 2, termRange: [10, 99] },
      integer_subtraction: { maxMinuend: 1000, termRange: [10, 99] },
      integer_multiplication: { term1Range: [2, 9], term2Range: [2, 9] }, // 九九の範囲メイン
      simple_division: { maxDividend: 81, divisorRange: [2, 9] }, // 九九の範囲で割り切れる
    },
  },
  advanced: { // 小5-6想定
    problemTypes: ['decimal_addition_subtraction', 'integer_multiplication_division', 'fraction_addition_subtraction_same_denominator'],
    count: 10,
    params: {
      decimal_addition_subtraction: { precision: 1, termRange: [0.1, 99.9], maxTerms: 2 }, // 小数第一位まで
      integer_multiplication_division: { term1Range: [10, 99], term2Range: [2, 99] }, // 2桁×1桁or2桁
      fraction_addition_subtraction_same_denominator: { maxDenominator: 10, maxNumerator: 9 },
    },
  },
  expert: { // 超級 (さらに桁数を増やす)
    problemTypes: ['decimal_multiplication_division', 'multi_step_integer_arithmetic', 'fraction_addition_subtraction_different_denominators'],
    count: 10,
    params: {
      decimal_multiplication_division: { precision: 2, term1Range: [0.1, 99.9], term2Range: [0.1, 9.9] }, // 小数第二位まで
      multi_step_integer_arithmetic: { numOperations: 2, termRange: [10, 999], operators: ['+', '-', '*'] }, // 3項以上の演算、括弧なし
      fraction_addition_subtraction_different_denominators: { maxDenominator: 12, maxNumerator: 11 },
    },
  },
};

/**
 * 指定された学年の問題セットを生成する
 * @param {number} grade - 学年 (1-6)
 * @param {number} count - 生成する問題数 
 * @returns {Array} 問題のリスト
 */
const generateProblemsForGrade = (grade, count = 10) => {
  const problems = [];
  
  for (let i = 0; i < count; i++) {
    let problem;
    
    switch(grade) {
      case 1:
        // 1年生: 10以下の加算
        problem = generateAdditionProblem(10);
        break;
      case 2:
        // 2年生: 20以下の加減算
        problem = Math.random() > 0.5 
          ? generateAdditionProblem(20) 
          : generateSubtractionProblem(20);
        break;
      case 3:
        // 3年生: 100以下の加減算、かんたんな掛け算
        if (Math.random() > 0.7) {
          problem = generateMultiplicationProblem(10, 3);
        } else {
          problem = Math.random() > 0.5 
            ? generateAdditionProblem(100, 4) 
            : generateSubtractionProblem(100, 4);
        }
        break;
      case 4:
        // 4年生: 3桁の加減算、掛け算、簡単な割り算
        const randOp4 = Math.random();
        if (randOp4 > 0.7) {
          problem = generateMultiplicationProblem(12, 5);
        } else if (randOp4 > 0.4) {
          problem = generateDivisionProblem(undefined, 5);
        } else {
          problem = Math.random() > 0.5 
            ? generateAdditionProblem(1000, 6) 
            : generateSubtractionProblem(1000, 6);
        }
        break;
      case 5:
      case 6:
        // 5-6年生: 4桁の加減算、2桁同士の掛け算、割り算
        const randOp56 = Math.random();
        if (randOp56 > 0.7) {
          problem = generateMultiplicationProblem(grade === 5 ? 20 : 100, grade === 5 ? 7 : 9);
        } else if (randOp56 > 0.4) {
          problem = generateDivisionProblem(grade === 5 ? 20 : 100, grade === 5 ? 7 : 9);
        } else {
          problem = Math.random() > 0.5 
            ? generateAdditionProblem(10000, grade === 5 ? 7 : 8) 
            : generateSubtractionProblem(10000, grade === 5 ? 7 : 8);
        }
        break;
      default:
        problem = generateAdditionProblem(10);
    }
    
    problems.push(problem);
  }
  
  return problems;
};

/**
 * 足し算の問題を生成する
 * @param {number} max - 最大値
 * @param {number} difficulty - 難易度 (1-10)
 * @returns {Object} 生成された問題
 */
const generateAdditionProblem = (max, difficulty = 2) => {
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * max) + 1;
  
  return {
    question: `${a} + ${b} = ?`,
    answer: a + b,
    type: 'addition',
    difficulty
  };
};

/**
 * 引き算の問題を生成する
 * @param {number} max - 最大値
 * @param {number} difficulty - 難易度 (1-10)
 * @returns {Object} 生成された問題
 */
const generateSubtractionProblem = (max, difficulty = 3) => {
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * a) + 1; // 負の答えを避けるためにa以下の値とする
  
  return {
    question: `${a} - ${b} = ?`,
    answer: a - b,
    type: 'subtraction',
    difficulty
  };
};

/**
 * 掛け算の問題を生成する
 * @param {number} max - 最大値
 * @param {number} difficulty - 難易度 (1-10)
 * @returns {Object} 生成された問題
 */
const generateMultiplicationProblem = (max, difficulty = 5) => {
  const a = Math.floor(Math.random() * max) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  
  return {
    question: `${a} × ${b} = ?`,
    answer: a * b,
    type: 'multiplication',
    difficulty
  };
};

/**
 * 割り算の問題を生成する
 * @param {number} max - 最大値
 * @param {number} difficulty - 難易度 (1-10)
 * @returns {Object} 生成された問題
 */
const generateDivisionProblem = (max = 10, difficulty = 6) => {
  const b = Math.floor(Math.random() * 9) + 2; // 2-10の除数
  const a = b * (Math.floor(Math.random() * max) + 1); // 割り切れる数値
  
  return {
    question: `${a} ÷ ${b} = ?`,
    answer: a / b,
    type: 'division',
    difficulty
  };
};

// --- 問題生成のメイン関数 ---
export function generateProblems(difficulty, count, seed) {
  const config = DIFFICULTY_CONFIGS[difficulty];
  if (!config) {
    console.error(`[ProblemGenerator] Invalid difficulty: ${difficulty}`);
    // フォールバックとして簡単な問題を返すか、エラーを投げる
    return generateFallbackProblems(count);
  }

  const rng = seedrandom(seed); // シードに基づいて乱数生成器を初期化
  const problems = [];
  const problemTypesToGenerate = config.problemTypes;

  for (let i = 0; i < (count || config.count); i++) {
    // 設定された問題タイプからランダムに選択 (rngを使用)
    const problemType = problemTypesToGenerate[Math.floor(rng() * problemTypesToGenerate.length)];
    const problemParams = config.params[problemType];
    let problem;

    try {
      switch (problemType) {
        case 'integer_addition':
          problem = generateIntegerAddition(problemParams, rng);
          break;
        case 'integer_subtraction':
          problem = generateIntegerSubtraction(problemParams, rng);
          break;
        case 'integer_multiplication':
          problem = generateIntegerMultiplication(problemParams, rng);
          break;
        case 'simple_division': // 割り切れる整数の割り算
          problem = generateSimpleDivision(problemParams, rng);
          break;
        case 'decimal_addition_subtraction':
          problem = generateDecimalAdditionSubtraction(problemParams, rng, difficulty); // difficultyを渡す
          break;
        case 'integer_multiplication_division':
          problem = rng() > 0.5 ? generateIntegerMultiplication(problemParams, rng) : generateSimpleDivision(problemParams, rng);
          break;
        // TODO: 他の問題タイプ の生成関数を追加
        default:
          console.warn(`[ProblemGenerator] Unknown problem type: ${problemType}. Falling back for this problem.`);
          problem = generateIntegerAddition({ maxResult: 10, maxTerms: 2, termRange: [1, 5] }, rng);
      }
      if (problem) {
        problems.push({ ...problem, type: problemType, difficulty });
      }
    } catch (e) {
      console.error(`[ProblemGenerator] Error generating problem type ${problemType}:`, e);
      problems.push(generateIntegerAddition({ maxResult: 10, maxTerms: 2, termRange: [1, 5] }, rng));
    }
  }
  return problems;
}

function generateFallbackProblems(count = 10) {
  const problems = [];
  const fallbackRng = seedrandom();
  for (let i = 0; i < count; i++) {
    problems.push(generateIntegerAddition({ maxResult: 10, maxTerms: 2, termRange: [1, 5] }, fallbackRng));
  }
  return problems;
}

function generateIntegerAddition(params, rng) {
  const numTerms = params.maxTerms || 2;
  let sum = 0;
  let question = '';
  for (let i = 0; i < numTerms; i++) {
    const term = Math.floor(rng() * (params.termRange[1] - params.termRange[0] + 1)) + params.termRange[0];
    sum += term;
    question += (i > 0 ? ' + ' : '') + term;
  }
  if (params.maxResult && sum > params.maxResult && numTerms === 2) {
     if (sum > params.maxResult * 1.2) { 
         return generateIntegerAddition(params,rng);
     }
  }
  return { question: `${question} = ?`, answer: sum.toString() };
}

function generateIntegerSubtraction(params, rng) {
  const minuend = Math.floor(rng() * (params.maxMinuend - params.termRange[0] + 1)) + params.termRange[0];
  const subtrahend = Math.floor(rng() * (minuend - params.termRange[0])) + params.termRange[0];
  if (minuend <= subtrahend && params.termRange[0] < minuend ) {
      if (minuend > params.termRange[0]) { // Ensure minuend is not equal to termRange[0] if that's the only option for subtrahend
         return generateIntegerSubtraction(params, rng); 
      }
      // If minuend is already at its smallest (equal to termRange[0]), we can't form a valid subtraction that fits beginner rules.
      // This case indicates an issue with parameter ranges or a need for a different problem type.
      // For now, let's return a very simple fallback or log an error.
      // console.warn("[ProblemGenerator] Could not generate valid subtraction with given params, returning fallback.");
      return generateIntegerAddition({ maxResult: 10, maxTerms: 2, termRange: [1, 5] }, rng); // Fallback
  }
  const answer = minuend - subtrahend;
  return { question: `${minuend} - ${subtrahend} = ?`, answer: answer.toString() };
}

function generateIntegerMultiplication(params, rng) {
  const term1 = Math.floor(rng() * (params.term1Range[1] - params.term1Range[0] + 1)) + params.term1Range[0];
  const term2 = Math.floor(rng() * (params.term2Range[1] - params.term2Range[0] + 1)) + params.term2Range[0];
  return { question: `${term1} × ${term2} = ?`, answer: (term1 * term2).toString() };
}

function generateSimpleDivision(params, rng) { 
  const divisor = Math.floor(rng() * (params.divisorRange[1] - params.divisorRange[0] + 1)) + params.divisorRange[0];
  if (divisor === 0) { // Should not happen with typical ranges [2,9] but good check
      return generateSimpleDivision(params, rng); // Avoid division by zero
  }
  const quotient = Math.floor(rng() * (params.maxDividend / divisor - 1 + 1)) + 1; 
  const dividend = divisor * quotient;
  return { question: `${dividend} ÷ ${divisor} = ?`, answer: quotient.toString() };
}

function difficultyNeedsPositiveResult(difficulty) {
    // Define which difficulties must have positive results for subtraction
    return ['beginner', 'intermediate'].includes(difficulty);
}

function generateDecimalAdditionSubtraction(params, rng, difficulty) { // Added difficulty
    const precision = params.precision || 1;
    const scale = Math.pow(10, precision);
    const numTerms = params.maxTerms || 2;
    let resultAsFloat = 0;
    let question = '';
    const operations = []; // Store operations if more than two terms

    // Generate first term
    let firstTerm = (Math.floor(rng() * (params.termRange[1] * scale - params.termRange[0] * scale + 1)) + params.termRange[0] * scale) / scale;
    resultAsFloat = firstTerm;
    question = firstTerm.toFixed(precision);

    for (let i = 1; i < numTerms; i++) {
        const operation = rng() > 0.5 ? '+' : '-';
        operations.push(operation);
        let nextTerm = (Math.floor(rng() * (params.termRange[1] * scale - params.termRange[0] * scale + 1)) + params.termRange[0] * scale) / scale;

        if (operation === '-') {
            // If subtraction might lead to negative and difficulty requires positive
            if (resultAsFloat - nextTerm < 0 && difficulty && difficultyNeedsPositiveResult(difficulty)) {
                // Try to make nextTerm smaller
                if (resultAsFloat > 0) { // Can only make smaller if current result is positive
                    nextTerm = (Math.floor(rng() * (resultAsFloat * scale))) / scale;
                     if (resultAsFloat - nextTerm < 0) { // still negative, try to generate smaller term
                         nextTerm = resultAsFloat; // makes result 0 for this step, or try to use a fraction of it
                     }
                } else { // Current result is 0 or negative, can't subtract further to stay positive
                    // Change operation to addition or skip term
                    question += ` + 0`; // Or handle differently
                    continue; // Skip this term's operation
                }
            }
            resultAsFloat -= nextTerm;
            question += ` - ${nextTerm.toFixed(precision)}`;
        } else {
            resultAsFloat += nextTerm;
            question += ` + ${nextTerm.toFixed(precision)}`;
        }
    }
    // Final formatting of the answer to handle floating point inaccuracies
    let answer = parseFloat(resultAsFloat.toFixed(precision));
    // Check for -0 and convert to 0
    if (Object.is(answer, -0)) {
      answer = 0;
    }
    return { question: `${question} = ?`, answer: answer.toString() };
}