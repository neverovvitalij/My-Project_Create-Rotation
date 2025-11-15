const { Schema, model, default: mongoose } = require('mongoose');

const RotationQueueForAOSchema = new Schema(
  {
    station: { type: String, required: true },
    costCenter: { type: String, required: true },
    shift: { type: String, required: true },
    plant: { type: String, required: true },
    queue: [
      {
        workerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'WorkerModel',
          required: true,
        },
        name: { type: String, required: true },
        group: { type: Number, required: true },
        costCenter: { type: String, required: true },
        shift: { type: String, required: true },
        plant: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

RotationQueueForAOSchema.index(
  { costCenter: 1, shift: 1, plant: 1 },
  { unique: true }
);

module.exports = model('RotationQueueForAOSchema', RotationQueueForAOSchema);
