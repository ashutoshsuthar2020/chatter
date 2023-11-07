const mongoose = require('mongoose');
require('dotenv').config();
console.log(process.env.MONGODB);
const url = process.env.MONGODB;

mongoose.connect(url);
