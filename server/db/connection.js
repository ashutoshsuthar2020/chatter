const mongoose = require('mongoose');
require('dotenv').config();
console.log(process.env.MONGODB);
const url = process.env.MONGODB;

mongoose.connect(url);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error with mongodb:'));
db.once('open', function() {
  console.log("Connected successfully");
  console.log("Connection state:", mongoose.connection.readyState);
});
