const mongoose = require('mongoose');

const readReceiptSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    conversationId: {
        type: String,
        required: true
    },
    lastSeenMessageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    lastSeenAt: {
        type: Date,
        default: Date.now
    },
    isGroup: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Create compound index for efficient queries
readReceiptSchema.index({ userId: 1, conversationId: 1 }, { unique: true });

const ReadReceipt = mongoose.model('ReadReceipt', readReceiptSchema);

module.exports = ReadReceipt;
