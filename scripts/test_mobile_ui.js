#!/usr/bin/env node

/**
 * Mobile UI Test Script
 * Simulates mobile viewport testing for the TopNav component
 * Tests burger menu functionality and responsive design
 */

const { spawn } = require('child_process');
const path = require('path');

function log(message) {
  console.log(`[Mobile UI Test] ${message}`);
}

function error(message) {
  console.error(`[Mobile UI Test ERROR] ${message}`);
}

async function runMobileUITests() {
  log('🚀 Starting Mobile UI Tests');
  log('='.repeat(60));
  
  log('📱 Testing responsive navigation at different viewports:');
  log('   • 375px (iPhone SE) - Mobile layout');
  log('   • 640px (Tablet) - Breakpoint edge case');
  log('   • 1024px (Desktop) - Desktop layout');
  log('');
  
  log('🍔 Testing burger menu functionality:');
  log('   • Menu visibility at <640px viewport');
  log('   • Menu open/close interactions');
  log('   • Keyboard navigation (Escape key)');
  log('   • Backdrop click to close');
  log('   • ARIA attributes for accessibility');
  log('');
  
  log('🎨 Testing Apple-style design elements:');
  log('   • Backdrop blur effects');
  log('   • Smooth animations');
  log('   • Touch-friendly button sizes (44px min)');
  log('   • Safe area insets support');
  log('');

  return new Promise((resolve, reject) => {
    // Run the specific TopNav test
    const testProcess = spawn('npx', ['vitest', 'run', 'src/components/__tests__/TopNav.test.tsx', '--reporter=verbose'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log('');
        log('='.repeat(60));
        log('🎉 All Mobile UI Tests Passed!');
        log('✅ Responsive navigation working correctly');
        log('✅ Burger menu functional at mobile viewports');
        log('✅ Desktop navigation hidden on mobile (<640px)');
        log('✅ Mobile drawer opens/closes properly');
        log('✅ Accessibility features working');
        log('✅ Apple-style design preserved');
        resolve();
      } else {
        error('Some tests failed');
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    testProcess.on('error', (err) => {
      error(`Failed to run tests: ${err.message}`);
      log('');
      log('💡 To install test dependencies, run:');
      log('   npm install --save-dev vitest @testing-library/react @testing-library/jest-dom jsdom');
      log('');
      reject(err);
    });
  });
}

// Manual simulation for environments without testing framework
async function manualMobileUISimulation() {
  log('📋 Manual Mobile UI Test Checklist');
  log('='.repeat(60));
  
  log('');
  log('1. 📱 Mobile Viewport Test (375px):');
  log('   □ Open browser developer tools');
  log('   □ Set viewport to 375px × 667px (iPhone SE)');
  log('   □ Verify navigation links are hidden');
  log('   □ Verify burger menu (☰) is visible');
  log('   □ Click burger menu to open drawer');
  log('   □ Verify mobile navigation appears from right');
  log('   □ Verify backdrop blur effect');
  log('   □ Click backdrop to close menu');
  log('');
  
  log('2. 🖥️ Desktop Viewport Test (1024px):');
  log('   □ Set viewport to 1024px × 768px');
  log('   □ Verify navigation links are visible');
  log('   □ Verify burger menu is hidden');
  log('   □ Verify horizontal navigation layout');
  log('');
  
  log('3. 📱 Edge Case Test (640px):');
  log('   □ Set viewport to exactly 640px');
  log('   □ Verify desktop layout is shown');
  log('   □ Set viewport to 639px');
  log('   □ Verify mobile layout is shown');
  log('');
  
  log('4. ♿ Accessibility Test:');
  log('   □ Tab through navigation elements');
  log('   □ Press Escape key when mobile menu is open');
  log('   □ Verify ARIA attributes on burger button');
  log('   □ Test with screen reader if available');
  log('');
  
  log('5. 🎨 Apple Design Test:');
  log('   □ Verify smooth animations (0.3s cubic-bezier)');
  log('   □ Verify backdrop blur effect');
  log('   □ Verify 44px minimum touch targets');
  log('   □ Verify SF Pro Display font loading');
  log('   □ Verify rounded corners (8px, 12px)');
  log('');
  
  log('✨ Expected Behavior Summary:');
  log('• Mobile (<640px): Burger menu + slide-out drawer');
  log('• Desktop (≥640px): Horizontal navigation bar');
  log('• Smooth animations with Apple-style easing');
  log('• Accessible keyboard navigation');
  log('• Touch-friendly button sizes');
  log('');
}

// Command line handling
const args = process.argv.slice(2);
const command = args[0];

if (command === '--manual' || command === '-m') {
  manualMobileUISimulation();
} else if (command === '--help' || command === '-h') {
  console.log(`
Mobile UI Test Script

Usage:
  node test_mobile_ui.js          # Run automated tests
  node test_mobile_ui.js --manual # Show manual testing checklist
  node test_mobile_ui.js --help   # Show this help

Description:
  Tests the responsive mobile navigation with burger menu functionality.
  Verifies Apple-style design aesthetics and accessibility features.

Automated Tests:
  - Viewport responsiveness (375px, 640px, 1024px)
  - Burger menu show/hide behavior
  - Mobile drawer open/close functionality
  - Keyboard navigation (Escape key)
  - Accessibility (ARIA attributes)
  - Performance (rapid interactions)

Manual Tests:
  Use --manual flag for a comprehensive testing checklist
  to verify the UI manually in different browsers and devices.
`);
} else {
  // Run automated tests
  runMobileUITests().catch(() => {
    process.exit(1);
  });
}

module.exports = { runMobileUITests, manualMobileUISimulation };