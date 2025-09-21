const mongoose = require('mongoose');

const WorkerInfoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    group: { type: Number, required: true },
    status: { type: Boolean, required: true },
    costCenter: { type: String, required: true },
    shift: { type: String, required: true },
    plant: { type: String, required: true },
  },
  { _id: false }
);

const ConfirmedRotationSchema = new mongoose.Schema(
  {
    costCenter: { type: String, required: true },
    shift: { type: String, required: true },
    plant: { type: String, required: true },
    rotation: {
      specialRotation: { type: Map, of: String, required: false },
      highPriorityRotation: { type: Map, of: String, required: true },
      cycleRotations: { type: [{ type: Map, of: String }], required: true },
      allWorkers: { type: [WorkerInfoSchema], required: true },
    },
  },
  {
    timestamps: true,
  }
);

ConfirmedRotationSchema.index({ costCenter: 1, shift: 1, plant: 1 });

ConfirmedRotationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

module.exports = mongoose.model('ConfirmedRotation', ConfirmedRotationSchema);
