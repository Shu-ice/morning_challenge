import mongoose from 'mongoose';

const CounselingSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true
  },
  startsAt: {
    type: Date,
    required: true
  },
  endsAt: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['REQUESTED','CONFIRMED','DONE','CANCELLED'],
    default: 'REQUESTED'
  },
  notesForParent: {
    type: String,
    default: ''
  }
}, { timestamps: true });

const CounselingSession = mongoose.model('CounselingSession', CounselingSessionSchema);

export default CounselingSession;