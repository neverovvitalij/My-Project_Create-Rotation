const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  priority: { type: Number, required: true },
  group: { type: Number, required: true },
  status: { type: Boolean, required: true, default: true },
  costCenter: { type: String, required: true },
  shift: { type: String, required: true },
  plant: { type: String, required: true },
});

StationSchema.index(
  { name: 1, costCenter: 1, shift: 1, plant: 1 },
  { unique: true }
);

module.exports = mongoose.model('StationModel', StationSchema);
