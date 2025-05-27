const workerService = require('../services/worker-service');

class WorkerController {
  async getWorkers(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const workers = await workerService.getAllWorkers({ costCenter, shift });
      res.json(workers);
    } catch (error) {
      next(error);
    }
  }

  async addWorker(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const { name, role, stations, group } = req.body;
      const personData = await workerService.addWorker(
        name,
        role,
        costCenter,
        shift,
        stations,
        group
      );
      return res.json(personData);
    } catch (error) {
      if (error.message.includes('is already registered')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }

  async deleteWorker(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const { name } = req.body;

      const deletedWorker = await workerService.deleteWorker(
        name,
        costCenter,
        shift
      );
      return res.json(deletedWorker);
    } catch (error) {
      next(error);
    }
  }

  async workerChangeStatus(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const { name, newStatus } = req.body;
      const updatedWorker = await workerService.workerChangeStatus(
        name,
        newStatus,
        costCenter,
        shift
      );
      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }

  async removeStationFromWorker(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const { name, stationToRemove } = req.body;
      const updatedWorker = await workerService.removeStationFromWorker(
        name,
        stationToRemove,
        costCenter,
        shift
      );
      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }

  async addStationToWorker(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const { name, stationToAdd } = req.body;

      const updatedWorker = workerService.addStationToWorker(
        name,
        stationToAdd,
        costCenter,
        shift
      );
      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WorkerController();
