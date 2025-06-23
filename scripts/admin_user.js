const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect('mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng');
    const User = mongoose.model('User', new mongoose.Schema({}, {strict:false, collection:'users'}));
    const user = await User.findOne({ email: 'admin@example.com' }).lean();
    console.log(user);
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})(); 