import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    console.log(`[DB] Attempting to connect with MONGO_URI: ${process.env.MONGO_URI}`);

    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB接続成功: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB接続エラー: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;