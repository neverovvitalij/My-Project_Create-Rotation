const StationModel = require('../models/station-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const WorkerModel = require('../models/worker-model');
const ApiError = require('../exceptions/api-error');

class StationService {
  async getStations(costCenter, shift, plant) {
    try {
      const stations = await StationModel.find(costCenter, shift, plant).lean();
      return stations;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching stations:', msg);
      throw ApiError.BadRequest('Error fetching stations:', msg);
    }
  }

  async addStation(name, priority, group, costCenter, shift, plant) {
    try {
      // Check if a station with this name already exists
      const existingStation = await StationModel.exists({
        name,
        costCenter,
        shift,
        plant,
      });
      if (existingStation) {
        throw ApiError.BadRequest('Station already exists');
      }

      // Create a new station
      const station = new StationModel({
        name: name.trim(),
        priority,
        group,
        costCenter,
        shift,
        plant,
      });
      await station.save();

      // Initialize queue for the new station
      let rotationQueue = await RotationQueueModel.findOne({
        station: name,
        costCenter,
        shift,
        plant,
      });
      if (!rotationQueue) {
        const workers = await WorkerModel.find({
          costCenter,
          shift,
          plant,
          stations: { $elemMatch: { name, isActive: true } },
        }).sort({ name: 1 }); //Sort workers by name

        const queueItems = workers.map((w) => ({
          workerId: w._id,
          name: w.name,
          group: w.group,
          role: w.role,
          costCenter: w.costCenter,
          shift: w.shift,
          plant: w.plant,
        }));

        rotationQueue = new RotationQueueModel({
          station: name,
          costCenter,
          shift,
          plant,
          queue: queueItems,
        });
        await rotationQueue.save();
        console.log(
          `Queue initialized for station "${name}" with ${workers.length} workers.`
        );
      }
      return station;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error while adding station:', msg);
      throw ApiError.BadRequest(`Error adding station: ${msg}`);
    }
  }

  async deleteStation(name, costCenter, shift, plant) {
    try {
      // Remove station from the database
      const station = await StationModel.findOneAndDelete({
        name,
        costCenter,
        shift,
        plant,
      });
      if (!station) {
        throw ApiError.BadRequest('Station not found');
      }

      // Remove the queue associated with this station
      const rotationQueue = await RotationQueueModel.findOneAndDelete({
        station: name,
        costCenter,
        shift,
        plant,
      });
      if (rotationQueue) {
        console.log(`Queue for station "${name}" has been deleted.`);
      } else {
        console.warn(`No queue found for station "${name}".`);
      }

      // Remove this station from all workers station lists
      const result = await WorkerModel.updateMany(
        { 'stations.name': name },
        { $pull: { stations: { name, costCenter, shift, plant } } }
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
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error while deleting station:', msg);
      throw ApiError.BadRequest('Error modifying station:', msg);
    }
  }

  async stationChangeStatus(name, newStatus, costCenter, shift, plant) {
    try {
      const station = await StationModel.findOneAndUpdate(
        { name, costCenter, shift, plant },
        { $set: { status: newStatus } },
        { new: true }
      );

      if (!station) {
        throw new Error('Station not found');
      }
      return station;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error updating status:', msg);
      throw ApiError.Internal('Failed to update station status');
    }
  }
}

module.exports = new StationService();
