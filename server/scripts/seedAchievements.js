import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Achievement from '../models/Achievement.js';
import environmentConfig from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seed = [
  { 
    code: 'EARLY_BIRD', 
    name: 'アーリーバード', 
    description: '7:00までに朝チャレンジ完了', 
    icon: 'early_bird.png' 
  },
  { 
    code: 'PERFECT_10', 
    name: 'パーフェクト10', 
    description: '10問全問正解', 
    icon: 'perfect10.png' 
  },
  { 
    code: 'STREAK_7', 
    name: 'ストリーク7', 
    description: '7日連続達成', 
    icon: 'streak7.png' 
  },
  { 
    code: 'STREAK_30', 
    name: 'ストリーク30', 
    description: '30日連続達成', 
    icon: 'streak30.png' 
  },
  { 
    code: 'SOLVED_100', 
    name: '100問達成', 
    description: '通算100問を解いた', 
    icon: 'solved100.png' 
  }
];

async function seedAchievements() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/morning-math-challenge';
    console.log('Connecting to MongoDB:', mongoUri);
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    for (const achievement of seed) {
      await Achievement.updateOne(
        { code: achievement.code }, 
        { $set: achievement }, 
        { upsert: true }
      );
      console.log(`Seeded achievement: ${achievement.code}`);
    }
    
    console.log('All achievements seeded successfully');
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error seeding achievements:', error);
    process.exit(1);
  }
}

seedAchievements();