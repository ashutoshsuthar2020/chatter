const mongoose = require('mongoose');
require('dotenv').config();

const url = process.env.MONGODB;

mongoose.connect(url);
