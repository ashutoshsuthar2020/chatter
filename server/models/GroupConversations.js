const mongoose = require('mongoose');

const groupConversationSchema = mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        unique: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: {
        message: String,
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});

const GroupConversation = mongoose.model('GroupConversation', groupConversationSchema);

module.exports = GroupConversation;
