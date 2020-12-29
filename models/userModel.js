const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Please enter your username.'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please enter your email.'],
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Please enter your password.'],
    },
    role: {
      type: Number,
      default: 0, // 0 = user, 1 = admin
    },
    avatar: {
      type: String,
      default: 'user.svg',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Users', userSchema);
