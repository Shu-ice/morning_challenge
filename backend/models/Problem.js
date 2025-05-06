const mongoose = require('mongoose');

const problemSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: Number,
    required: true,
  },
  grade: {
    type: Number,
    required: true,
    min: 1,
    max: 6,
  },
  type: {
    type: String,
    required: true,
    enum: ['addition', 'subtraction', 'multiplication', 'division', 'mixed'],
  },
  difficulty: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced', 'expert'],
  },
  date: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Problem', problemSchema);