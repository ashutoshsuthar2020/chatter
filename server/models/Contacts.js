const mongoose = require('mongoose');

const contactSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contactUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contactPhoneNumber: {
        type: String,
        required: true
    },
    contactName: {
        type: String,
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    isBlocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Ensure a user can't add the same contact twice
contactSchema.index({ userId: 1, contactUserId: 1 }, { unique: true });

const Contacts = mongoose.model('Contact', contactSchema);

module.exports = Contacts;
