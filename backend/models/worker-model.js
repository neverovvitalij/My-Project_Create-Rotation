const { Schema, model } = require('mongoose');

const WorkerSchema = new Schema({
  name: { type: String, required: true },
  role: {
    type: String,
    enum: ['WORKER', 'GV'],
    required: true,
  },
  costCenter: { type: String, required: true },
  shift: { type: String, required: true },
  plant: { type: String, required: true },
  stations: [
    {
      name: { type: String, required: true },
      isActive: { type: Boolean, required: true, default: true },
    },
  ],
  group: { type: Number, required: true },
  status: { type: Boolean, required: true, default: true },
});

WorkerSchema.index(
  { name: 1, costCenter: 1, shift: 1, plant: 1 },
  { unique: true }
);

module.exports = model('WorkerModel', WorkerSchema);
