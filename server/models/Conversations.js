const mongoose = require('mongoose');

const conversationSchema = mongoose.Schema({
    members: {
        type: Array,
        required: true
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: false
    },
    lastMessage: {
        message: String,
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        sequenceNumber: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

const Conversation = mongoose.model('Conversation', conversationSchema)

module.exports = Conversation;