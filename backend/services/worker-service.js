const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ApiError = require('../exceptions/api-error');

class WorkerService {
  async getAllWorkers() {
    try {
      const workers = await WorkerModel.find();
      if (!workers || workers.length === 0) {
        console.log('Add worker');
      }
      return workers;
    } catch (error) {
      console.error(error.message);
    }
  }

  async addWorker(name, role, costCenter, stations, group, status = true) {
    try {
      const existingWorker = await WorkerModel.findOne({ name });
      if (existingWorker) {
        throw new Error(`Worker ${name} is already registered`);
      }

      const worker = await WorkerModel.create({
        name,
        role,
        costCenter,
        stations,
        group,
        status,
      });

      console.log('Created worker:', worker);
      return worker;
    } catch (error) {
      console.error('Error creating worker:', error.message);
      throw error;
    }
  }

  async deleteWorker(name) {
    try {
      const candidate = await WorkerModel.findOneAndDelete({ name });
      if (!candidate) {
        throw ApiError.BadRequest(`Worker ${name} was not found`);
      }
      return candidate;
    } catch (error) {
      console.error('Error deleting worker', error.message);
      throw error;
    }
  }

  async workerChangeStatus(name, newStatus) {
    try {
      const worker = await WorkerModel.findOneAndUpdate(
        { name },
        { $set: { status: newStatus } },
        { new: true }
      );
      if (worker) {
        return worker;
      } else {
        console.log('Worker not found');
        return null;
      }
    } catch (error) {
      console.log('Error during status update', error.message);
      throw error;
    }
  }

  async removeStationFromWorker(name, stationToRemove) {
    try {
      const updatedWorker = await WorkerModel.findOneAndUpdate(
        { name },
        { $pull: { stations: { name: stationToRemove } } },
        { new: true }
      );

      if (!updatedWorker) {
        console.log('Worker not found');
        return;
      }

      console.log('Updated worker:', updatedWorker);

      // Find the rotation queue for the specified station
      const rotationQueue = await RotationQueueModel.findOne({
        station: stationToRemove,
      });

      if (!rotationQueue) {
        console.log(
          `RotationQueue for station "${stationToRemove}" not found.`
        );
        return;
      }

      // Remove the worker from the queue if present
      const workerIndex = rotationQueue.queue.indexOf(updatedWorker._id);
      if (workerIndex !== -1) {
        rotationQueue.queue.splice(workerIndex, 1);
        rotationQueue.updatedAt = Date.now();
        await rotationQueue.save();
        console.log(
          `Worker "${name}" removed from rotationQueue for station "${stationToRemove}".`
        );
      } else {
        console.log(
          `Worker "${name}" not found in rotationQueue for station "${stationToRemove}".`
        );
      }
    } catch (error) {
      console.error('Error while updating worker or rotationQueue:', error);
    }
  }

  async addStationToWorker(name, stationToAdd) {
    try {
      // Update the worker's info by adding a new station
      const updatedWorker = await WorkerModel.findOneAndUpdate(
        { name },
        { $addToSet: { stations: { name: stationToAdd, isActive: true } } },
        { new: true }
      );

      if (!updatedWorker) {
        console.log('Worker not found');
        return;
      }

      console.log('Updated worker:', updatedWorker);

      // Check if a rotationQueue exists for this station
      let rotationQueue = await RotationQueueModel.findOne({
        station: stationToAdd,
      });

      // Check if the worker is already in the queue
      if (!rotationQueue?.queue?.includes(updatedWorker._id)) {
        const workersForStation = await WorkerModel.find({
          _id: { $in: rotationQueue.queue },
        }).sort({ name: 1 });

        let insertIndex = 0;
        for (; insertIndex < workersForStation.length; insertIndex++) {
          if (
            updatedWorker.name.localeCompare(
              workersForStation[insertIndex].name
            ) < 0
          ) {
            break;
          }
        }

        // Insert the worker at the proper position
        rotationQueue.queue.splice(insertIndex, 0, updatedWorker._id);
      }

      rotationQueue.updatedAt = Date.now();

      // Save the updated queue
      await rotationQueue.save();

      console.log(
        `RotationQueue for station "${stationToAdd}" updated with worker "${name}" inserted in alphabetical order.`
      );
    } catch (error) {
      console.error('Error while updating person or rotation queue:', error);
    }
  }
}

module.exports = new WorkerService();
