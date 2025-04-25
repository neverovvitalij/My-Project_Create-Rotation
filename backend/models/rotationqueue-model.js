const { Schema, model, default: mongoose } = require('mongoose');

const RotationQueueSchema = new Schema(
  {
    station: { type: String, unique: true, required: true },
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
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = model('RotationQueueModel', RotationQueueSchema);
