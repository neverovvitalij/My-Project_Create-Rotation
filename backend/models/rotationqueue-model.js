const { Schema, model, default: mongoose } = require('mongoose');

const RotationQueueSchema = new Schema(
  {
    station: { type: String, required: true },
    costCenter: { type: String, required: true },
    shift: { type: String, required: true },
    queue: [
      {
        workerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkerModel',
          required: true,
        },
        name: { type: String, required: true },
        group: { type: Number, required: true },
        role: { type: String, required: true },
        costCenter: { type: String, required: true },
        shift: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

RotationQueueSchema.index(
  { station: 1, costCenter: 1, shift: 1 },
  { unique: true }
);

module.exports = model('RotationQueueModel', RotationQueueSchema);
