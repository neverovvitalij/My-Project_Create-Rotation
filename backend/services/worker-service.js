const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ApiError = require('../exceptions/api-error');

class WorkerService {
  async getAllWorkers(costCenter, shift, plant) {
    try {
      const workers = await WorkerModel.find(costCenter, shift, plant).lean();
      if (!workers || workers.length === 0) {
        console.log('Add worker to the dataBase');
      }
      return workers;
    } catch (error) {
      console.error(error.message);
    }
  }

  async addWorker(
    name,
    costCenter,
    shift,
    plant,
    stations = [],
    group,
    status = true
  ) {
    try {
      const exists = await WorkerModel.exists({
        name: name.trim(),
        costCenter,
        shift,
        plant,
      });
      if (exists) {
        throw ApiError.BadRequest(`Worker "${name.trim()}" already exists`);
      }

      const worker = await WorkerModel.create({
        name: name.trim(),
        costCenter,
        shift,
        plant,
        stations,
        group,
        status,
      });

      console.log('Created worker:', worker.name);
      // 2) For each active station, insert into its queue in alphabetical order
      for (const { name: stationName, isActive } of stations) {
        if (!isActive) continue;

        let rq = await RotationQueueModel.findOne({
          station: stationName,
          costCenter,
          shift,
          plant,
        });
        const entry = {
          workerId: worker._id,
          name: worker.name.trim(),
          group: worker.group,
          costCenter: worker.costCenter,
          shift: worker.shift,
          plant: worker.plant,
        };

        if (rq) {
          // find insertion index
          let idx = rq.queue.findIndex(
            (item) => entry.name.localeCompare(item.name) < 0
          );
          if (idx === -1) {
            // name is greater than all existing → append at end
            rq.queue.push(entry);
          } else {
            // insert before first item that is alphabetically greater
            rq.queue.splice(idx, 0, entry);
          }
        } else {
          // no queue yet → create new one
          rq = new RotationQueueModel({
            station: stationName,
            queue: [entry],
            costCenter,
            shift,
            plant,
          });
        }

        await rq.save();
        console.log(
          `RotationQueue for station "${stationName}" updated with worker "${worker.name}".`
        );
      }
      return worker;
    } catch (error) {
      console.error('Error creating worker:', error.message);
      throw error;
    }
  }

  async deleteWorker(name, costCenter, shift, plant) {
    try {
      const candidate = await WorkerModel.findOneAndDelete({
        name,
        costCenter,
        shift,
        plant,
      });

      if (!candidate) {
        throw ApiError.BadRequest(`Worker ${name} was not found for deletion`);
      }

      const pullResult = await RotationQueueModel.updateMany(
        { costCenter, shift, plant },
        { $pull: { queue: { workerId: candidate._id } } }
      );

      console.log(
        `Removed worker "${name}" from ${pullResult.modifiedCount} rotation queues`
      );

      console.log('Deleted worker:', candidate.name);
      return candidate;
    } catch (error) {
      console.error('Error deleting worker', error.message);
      throw error;
    }
  }

  async workerChangeStatus(name, newStatus, costCenter, shift, plant) {
    try {
      const worker = await WorkerModel.findOneAndUpdate(
        { name, costCenter, shift, plant },
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

  async removeStationFromWorker(
    name,
    stationToRemove,
    costCenter,
    shift,
    plant
  ) {
    try {
      const updatedWorker = await WorkerModel.findOneAndUpdate(
        { name, costCenter, shift, plant },
        { $pull: { stations: { name: stationToRemove } } },
        { new: true }
      );
      if (!updatedWorker) {
        console.log('Worker not found');
        return;
      }

      const rotationQueue = await RotationQueueModel.findOne({
        station: stationToRemove,
        costCenter: updatedWorker.costCenter,
        shift: updatedWorker.shift,
        plant: updatedWorker.plant,
      });
      if (!rotationQueue) {
        console.log(
          `RotationQueue for station "${stationToRemove}" not found.`
        );
        return;
      }

      const beforeCount = rotationQueue.queue.length;
      rotationQueue.queue = rotationQueue.queue.filter(
        (item) => item.workerId.toString() !== updatedWorker._id.toString()
      );
      const afterCount = rotationQueue.queue.length;

      if (beforeCount === afterCount) {
        console.log(
          `Worker "${name}" was not present in the queue for "${stationToRemove}".`
        );
      } else {
        // 4) Обновляем timestamp и сохраняем
        rotationQueue.updatedAt = Date.now();
        await rotationQueue.save();
        console.log(
          `Worker "${name}" removed from rotationQueue for station "${stationToRemove}".`
        );
      }
    } catch (error) {
      console.error(
        'Error while removing station from worker or rotationQueue:',
        error
      );
      throw ApiError.BadRequest(
        'Error removing station from worker',
        error.message
      );
    }
  }

  async addStationToWorker(name, stationToAdd, costCenter, shift, plant) {
    try {
      const updatedWorker = await WorkerModel.findOneAndUpdate(
        { name, costCenter, shift, plant },
        { $addToSet: { stations: { name: stationToAdd, isActive: true } } },
        { new: true }
      );
      if (!updatedWorker) {
        console.log('Worker not found');
        return;
      }

      // 2) Находим или создаём очередь для этой станции
      let rotationQueue = await RotationQueueModel.findOne({
        station: stationToAdd,
        costCenter: updatedWorker.costCenter,
        shift: updatedWorker.shift,
        plant: updatedWorker.plant,
      });
      if (!rotationQueue) {
        rotationQueue = new RotationQueueModel({
          station: stationToAdd,
          costCenter: updatedWorker.costCenter,
          shift: updatedWorker.shift,
          plant: updatedWorker.plant,
          queue: [],
        });
      }

      const exists = rotationQueue.queue.some(
        (item) => item.workerId.toString() === updatedWorker._id.toString()
      );
      if (!exists) {
        const idx = rotationQueue.queue.findIndex(
          (item) => updatedWorker.name.localeCompare(item.name) < 0
        );
        const insertIndex = idx === -1 ? rotationQueue.queue.length : idx;

        const queueItem = {
          workerId: updatedWorker._id,
          name: updatedWorker.name,
          group: updatedWorker.group,
          role: updatedWorker.role,
          costCenter: updatedWorker.costCenter,
          shift: updatedWorker.shift,
          plant: updatedWorker.plant,
        };

        rotationQueue.queue.splice(insertIndex, 0, queueItem);
      }

      rotationQueue.updatedAt = Date.now();
      await rotationQueue.save();

      console.log(
        `RotationQueue for station "${stationToAdd}" updated with worker "${name}".`
      );
    } catch (error) {
      console.error('Error while updating rotation queue:', error);
      throw ApiError.BadRequest(
        'Error adding station to worker',
        error.message
      );
    }
  }
}

module.exports = new WorkerService();
