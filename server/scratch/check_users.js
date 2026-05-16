const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const count = await User.countDocuments();
        console.log('Total users:', count);
        const latestUsers = await User.find().sort({ createdAt: -1 }).limit(5);
        console.log('Latest users:', latestUsers.map(u => u.email));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
