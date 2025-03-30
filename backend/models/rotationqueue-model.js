const { Schema, model, default: mongoose } = require('mongoose');

const RotationQueueSchema = new Schema({
  station: { type: String, unique: true, required: true },
  queue: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Worker',
    required: true,
  },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = model('RotationQueueModel', RotationQueueSchema);
