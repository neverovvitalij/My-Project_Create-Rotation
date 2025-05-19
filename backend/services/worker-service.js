const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ApiError = require('../exceptions/api-error');

class WorkerService {
  async getAllWorkers(costCenter) {
    try {
      const workers = await WorkerModel.find(costCenter).lean();
      if (!workers || workers.length === 0) {
        console.log('Add worker to the dataBase');
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
        name: name.trim(),
        role,
        costCenter,
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
        });
        const entry = {
          workerId: worker._id,
          name: worker.name.trim(),
          group: worker.group,
          role: worker.role,
          costCenter: worker.costCenter,
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

  async deleteWorker(name) {
    try {
      const candidate = await WorkerModel.findOneAndDelete({ name });
      if (!candidate) {
        throw ApiError.BadRequest(`Worker ${name} was not found`);
      }

      console.log('Deleted worker:', candidate.name);
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
      // 1) Убираем станцию у самого воркера
      const updatedWorker = await WorkerModel.findOneAndUpdate(
        { name },
        { $pull: { stations: { name: stationToRemove } } },
        { new: true }
      );
      if (!updatedWorker) {
        console.log('Worker not found');
        return;
      }

      // 2) Находим очередь для данной станции (и учитываем costCenter)
      const rotationQueue = await RotationQueueModel.findOne({
        station: stationToRemove,
        costCenter: updatedWorker.costCenter,
      });
      if (!rotationQueue) {
        console.log(
          `RotationQueue for station "${stationToRemove}" not found.`
        );
        return;
      }

      // 3) Фильтруем массив queue, оставляя только те элементы, у которых
      //    workerId не равен _id удаляемого воркера
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

  async addStationToWorker(name, stationToAdd) {
    try {
      // 1) Обновляем воркера, добавляя станцию в его список
      const updatedWorker = await WorkerModel.findOneAndUpdate(
        { name },
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
      });
      if (!rotationQueue) {
        rotationQueue = new RotationQueueModel({
          station: stationToAdd,
          costCenter: updatedWorker.costCenter,
          queue: [],
        });
      }

      // 3) Проверяем, есть ли уже этот воркер в очереди
      const exists = rotationQueue.queue.some(
        (item) => item.workerId.toString() === updatedWorker._id.toString()
      );
      if (!exists) {
        // 4) Находим позицию по алфавиту
        const idx = rotationQueue.queue.findIndex(
          (item) => updatedWorker.name.localeCompare(item.name) < 0
        );
        const insertIndex = idx === -1 ? rotationQueue.queue.length : idx;

        // 5) Собираем полный объект, как просит схема
        const queueItem = {
          workerId: updatedWorker._id,
          name: updatedWorker.name,
          group: updatedWorker.group,
          role: updatedWorker.role,
          costCenter: updatedWorker.costCenter,
        };

        // 6) Вставляем в нужное место
        rotationQueue.queue.splice(insertIndex, 0, queueItem);
      }

      // 7) Обновляем время изменения и сохраняем
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
