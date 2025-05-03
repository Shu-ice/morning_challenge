const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: '🎁' // デフォルトの絵文字
  },
  pointCost: {
    type: Number,
    required: true,
    min: 10
  },
  // アイテムのタイプ: アバター、背景、特別機能など
  type: {
    type: String,
    enum: ['avatar', 'background', 'feature', 'theme', 'other'],
    default: 'other'
  },
  // 特定の機能や値を持つアイテム用
  properties: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  // 学年制限（nullの場合は全学年対象）
  gradeRestriction: {
    type: Number,
    min: 1,
    max: 6,
    default: null
  },
  // アイテムの希少度（1〜5、高いほど希少）
  rarity: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Item', ItemSchema);
