/**
 * 学年に応じた問題を生成するユーティリティ
 */

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

module.exports = {
  generateProblemsForGrade,
  generateAdditionProblem,
  generateSubtractionProblem,
  generateMultiplicationProblem,
  generateDivisionProblem
};