import mongoose from 'mongoose';

const AchievementSchema = new mongoose.Schema({
  code: {
    type: String,
    unique: true,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    required: true
  }
}, { timestamps: true });

const Achievement = mongoose.model('Achievement', AchievementSchema);

export default Achievement;