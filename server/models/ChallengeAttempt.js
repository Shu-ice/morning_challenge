import mongoose from 'mongoose';

const ChallengeAttemptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true
  },
  dateKey: {
    type: String,
    index: true,
    required: true
  },
  type: {
    type: String,
    enum: ['MORNING','BONUS'],
    required: true
  },
  startedAt: {
    type: Date,
    required: true
  },
  finishedAt: {
    type: Date,
    required: true
  },
  correctCount: {
    type: Number,
    min: 0,
    max: 10,
    required: true
  },
  totalTimeSec: {
    type: Number,
    required: true
  }
}, { timestamps: true });

ChallengeAttemptSchema.index({ userId: 1, dateKey: 1, type: 1 }, { unique: true });

const ChallengeAttempt = mongoose.model('ChallengeAttempt', ChallengeAttemptSchema);

export default ChallengeAttempt;