const workerService = require('../services/worker-service');

class WorkerController {
  async getWorkers(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const plant = req.user.plant;
      const workers = await workerService.getAllWorkers({
        costCenter,
        shift,
        plant,
      });
      res.json(workers);
    } catch (error) {
      next(error);
    }
  }

  async addWorker(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const plant = req.user.plant;
      const { name, stations, group } = req.body;
      const employee = await workerService.addWorker(
        name,
        costCenter,
        shift,
        plant,
        stations,
        group
      );
      return res.json(employee);
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
      const plant = req.user.plant;
      const { name } = req.body;

      const deletedWorker = await workerService.deleteWorker(
        name,
        costCenter,
        shift,
        plant
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
      const plant = req.user.plant;
      const { name, newStatus } = req.body;
      const updatedWorker = await workerService.workerChangeStatus(
        name,
        newStatus,
        costCenter,
        shift,
        plant
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
      const plant = req.user.plant;
      const { name, stationToRemove } = req.body;
      const updatedWorker = await workerService.removeStationFromWorker(
        name,
        stationToRemove,
        costCenter,
        shift,
        plant
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
      const plant = req.user.plant;
      const { name, stationToAdd } = req.body;

      const updatedWorker = await workerService.addStationToWorker(
        name,
        stationToAdd,
        costCenter,
        shift,
        plant
      );

      return res.json(updatedWorker);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new WorkerController();
