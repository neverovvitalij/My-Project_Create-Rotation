const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  priority: { type: Number, required: true },
  group: { type: Number },
  status: { type: Boolean, required: true, default: true },
  costCenter: { type: String, required: true },
});

module.exports = mongoose.model('StationModel', StationSchema);
