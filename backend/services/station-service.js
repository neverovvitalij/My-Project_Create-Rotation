const StationModel = require('../models/station-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const WorkerModel = require('../models/worker-model');
const ApiError = require('../exceptions/api-error');

class StationService {
  async getStations() {
    try {
      const stations = await StationModel.find();
      return stations;
    } catch (error) {
      throw ApiError.BadRequest('Error fetching stations', error.message);
    }
  }

  async addStation(name, priority, group) {
    try {
      // Check if a station with this name already exists
      const existingStation = await StationModel.findOne({ name });
      if (existingStation) {
        throw ApiError.BadRequest('Station already exists');
      }

      // Create a new station
      const station = new StationModel({ name, priority, group });
      await station.save();

      // Initialize queue for the new station
      let rotationQueue = await RotationQueueModel.findOne({ station: name });
      if (!rotationQueue) {
        const workers = await WorkerModel.find({
          stations: { $elemMatch: { name, isActive: true } },
        }).sort({ name: 1 }); //Sort workers by name

        rotationQueue = new RotationQueueModel({
          station: name,
          queue: workers.map((worker) => worker._id) || [],
        });
        await rotationQueue.save();
        console.log(
          `Queue initialized for station "${name}" with ${workers.length} workers.`
        );
      }
      return station;
    } catch (error) {
      console.error('Error while adding station:', error.message);
      throw ApiError.BadRequest('Error adding station', error.message);
    }
  }

  async deleteStation(name) {
    try {
      // Remove station from the database
      const station = await StationModel.findOneAndDelete({ name });
      if (!station) {
        throw ApiError.BadRequest('Station not found');
      }

      // Remove the queue associated with this station
      const rotationQueue = await RotationQueueModel.findOneAndDelete({
        station: name,
      });
      if (rotationQueue) {
        console.log(`Queue for station "${name}" has been deleted.`);
      } else {
        console.warn(`No queue found for station "${name}".`);
      }

      // Remove this station from all workers station lists
      const result = await WorkerModel.updateMany(
        { 'stations.name': name },
        { $pull: { stations: { name } } }
      );

      if (result.modifiedCount > 0) {
        console.log(
          `Station "${name}" has been removed from ${result.modifiedCount} workers.`
        );
      } else {
        console.warn(`No workers had the station "${name}" assigned.`);
      }

      return station;
    } catch (error) {
      console.error('Error while deleting station:', error.message);
      throw ApiError.BadRequest('Error modifying station', error.message);
    }
  }

  async stationChangeStatus(name, newStatus) {
    try {
      const station = await StationModel.findOneAndUpdate(
        { name },
        { $set: { status: newStatus } },
        { new: true }
      );

      if (station) {
        return station;
      } else {
        console.error('Station not found');
        return null;
      }
    } catch (error) {
      console.log('Error updating status', error.message);
      throw error;
    }
  }
}

module.exports = new StationService();
