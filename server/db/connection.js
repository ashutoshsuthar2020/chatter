const mongoose = require('mongoose');
require('dotenv').config();
const logger = require('../logger');
logger.info('MongoDB URI: %s', process.env.MONGODB_URI);
const url = process.env.MONGODB_URI;

mongoose.connect(url);

const db = mongoose.connection;

db.on('error', (err) => logger.error('connection error with mongodb: %s', err));
db.once('open', function () {
  logger.info('Connected successfully with mongoose');
  logger.info('Connection state with mongoose: %s', mongoose.connection.readyState);
});
