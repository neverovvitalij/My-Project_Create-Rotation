const mongoose = require('mongoose');

const ConfirmedRotationSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now, unique: true },
  rotation: {
    specialRotation: { type: Map, of: String, required: false },
    highPriorityRotation: { type: Map, of: String, required: true },
    dailyRotation: {
      type: [{ type: Map, of: String }],
      required: true,
    },
  },
});

module.exports = mongoose.model('ConfirmedRotation', ConfirmedRotationSchema);
