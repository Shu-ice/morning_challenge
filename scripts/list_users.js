const mongoose = require('mongoose');

const uri = 'mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng';

const userSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
const User = mongoose.model('TempUser', userSchema);

(async () => {
  try {
    await mongoose.connect(uri);
    const users = await User.find({}).lean();
    console.log('Users:', users.map(u => ({email: u.email, username: u.username, _id: u._id})));
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
  }
})(); 