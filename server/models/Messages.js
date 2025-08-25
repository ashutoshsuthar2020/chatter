const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    senderId: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    sequenceNumber: {
        type: Number,
        default: 0,
        index: true
    },
    deletedFor: {
        type: [String],
        default: []
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Compound index for efficient querying and ordering
messageSchema.index({ conversationId: 1, sequenceNumber: 1 });
messageSchema.index({ conversationId: 1, createdAt: 1 });

const Messages = mongoose.model('Message', messageSchema);

module.exports = Messages;