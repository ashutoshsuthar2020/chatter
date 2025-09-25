// Simple logger for client-side (browser)
// Usage: import logger from './logger'; logger.info('message')
const logger = {
    info: (...args) => {
        if (process.env.NODE_ENV !== 'production') {
            console.info('[INFO]', ...args);
        }
    },
    warn: (...args) => {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[WARN]', ...args);
        }
    },
    error: (...args) => {
        // Always log errors
        console.error('[ERROR]', ...args);
    },
    debug: (...args) => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug('[DEBUG]', ...args);
        }
    }
};

export default logger;
