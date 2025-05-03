const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'ユーザーIDは必須です']
  },
  date: {
    type: Date,
    default: Date.now
  },
  problems: [{
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Problem'
    },
    userAnswer: Number,
    isCorrect: Boolean,
    timeSpent: Number
  }],
  totalProblems: {
    type: Number,
    required: [true, '問題数は必須です']
  },
  correctAnswers: {
    type: Number,
    required: [true, '正解数は必須です']
  },
  totalTime: {
    type: Number,
    required: [true, '所要時間は必須です']
  },
  score: {
    type: Number,
    required: [true, 'スコアは必須です']
  },
  grade: {
    type: Number,
    required: [true, '学年は必須です'],
    min: 1,
    max: 6
  },
  completed: {
    type: Boolean,
    default: true
  }
});

// インデックスを作成して検索速度を向上
ResultSchema.index({ user: 1, date: -1 });
ResultSchema.index({ score: -1 });
ResultSchema.index({ date: -1 });

module.exports = mongoose.model('Result', ResultSchema);