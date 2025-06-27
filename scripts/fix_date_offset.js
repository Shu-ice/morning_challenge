#!/usr/bin/env node

/**
 * Date Offset Fix Script
 * Fixes existing data where dates were stored in UTC instead of JST
 * This corrects the one-day offset issue for data created before JST timezone fix
 */

const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';
const DB_NAME = 'morning_challenge';

// Helper function for logging
function log(message) {
  console.log(`[Date Fix] ${message}`);
}

function error(message) {
  console.error(`[Date Fix ERROR] ${message}`);
}

// UTC to JST date conversion helper
const toJSTDateString = (d = new Date()) => {
  return new Date(d.getTime() + 9*60*60*1000).toISOString().slice(0,10);
};

// Main fix function
async function fixDateOffset() {
  let client;
  
  try {
    log('🚀 Starting date offset fix...');
    log('='.repeat(60));
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    // Fix dailyproblemsets collection
    await fixDailyProblemSets(db);
    
    // Fix results collection
    await fixResults(db);
    
    log('='.repeat(60));
    log('🎉 Date offset fix completed successfully!');
    
  } catch (err) {
    error(`Unexpected error: ${err.message}`);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      log('✅ MongoDB connection closed');
    }
  }
}

// Fix dailyproblemsets collection
async function fixDailyProblemSets(db) {
  log('📚 Fixing dailyproblemsets collection...');
  
  const collection = db.collection('dailyproblemsets');
  
  // Find all documents with problematic dates (typically 2025-06-24 when it should be 2025-06-25)
  const today = toJSTDateString();
  const yesterday = toJSTDateString(new Date(Date.now() - 24*60*60*1000));
  
  log(`Looking for documents with date: ${yesterday} (should be ${today})`);
  
  const problemDocs = await collection.find({ date: yesterday }).toArray();
  log(`Found ${problemDocs.length} daily problem sets to fix`);
  
  if (problemDocs.length > 0) {
    // Update all documents with yesterday's date to today's date
    const updateResult = await collection.updateMany(
      { date: yesterday },
      { $set: { date: today } }
    );
    
    log(`✅ Updated ${updateResult.modifiedCount} daily problem sets from ${yesterday} to ${today}`);
  } else {
    log('ℹ️ No daily problem sets need fixing');
  }
}

// Fix results collection
async function fixResults(db) {
  log('📊 Fixing results collection...');
  
  const collection = db.collection('results');
  
  const today = toJSTDateString();
  const yesterday = toJSTDateString(new Date(Date.now() - 24*60*60*1000));
  
  log(`Looking for results with date: ${yesterday} (should be ${today})`);
  
  const resultDocs = await collection.find({ date: yesterday }).toArray();
  log(`Found ${resultDocs.length} results to fix`);
  
  if (resultDocs.length > 0) {
    // Update all documents with yesterday's date to today's date
    const updateResult = await collection.updateMany(
      { date: yesterday },
      { $set: { date: today } }
    );
    
    log(`✅ Updated ${updateResult.modifiedCount} results from ${yesterday} to ${today}`);
    
    // Also check if we need to update based on createdAt timestamps
    const createdAtStart = new Date(today + 'T00:00:00.000Z');
    const createdAtEnd = new Date(today + 'T23:59:59.999Z');
    
    const createdAtDocs = await collection.find({
      date: yesterday,
      createdAt: {
        $gte: createdAtStart,
        $lte: createdAtEnd
      }
    }).toArray();
    
    if (createdAtDocs.length > 0) {
      log(`Found ${createdAtDocs.length} additional results with createdAt in today's range but wrong date`);
      
      const createdAtUpdateResult = await collection.updateMany(
        {
          date: yesterday,
          createdAt: {
            $gte: createdAtStart,
            $lte: createdAtEnd
          }
        },
        { $set: { date: today } }
      );
      
      log(`✅ Fixed ${createdAtUpdateResult.modifiedCount} results based on createdAt timestamps`);
    }
  } else {
    log('ℹ️ No results need fixing');
  }
}

// Verification function
async function verifyFix() {
  let client;
  
  try {
    log('🔍 Verifying fixes...');
    
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    const today = toJSTDateString();
    
    // Check dailyproblemsets
    const problemSetsCount = await db.collection('dailyproblemsets').countDocuments({ date: today });
    log(`✅ Daily problem sets for ${today}: ${problemSetsCount}`);
    
    // Check results
    const resultsCount = await db.collection('results').countDocuments({ date: today });
    log(`✅ Results for ${today}: ${resultsCount}`);
    
    log('🎉 Verification completed!');
    
  } catch (err) {
    error(`Verification failed: ${err.message}`);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Command line arguments handling
const args = process.argv.slice(2);
const command = args[0];

if (command === '--verify' || command === '-v') {
  verifyFix();
} else if (command === '--help' || command === '-h') {
  console.log(`
Date Offset Fix Script

Usage:
  node fix_date_offset.js          # Run the fix
  node fix_date_offset.js --verify # Verify current state
  node fix_date_offset.js --help   # Show this help

Description:
  Fixes date offset issues where dates were stored in UTC instead of JST.
  This typically manifests as data appearing to be from yesterday when
  it should be from today (JST timezone).

Example dates fixed:
  2025-06-24 (UTC) -> 2025-06-25 (JST)
  
Collections affected:
  - dailyproblemsets
  - results
`);
} else {
  // Run the main fix
  fixDateOffset();
}

module.exports = { fixDateOffset, verifyFix };