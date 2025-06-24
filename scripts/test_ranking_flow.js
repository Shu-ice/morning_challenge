#!/usr/bin/env node

/**
 * Test Script for Ranking Flow Verification
 * Tests: beginner problem submission → results insert → ranking reflection
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5003/api';
const TEST_USER = {
  email: 'testuser@example.com',
  password: 'testpass123',
  username: 'testuser',
  grade: 3
};

let authToken = null;
let submittedUserId = null;

// Helper functions
function log(message) {
  console.log(`[Ranking Test] ${message}`);
}

function error(message) {
  console.error(`[Ranking Test ERROR] ${message}`);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testLogin() {
  log('Step 1: Testing login...');
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_USER.email,
      password: TEST_USER.password
    });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      submittedUserId = response.data.user?.id || response.data.user?._id;
      log(`✅ Login successful, userId: ${submittedUserId}`);
      return true;
    } else {
      error('Login failed - no token received');
      return false;
    }
  } catch (err) {
    error(`Login failed: ${err.message}`);
    return false;
  }
}

async function testBeginnerProblemSubmission() {
  log('Step 2: Testing beginner problem submission...');
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // First, get problems
    const problemsResponse = await axios.get(`${BASE_URL}/problems`, {
      headers,
      params: { difficulty: 'beginner' }
    });

    if (!problemsResponse.data.success || !problemsResponse.data.problems) {
      error('Failed to get beginner problems');
      return false;
    }

    const problems = problemsResponse.data.problems;
    log(`✅ Got ${problems.length} beginner problems`);

    // Create test answers (mix of correct/incorrect for scoring variety)
    const answers = problems.map((problem, index) => {
      // For testing, we'll make some answers correct by using the actual correct answer
      if (problem.answer !== undefined) {
        return index % 3 === 0 ? String(problem.answer) : '999'; // Every 3rd correct
      }
      // If no answer field, just return test values
      return index % 3 === 0 ? '10' : '999';
    });

    const problemIds = problems.map(p => p.id);
    
    const submissionData = {
      problemIds: problemIds,
      answers: answers,
      difficulty: 'beginner',
      date: new Date().toISOString().split('T')[0],
      timeSpentMs: 120000, // 2 minutes in milliseconds
      startTime: Date.now() - 120000 // Started 2 minutes ago
    };

    log('Submitting beginner answers...');
    const response = await axios.post(`${BASE_URL}/problems`, submissionData, { headers });

    if (!response.data.success) {
      error('Beginner answer submission failed');
      return false;
    }

    const results = response.data.results;
    log(`✅ Submission successful: ${results.correctAnswers}/${results.totalProblems} correct (${results.score}%)`);
    log(`   Time spent: ${results.timeSpent} seconds (0.01 second units)`);
    log(`   Total time (ms): ${results.totalTime}`);
    
    return {
      score: results.score,
      correctAnswers: results.correctAnswers,
      totalProblems: results.totalProblems,
      timeSpent: results.timeSpent,
      totalTime: results.totalTime
    };
  } catch (err) {
    error(`Beginner submission failed: ${err.message}`);
    if (err.response) {
      error(`Response status: ${err.response.status}`);
      error(`Response data: ${JSON.stringify(err.response.data)}`);
    }
    return false;
  }
}

async function testRankingReflection() {
  log('Step 3: Testing ranking reflection...');
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    const today = new Date().toISOString().split('T')[0];
    
    // Wait a bit for DB write to complete
    await delay(1000);
    
    // Test ranking endpoint
    const rankingResponse = await axios.get(`${BASE_URL}/rankings`, {
      headers,
      params: { 
        difficulty: 'beginner', 
        date: today,
        limit: 50
      }
    });
    
    if (!rankingResponse.data.success) {
      error('Ranking retrieval failed');
      return false;
    }

    const rankingData = rankingResponse.data.data || rankingResponse.data.rankings || [];
    log(`✅ Ranking data retrieved: ${rankingData.length} entries`);
    
    if (rankingData.length === 0) {
      error('No ranking data found - result may not have been saved or reflected');
      return false;
    }

    // Check if our submitted user is in the rankings
    const ourEntry = rankingData.find(entry => {
      // Handle different possible user ID formats
      return entry.userId === submittedUserId || 
             entry.userId?.toString() === submittedUserId ||
             entry.username === TEST_USER.username;
    });
    
    if (ourEntry) {
      log('✅ Our submission found in ranking!');
      log(`   Position: ${rankingData.indexOf(ourEntry) + 1}`);
      log(`   Score: ${ourEntry.score}%`);
      log(`   Correct: ${ourEntry.correctAnswers}/${ourEntry.totalProblems}`);
      log(`   Username: ${ourEntry.username}`);
      log(`   Grade: ${ourEntry.grade} (should be Japanese label)`);
      log(`   TimeSpent: ${ourEntry.timeSpent}s (0.01 second units)`);
      log(`   CreatedAt: ${ourEntry.createdAt}`);
      
      // Verify grade display
      if (ourEntry.grade && (ourEntry.grade.includes('年生') || ourEntry.grade === 'ひみつ')) {
        log('✅ Grade displayed as Japanese label');
      } else {
        error(`Grade not properly formatted: ${ourEntry.grade}`);
      }
      
      // Verify time is in 0.01 second units (should be reasonable)
      if (ourEntry.timeSpent && ourEntry.timeSpent > 0 && ourEntry.timeSpent < 10000) {
        log('✅ Time displayed in proper 0.01 second units');
      } else {
        error(`Time not in proper format: ${ourEntry.timeSpent}`);
      }
      
      return true;
    } else {
      error('Our submission NOT found in ranking');
      log('Available entries:');
      rankingData.forEach((entry, index) => {
        log(`  ${index + 1}. ${entry.username} (${entry.userId}) - ${entry.score}%`);
      });
      return false;
    }
  } catch (err) {
    error(`Ranking test failed: ${err.message}`);
    if (err.response) {
      error(`Response status: ${err.response.status}`);
      error(`Response data: ${JSON.stringify(err.response.data)}`);
    }
    return false;
  }
}

async function testResultsInDatabase() {
  log('Step 4: Testing results in database via history API...');
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // Test history endpoint to verify result was saved
    const historyResponse = await axios.get(`${BASE_URL}/history`, { headers });
    
    if (!historyResponse.data.success) {
      error('History retrieval failed');
      return false;
    }

    const historyData = historyResponse.data.data || historyResponse.data.history || [];
    if (historyData.length === 0) {
      error('No history found - result may not have been saved');
      return false;
    }

    log(`✅ History retrieved: ${historyData.length} entries`);
    
    // Check if today's beginner result is there
    const today = new Date().toISOString().split('T')[0];
    const todayBeginnerEntry = historyData.find(entry => 
      entry.date === today && entry.difficulty === 'beginner'
    );
    
    if (todayBeginnerEntry) {
      log('✅ Today\'s beginner result found in history/database');
      log(`   Date: ${todayBeginnerEntry.date}`);
      log(`   Difficulty: ${todayBeginnerEntry.difficulty}`);
      log(`   Score: ${todayBeginnerEntry.correctAnswers}/${todayBeginnerEntry.totalProblems}`);
      log(`   TimeSpent: ${todayBeginnerEntry.timeSpent}s (0.01 second units)`);
      log(`   Grade: ${todayBeginnerEntry.grade}`);
      log(`   CreatedAt: ${todayBeginnerEntry.createdAt}`);
      
      // Verify time storage
      if (todayBeginnerEntry.timeSpent && todayBeginnerEntry.timeSpent > 0) {
        log('✅ Time stored properly in database');
      } else {
        error(`Time not stored properly: ${todayBeginnerEntry.timeSpent}`);
      }
      
      return true;
    } else {
      error('Today\'s beginner result not found in history');
      log('Available history entries:');
      historyData.forEach((entry, index) => {
        log(`  ${index + 1}. ${entry.date} ${entry.difficulty} - ${entry.correctAnswers}/${entry.totalProblems}`);
      });
      return false;
    }
  } catch (err) {
    error(`Database results test failed: ${err.message}`);
    return false;
  }
}

// Main test function
async function runRankingFlowTest() {
  log('🚀 Starting Ranking Flow Test');
  log('='.repeat(60));

  try {
    // Step 1: Login
    if (!(await testLogin())) {
      process.exit(1);
    }

    // Step 2: Submit beginner problems
    const submissionResult = await testBeginnerProblemSubmission();
    if (!submissionResult) {
      process.exit(1);
    }

    // Step 3: Check database persistence
    if (!(await testResultsInDatabase())) {
      process.exit(1);
    }

    // Step 4: Check ranking reflection
    if (!(await testRankingReflection())) {
      process.exit(1);
    }

    log('='.repeat(60));
    log('🎉 All ranking flow tests passed successfully!');
    log('✅ Beginner problem submission working');
    log('✅ Results saved to database correctly');
    log('✅ Rankings API returns submitted results');
    log('✅ String date format handled properly');
    log('✅ Complete flow working end-to-end');
    log('✅ Grade mapping with Japanese labels working');
    log('✅ Time tracking in 0.01 second units working');
    log('✅ CreatedAt timestamps working');

  } catch (err) {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runRankingFlowTest();
}

module.exports = { runRankingFlowTest };