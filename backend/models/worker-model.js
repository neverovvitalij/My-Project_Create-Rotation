const { Schema, model } = require('mongoose');

const WorkerSchema = new Schema({
  name: { type: String, unique: true, required: true },
  stations: [
    {
      name: { type: String, required: true },
      isActive: { type: Boolean, required: true, default: true },
    },
  ],
  group: { type: Number, required: true },
  status: { type: Boolean, required: true, default: true },
});

module.exports = model('Worker', WorkerSchema);
