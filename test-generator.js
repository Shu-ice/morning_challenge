import { generateProblems } from './server/utils/problemGenerator.js';
import { DifficultyRank } from './server/constants/difficultyRank.js';

async function testGenerator() {
    console.log('=== 問題生成システムテスト開始 ===');
    
    try {
        console.log('Available DifficultyRank:', Object.keys(DifficultyRank));
        
        // 初級問題を2問生成してテスト
        console.log('\n--- 初級問題生成テスト ---');
        const beginnerProblems = await generateProblems('beginner', 2, 12345);
        console.log('初級問題数:', beginnerProblems.length);
        console.log('初級問題サンプル:', beginnerProblems.length > 0 ? beginnerProblems[0] : 'なし');
        
        // 中級問題を1問生成してテスト
        console.log('\n--- 中級問題生成テスト ---');
        const intermediateProblems = await generateProblems('intermediate', 1, 54321);
        console.log('中級問題数:', intermediateProblems.length);
        console.log('中級問題サンプル:', intermediateProblems.length > 0 ? intermediateProblems[0] : 'なし');
        
        // 超級問題を1問生成してテスト
        console.log('\n--- 超級問題生成テスト ---');
        const expertProblems = await generateProblems('expert', 1, 98765);
        console.log('超級問題数:', expertProblems.length);
        console.log('超級問題サンプル:', expertProblems.length > 0 ? expertProblems[0] : 'なし');
        
    } catch (error) {
        console.error('テスト中にエラーが発生:', error);
        console.error('スタック:', error.stack);
    }
    
    console.log('\n=== テスト完了 ===');
}

testGenerator(); 