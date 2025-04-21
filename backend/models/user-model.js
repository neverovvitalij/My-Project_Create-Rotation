const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['GV', 'ADMIN', 'MASTER'],
    required: true,
  },
  costCenter: { type: String, required: true },
  isActivated: { type: Boolean, default: false },
  userActivationStatus: { type: Boolean, default: false },
  adminActivationStatus: { type: Boolean, default: false },
  activationLink: { type: String },
  adminActivationLink: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
});

module.exports = model('UserModel', UserSchema);
