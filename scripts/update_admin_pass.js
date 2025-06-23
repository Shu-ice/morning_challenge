const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const NEW_PASSWORD='admin123'; // changeable

(async () => {
  try {
    await mongoose.connect('mongodb+srv://moutaro:moutaromoutaro@morninng.cq5xzt9.mongodb.net/?retryWrites=true&w=majority&appName=morninng');
    const User = mongoose.model('User', new mongoose.Schema({}, {strict:false, collection:'users'}));
    const user = await User.findOne({ email: 'admin@example.com' });
    if (!user) throw new Error('admin not found');
    user.password = await bcrypt.hash(NEW_PASSWORD, 10);
    await user.save();
    console.log('password updated');
  }catch(e){console.error(e);}finally{await mongoose.disconnect();}
})(); 