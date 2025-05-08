import mongoose from 'mongoose';

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
    enum: [
      'integer_addition', 
      'integer_subtraction', 
      'integer_multiplication', 
      'simple_division', 
      'decimal_addition_subtraction',
      'integer_multiplication_division', 
      'fraction_addition_subtraction_same_denominator', 
      'decimal_multiplication_division', 
      'multi_step_integer_arithmetic',  
      'fraction_addition_subtraction_different_denominators', 
      'mixed' 
    ],
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

export default mongoose.model('Problem', problemSchema);