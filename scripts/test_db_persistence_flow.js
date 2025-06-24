#!/usr/bin/env node

/**
 * E2E Test for DB Persistence & Scoring Logic
 * Tests the complete flow: GET → edit → POST → ranking
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

// Helper functions
function log(message) {
  console.log(`[E2E Test] ${message}`);
}

function error(message) {
  console.error(`[E2E Test ERROR] ${message}`);
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
      log('✅ Login successful');
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

async function testGetProblems() {
  log('Step 2: Testing GET /api/problems (DB persistence check)...');
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // First call - should check DB and generate if not found
    const response1 = await axios.get(`${BASE_URL}/problems`, {
      headers,
      params: { difficulty: 'beginner' }
    });

    if (!response1.data.success || !response1.data.problems) {
      error('First problems API call failed');
      return false;
    }

    log(`✅ First call: Got ${response1.data.problems.length} problems (source: ${response1.data.source || 'unknown'})`);
    const firstCallProblems = response1.data.problems;

    await delay(1000);

    // Second call - should retrieve from DB
    const response2 = await axios.get(`${BASE_URL}/problems`, {
      headers,
      params: { difficulty: 'beginner' }
    });

    if (!response2.data.success || !response2.data.problems) {
      error('Second problems API call failed');
      return false;
    }

    log(`✅ Second call: Got ${response2.data.problems.length} problems (source: ${response2.data.source || 'unknown'})`);
    
    // Verify problems are the same (from DB)
    if (firstCallProblems.length !== response2.data.problems.length) {
      error('Problem count mismatch between calls');
      return false;
    }

    // Check if IDs match (persistence verification)
    const firstIds = firstCallProblems.map(p => p.id).sort();
    const secondIds = response2.data.problems.map(p => p.id).sort();
    const idsMatch = firstIds.every((id, index) => id === secondIds[index]);

    if (idsMatch) {
      log('✅ Problem IDs match - DB persistence working');
    } else {
      error('Problem IDs don\'t match - DB persistence may be failing');
      return false;
    }

    return { problems: firstCallProblems };
  } catch (err) {
    error(`Get problems failed: ${err.message}`);
    return false;
  }
}

async function testSubmitAnswers(problems) {
  log('Step 3: Testing POST /api/problems (submission with problemIds)...');
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // Create test answers (mix of correct and incorrect)
    const answers = problems.map((_, index) => {
      // Make some answers correct, some incorrect
      return index % 2 === 0 ? '42' : '999'; // Dummy answers
    });

    const problemIds = problems.map(p => p.id);
    
    const submissionData = {
      problemIds: problemIds,
      answers: answers,
      difficulty: 'beginner',
      date: new Date().toISOString().split('T')[0],
      timeToComplete: 180000 // 3 minutes
    };

    log(`Submitting answers for ${problemIds.length} problems with IDs: ${problemIds.slice(0, 3).join(', ')}...`);

    const response = await axios.post(`${BASE_URL}/problems`, submissionData, { headers });

    if (!response.data.success) {
      error('Answer submission failed');
      return false;
    }

    const results = response.data.results;
    if (!results || !results.results || !Array.isArray(results.results)) {
      error('Invalid results structure');
      return false;
    }

    log(`✅ Submission successful: ${results.correctAnswers}/${results.totalProblems} correct`);
    log(`✅ Detailed results count: ${results.results.length}`);
    
    // Verify problemIds order was respected
    const returnedIds = results.results.map(r => r.id);
    const idsInOrder = problemIds.every((id, index) => id === returnedIds[index]);
    
    if (idsInOrder) {
      log('✅ Problem order preserved based on problemIds');
    } else {
      error('Problem order not preserved - problemIds logic may be failing');
      return false;
    }

    return results;
  } catch (err) {
    error(`Submit answers failed: ${err.message}`);
    if (err.response) {
      error(`Response status: ${err.response.status}`);
      error(`Response data: ${JSON.stringify(err.response.data)}`);
    }
    return false;
  }
}

async function testRankingReflection() {
  log('Step 4: Testing ranking/history reflection...');
  try {
    const headers = { Authorization: `Bearer ${authToken}` };
    
    // Test history endpoint
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
    
    // Check if today's result is there
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = historyData.find(entry => entry.date === today && entry.difficulty === 'beginner');
    
    if (todayEntry) {
      log('✅ Today\'s result found in history');
      log(`   Score: ${todayEntry.correctAnswers}/${todayEntry.totalProblems}`);
    } else {
      error('Today\'s result not found in history');
      return false;
    }

    return true;
  } catch (err) {
    error(`Ranking/History test failed: ${err.message}`);
    return false;
  }
}

// Main test function
async function runE2ETest() {
  log('🚀 Starting E2E Test for DB Persistence & Scoring Logic');
  log('='.repeat(60));

  try {
    // Step 1: Login
    if (!(await testLogin())) {
      process.exit(1);
    }

    // Step 2: Get problems (test DB persistence)
    const problemsResult = await testGetProblems();
    if (!problemsResult) {
      process.exit(1);
    }

    // Step 3: Submit answers (test new schema with problemIds)
    if (!(await testSubmitAnswers(problemsResult.problems))) {
      process.exit(1);
    }

    // Step 4: Check ranking/history reflection
    if (!(await testRankingReflection())) {
      process.exit(1);
    }

    log('='.repeat(60));
    log('🎉 All E2E tests passed successfully!');
    log('✅ DB persistence working');
    log('✅ New submission schema working');
    log('✅ ProblemIds order preservation working');
    log('✅ Results saved to database');
    log('✅ History/ranking reflection working');

  } catch (err) {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runE2ETest();
}

module.exports = { runE2ETest };