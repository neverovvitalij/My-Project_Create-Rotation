// const mongoose = require('mongoose');

// const ConfirmedRotationSchema = new mongoose.Schema({
//   date: { type: Date, default: Date.now, unique: true },
//   rotation: {
//     specialRotation: { type: Map, of: String, required: false },
//     highPriorityRotation: { type: Map, of: String, required: true },
//     cycleRotations: {
//       type: [{ type: Map, of: String }],
//       required: true,
//     },
//   },
// });

// module.exports = mongoose.model('ConfirmedRotation', ConfirmedRotationSchema);
const mongoose = require('mongoose');

const WorkerInfoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    group: { type: Number, required: true },
    status: { type: Boolean, required: true },
    costCenter: { type: String, required: true },
    role: { type: String, required: true },
  },
  { _id: false }
);

const ConfirmedRotationSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now, unique: true },
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

module.exports = mongoose.model('ConfirmedRotation', ConfirmedRotationSchema);
