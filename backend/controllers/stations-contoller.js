const stationService = require('../services/station-service');

class SationController {
  async getStations(req, res, next) {
    try {
      const stations = await stationService.getStations();
      res.json(stations);
    } catch (error) {
      next(error);
    }
  }

  async addStation(req, res, next) {
    try {
      const { name, priority, group } = req.body;
      const response = await stationService.addStation(name, priority, group);
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteStation(req, res, next) {
    try {
      const { name } = req.body;
      const response = await stationService.deleteStation(name);
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async stationChangeStatus(req, res, next) {
    try {
      const { name, newStatus } = req.body;
      const updatedStation = await stationService.stationChangeStatus(
        name,
        newStatus
      );
      return res.json(updatedStation);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SationController();
