const workerService = require('../services/worker-service');

class WorkerController {
  async getWorkers(req, res, next) {
    try {
      const workers = await workerService.getAllWorkers();
      res.json(workers);
    } catch (error) {
      next(error);
    }
  }

  async addWorker(req, res, next) {
    try {
      const { name, role, costCenter, stations, group } = req.body;
      const personData = await workerService.addWorker(
        name,
        role,
        costCenter,
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
      const { name } = req.body;
      console.log(name);
      const deletedWorker = await workerService.deleteWorker(name);
      return res.json(deletedWorker);
    } catch (error) {
      next(error);
    }
  }

  async workerChangeStatus(req, res, next) {
    try {
      const { name, newStatus } = req.body;
      const updatedWorker = await workerService.workerChangeStatus(
        name,
        newStatus
      );
      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }

  async removeStationFromWorker(req, res, next) {
    try {
      const { name, stationToRemove } = req.body;
      const updatedWorker = await workerService.removeStationFromWorker(
        name,
        stationToRemove
      );
      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }

  async addStationToWorker(req, res, next) {
    try {
      const { name, stationToAdd } = req.body;
      const updatedWorker = workerService.addStationToWorker(
        name,
        stationToAdd
      );
      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WorkerController();
