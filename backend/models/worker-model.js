const { Schema, model } = require('mongoose');

const WorkerSchema = new Schema({
  name: { type: String, unique: true, required: true },
  role: {
    type: String,
    enum: ['WORKER', 'UNT', 'GV', 'B&B'],
    required: true,
  },
  costCenter: { type: String, required: true },
  stations: [
    {
      name: { type: String, required: true },
      isActive: { type: Boolean, required: true, default: true },
    },
  ],
  group: { type: Number, required: true },
  status: { type: Boolean, required: true, default: true },
});

module.exports = model('WorkerModel', WorkerSchema);
