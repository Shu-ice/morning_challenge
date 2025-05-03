const mongoose = require('mongoose');

const RecordSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 6
  },
  score: {
    type: Number,
    required: true
  },
  timeSpent: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    required: true
  },
  incorrectAnswers: {
    type: Number,
    required: true
  },
  problems: [
    {
      question: {
        type: String,
        required: true
      },
      answer: {
        type: Number,
        required: true
      },
      userAnswer: {
        type: Number
      },
      isCorrect: {
        type: Boolean
      }
    }
  ],
  // ランキング用のフィールド
  daily: {
    type: Boolean,
    default: true
  },
  weekly: {
    type: Boolean,
    default: true
  },
  monthly: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 日付での検索を容易にするためのインデックス
RecordSchema.index({ date: -1 });
RecordSchema.index({ user: 1, date: -1 });

// スコアでの検索を容易にするためのインデックス
RecordSchema.index({ score: -1 });
RecordSchema.index({ grade: 1, score: -1 });

module.exports = mongoose.model('Record', RecordSchema);
