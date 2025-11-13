const mongoose = require('mongoose');

const AoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: Number, required: true },
  status: { type: Boolean, required: true, default: true },
  costCenter: { type: String, required: true },
  shift: { type: String, required: true },
  plant: { type: String, required: true },
});

AoSchema.index(
  { name: 1, costCenter: 1, shift: 1, plant: 1 },
  { unique: true }
);

module.exports = mongoose.model('AoModel', AoSchema);
