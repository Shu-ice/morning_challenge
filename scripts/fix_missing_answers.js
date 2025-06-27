#!/usr/bin/env node

/**
 * Fix Missing Answers in DailyProblemSet Collection
 * Recalculates and sets missing 'correctAnswer' fields for beginner problems
 */

const mongoose = require('mongoose');

// MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';

// Function to calculate answer from question
function calculateAnswerFromQuestion(question) {
  try {
    // Remove ' = ?' from question
    const expression = question.replace(' = ?', '').trim();
    
    // Handle different operators
    if (expression.includes(' + ')) {
      const [a, b] = expression.split(' + ').map(x => parseFloat(x.trim()));
      return a + b;
    } else if (expression.includes(' - ')) {
      const [a, b] = expression.split(' - ').map(x => parseFloat(x.trim()));
      return a - b;
    } else if (expression.includes(' × ')) {
      const [a, b] = expression.split(' × ').map(x => parseFloat(x.trim()));
      return a * b;
    } else if (expression.includes(' ÷ ')) {
      const [a, b] = expression.split(' ÷ ').map(x => parseFloat(x.trim()));
      return a / b;
    }
    
    return null;
  } catch (error) {
    console.error(`Error calculating answer for "${question}":`, error.message);
    return null;
  }
}

async function fixMissingAnswers() {
  console.log('🔧 Starting missing answer repair...');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      dbName: 'morning_challenge',
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Define schema
    const dailyProblemSetSchema = new mongoose.Schema({
      date: String,
      difficulty: String,
      problems: Array,
      isActive: Boolean
    }, { timestamps: true });
    
    const DailyProblemSet = mongoose.models.DailyProblemSet || 
      mongoose.model('DailyProblemSet', dailyProblemSetSchema);
    
    // Find all problem sets
    const problemSets = await DailyProblemSet.find({});
    console.log(`📋 Found ${problemSets.length} problem sets to check`);
    
    let totalFixed = 0;
    let totalChecked = 0;
    
    for (const problemSet of problemSets) {
      let updated = false;
      const updatedProblems = [];
      
      for (const problem of problemSet.problems) {
        totalChecked++;
        
        // Check if answer or correctAnswer is missing/undefined
        const hasAnswer = problem.answer !== undefined && problem.answer !== null;
        const hasCorrectAnswer = problem.correctAnswer !== undefined && problem.correctAnswer !== null;
        
        if (!hasAnswer && !hasCorrectAnswer) {
          // Calculate answer from question
          const calculatedAnswer = calculateAnswerFromQuestion(problem.question);
          
          if (calculatedAnswer !== null && Number.isFinite(calculatedAnswer)) {
            problem.answer = Math.round(calculatedAnswer);
            problem.correctAnswer = Math.round(calculatedAnswer);
            console.log(`🔧 Fixed: ${problem.question} → answer: ${problem.answer}`);
            totalFixed++;
            updated = true;
          } else {
            console.warn(`⚠️  Could not calculate answer for: ${problem.question}`);
          }
        } else if (!hasCorrectAnswer && hasAnswer) {
          // Set correctAnswer from answer
          problem.correctAnswer = problem.answer;
          console.log(`📝 Set correctAnswer from answer: ${problem.question} → ${problem.correctAnswer}`);
          totalFixed++;
          updated = true;
        } else if (!hasAnswer && hasCorrectAnswer) {
          // Set answer from correctAnswer
          problem.answer = problem.correctAnswer;
          console.log(`📝 Set answer from correctAnswer: ${problem.question} → ${problem.answer}`);
          totalFixed++;
          updated = true;
        }
        
        updatedProblems.push(problem);
      }
      
      // Save if updated
      if (updated) {
        problemSet.problems = updatedProblems;
        await problemSet.save();
        console.log(`💾 Updated problem set: ${problemSet.date} (${problemSet.difficulty})`);
      }
    }
    
    console.log('📊 Repair Summary:');
    console.log(`   Total problems checked: ${totalChecked}`);
    console.log(`   Problems fixed: ${totalFixed}`);
    console.log('✅ Missing answer repair completed!');
    
  } catch (error) {
    console.error('❌ Error during repair:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Mongo shell one-liner for manual execution
const mongoShellCommand = `
// MongoDB Shell One-liner:
db.dailyproblemsets.find({}).forEach(function(doc) {
  var updated = false;
  doc.problems.forEach(function(problem, index) {
    if (!problem.answer && !problem.correctAnswer && problem.question) {
      var expr = problem.question.replace(' = ?', '').trim();
      var answer = null;
      if (expr.includes(' + ')) {
        var parts = expr.split(' + ');
        answer = parseFloat(parts[0]) + parseFloat(parts[1]);
      } else if (expr.includes(' - ')) {
        var parts = expr.split(' - ');
        answer = parseFloat(parts[0]) - parseFloat(parts[1]);
      } else if (expr.includes(' × ')) {
        var parts = expr.split(' × ');
        answer = parseFloat(parts[0]) * parseFloat(parts[1]);
      } else if (expr.includes(' ÷ ')) {
        var parts = expr.split(' ÷ ');
        answer = parseFloat(parts[0]) / parseFloat(parts[1]);
      }
      if (answer !== null && isFinite(answer)) {
        problem.answer = Math.round(answer);
        problem.correctAnswer = Math.round(answer);
        updated = true;
        print('Fixed: ' + problem.question + ' → ' + problem.answer);
      }
    }
  });
  if (updated) {
    db.dailyproblemsets.save(doc);
    print('Updated: ' + doc.date + ' (' + doc.difficulty + ')');
  }
});
`;

console.log('\n' + '='.repeat(60));
console.log('MONGO SHELL ONE-LINER:');
console.log('='.repeat(60));
console.log(mongoShellCommand);
console.log('='.repeat(60));

// Run the repair if executed directly
if (require.main === module) {
  fixMissingAnswers();
}

module.exports = { fixMissingAnswers };