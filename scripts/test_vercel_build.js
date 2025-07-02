#!/usr/bin/env node

/**
 * Vercel Build Test Script
 * ローカル環境でVercelビルドプロセスをテストする
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Vercel Build Test Started');
console.log('=====================================');

// テスト用環境変数設定
process.env.NODE_ENV = 'production';
process.env.MONGODB_MOCK = 'true';
process.env.VERCEL = '1';
process.env.VERCEL_ENV = 'preview';

function runCommand(command, description) {
  console.log(`\n📋 ${description}`);
  console.log(`💻 Command: ${command}`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    console.log('✅ Success');
    if (output.trim()) {
      console.log(`📝 Output:\n${output.trim()}`);
    }
    return { success: true, output };
  } catch (error) {
    console.log('❌ Failed');
    console.log(`💥 Error: ${error.message}`);
    if (error.stdout) {
      console.log(`📝 Stdout:\n${error.stdout}`);
    }
    if (error.stderr) {
      console.log(`📝 Stderr:\n${error.stderr}`);
    }
    return { success: false, error };
  }
}

function checkFileExists(filePath, description) {
  console.log(`\n🔍 ${description}`);
  const exists = fs.existsSync(filePath);
  console.log(`📁 Path: ${filePath}`);
  console.log(exists ? '✅ Exists' : '❌ Not found');
  return exists;
}

function analyzeVercelConfig() {
  console.log('\n📋 Analyzing vercel.json configuration');
  
  try {
    const configPath = path.join(process.cwd(), 'vercel.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('✅ vercel.json is valid JSON');
    console.log(`📝 Build Command: ${config.buildCommand}`);
    console.log(`📝 Output Directory: ${config.outputDirectory}`);
    console.log(`📝 Functions Config:`, JSON.stringify(config.functions, null, 2));
    
    return { success: true, config };
  } catch (error) {
    console.log('❌ vercel.json analysis failed');
    console.log(`💥 Error: ${error.message}`);
    return { success: false, error };
  }
}

function checkAPIFiles() {
  console.log('\n📋 Checking API files structure');
  
  const apiDir = path.join(process.cwd(), 'api');
  if (!fs.existsSync(apiDir)) {
    console.log('❌ api/ directory not found');
    return false;
  }
  
  const jsFiles = [];
  function scanDir(dir, relativePath = '') {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const itemRelativePath = path.join(relativePath, item);
      
      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath, itemRelativePath);
      } else if (item.endsWith('.js')) {
        jsFiles.push(itemRelativePath);
      }
    }
  }
  
  scanDir(apiDir);
  
  console.log(`✅ Found ${jsFiles.length} JS files in api/ directory:`);
  jsFiles.forEach(file => console.log(`  📄 ${file}`));
  
  return jsFiles.length > 0;
}

// メイン実行
async function main() {
  let allPassed = true;
  
  // 1. 環境変数検証
  const envTest = runCommand('node scripts/validate_env.mjs', 'Environment validation');
  if (!envTest.success) allPassed = false;
  
  // 2. vercel.json 設定確認
  const configAnalysis = analyzeVercelConfig();
  if (!configAnalysis.success) allPassed = false;
  
  // 3. API ファイル構造確認
  const apiCheck = checkAPIFiles();
  if (!apiCheck) allPassed = false;
  
  // 4. ビルド実行
  const buildTest = runCommand('npm run build:vercel', 'Vercel build execution');
  if (!buildTest.success) allPassed = false;
  
  // 5. ビルド成果物確認
  const distCheck = checkFileExists('dist/index.html', 'Checking build output');
  if (!distCheck) allPassed = false;
  
  // 6. .vercelignore 確認
  const ignoreCheck = checkFileExists('.vercelignore', 'Checking .vercelignore');
  if (!ignoreCheck) {
    console.log('⚠️  .vercelignore not found - potential function conflicts');
  }
  
  // 結果サマリー
  console.log('\n=====================================');
  console.log('🏁 Vercel Build Test Summary');
  console.log('=====================================');
  
  if (allPassed) {
    console.log('✅ All tests passed! Ready for Vercel deployment.');
    console.log('💡 Next steps:');
    console.log('   1. git add . && git commit -m "fix: vercel functions configuration"');
    console.log('   2. git push origin main');
    console.log('   3. Check Vercel deployment logs');
  } else {
    console.log('❌ Some tests failed. Please address the issues above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});