const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true
    },
    picture: {
        type: String,
        default: ''
    },
    bio: {
        type: String,
        default: '',
        maxlength: 150
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    },
    friend: {
        type: Array,
        default: []
    },
}, {
    timestamps: true
});

const Users = mongoose.model('User', userSchema)

module.exports = Users;