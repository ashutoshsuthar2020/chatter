const jwt = require('jsonwebtoken');
const Users = require('../models/Users');

// JWT Authentication Middleware
const authenticateJWT = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]; // Bearer token

        if (!token) {
            return res.status(401).json({ message: 'Access token required' });
        }

        const JWT_SECRET_KEY = process.env.JWT_SECRET || 'THIS_IS_A_JWT_SECRET_KEY';
        const decoded = jwt.verify(token, JWT_SECRET_KEY);

        const user = await Users.findById(decoded.userId).select('-token -password');
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        const logger = require('../logger');
        logger.error('JWT Authentication error: %s', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = {
    authenticateJWT
};
