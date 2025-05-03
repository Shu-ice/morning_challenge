const mongoose = require('mongoose');

const ProblemSchema = new mongoose.Schema({
  question: {
    type: String,
    required: [true, '問題文は必須です']
  },
  answer: {
    type: Number,
    required: [true, '答えは必須です']
  },
  grade: {
    type: Number,
    required: [true, '学年は必須です'],
    min: 1,
    max: 6
  },
  type: {
    type: String,
    enum: ['addition', 'subtraction', 'multiplication', 'division'],
    required: [true, '問題の種類は必須です']
  },
  difficulty: {
    type: Number,
    required: [true, '難易度は必須です'],
    min: 1,
    max: 10
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Problem', ProblemSchema);