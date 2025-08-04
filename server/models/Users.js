const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: function () {
            // Password is required only if not a Google user
            return !this.isGoogleUser;
        }
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // This allows multiple documents without googleId
    },
    firstName: {
        type: String
    },
    lastName: {
        type: String
    },
    picture: {
        type: String
    },
    isGoogleUser: {
        type: Boolean,
        default: false
    },
    token: {
        type: String
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