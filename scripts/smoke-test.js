#!/usr/bin/env node

/**
 * Production Smoke Tests
 * Verifies basic functionality of deployed application
 */

import axios from 'axios';
import { logger } from '../server/utils/logger.js';

const PRODUCTION_URL = process.env.PRODUCTION_URL || 'https://morning-math-challenge.vercel.app';
const TEST_TIMEOUT = 30000; // 30 seconds

class SmokeTest {
  constructor() {
    this.baseURL = PRODUCTION_URL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: TEST_TIMEOUT,
      headers: {
        'User-Agent': 'Morning-Challenge-Smoke-Test/1.0'
      }
    });
    this.testResults = [];
  }

  async runTest(name, testFn) {
    console.log(`🧪 Running: ${name}`);
    try {
      const startTime = Date.now();
      await testFn();
      const duration = Date.now() - startTime;
      this.testResults.push({ name, status: 'PASS', duration });
      console.log(`✅ ${name} - PASSED (${duration}ms)`);
    } catch (error) {
      this.testResults.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  async testHomePage() {
    const response = await this.client.get('/');
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    if (!response.data.includes('朝の計算チャレンジ')) {
      throw new Error('HomePage does not contain expected title');
    }
  }

  async testAPIHealth() {
    const response = await this.client.get('/api/health');
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    if (!response.data.success) {
      throw new Error('Health check failed');
    }
  }

  async testAPIProblems() {
    const response = await this.client.get('/api/problems?difficulty=beginner&date=2025-06-29');
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    if (!response.data.success || !Array.isArray(response.data.problems)) {
      throw new Error('Problems API did not return expected format');
    }
    if (response.data.problems.length === 0) {
      throw new Error('No problems returned');
    }
  }

  async testAPIRankings() {
    const response = await this.client.get('/api/rankings/daily?difficulty=beginner&date=2025-06-29');
    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }
    if (!response.data.success) {
      throw new Error('Rankings API did not return success');
    }
  }

  async testStaticAssets() {
    try {
      // Test if JavaScript bundle loads
      const jsResponse = await this.client.get('/assets/index.js', { 
        validateStatus: (status) => status === 200 || status === 404 
      });
      
      // Test if CSS loads
      const cssResponse = await this.client.get('/assets/index.css', { 
        validateStatus: (status) => status === 200 || status === 404 
      });
      
      if (jsResponse.status === 404 && cssResponse.status === 404) {
        throw new Error('No static assets found');
      }
    } catch (error) {
      // Try alternate asset paths
      const response = await this.client.get('/');
      if (!response.data.includes('script') && !response.data.includes('link')) {
        throw new Error('No script or CSS links found in HTML');
      }
    }
  }

  async run() {
    console.log(`🚀 Starting smoke tests for: ${this.baseURL}\n`);

    await this.runTest('Homepage loads correctly', () => this.testHomePage());
    await this.runTest('API health check', () => this.testAPIHealth());
    await this.runTest('Problems API works', () => this.testAPIProblems());
    await this.runTest('Rankings API works', () => this.testAPIRankings());
    await this.runTest('Static assets load', () => this.testStaticAssets());

    // Summary
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + (r.duration || 0), 0);

    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total time: ${totalDuration}ms`);

    if (failed > 0) {
      console.log('\n💥 Failed tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
      process.exit(1);
    }

    console.log('\n🎉 All smoke tests passed!');
  }
}

// Run smoke tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const smokeTest = new SmokeTest();
  smokeTest.run().catch(error => {
    console.error('💥 Smoke test runner failed:', error);
    process.exit(1);
  });
}

export default SmokeTest;