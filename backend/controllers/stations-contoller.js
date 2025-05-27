const stationService = require('../services/station-service');

class SationController {
  async getStations(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const stations = await stationService.getStations({ costCenter, shift });
      res.json(stations);
    } catch (error) {
      next(error);
    }
  }

  async addStation(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;

      const { name, priority, group } = req.body;
      const response = await stationService.addStation(
        name,
        priority,
        group,
        costCenter,
        shift
      );
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async deleteStation(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;

      const { name } = req.body;
      const response = await stationService.deleteStation(
        name,
        costCenter,
        shift
      );
      return res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async stationChangeStatus(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;

      const { name, newStatus } = req.body;
      const updatedStation = await stationService.stationChangeStatus(
        name,
        newStatus,
        costCenter,
        shift
      );
      return res.json(updatedStation);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SationController();
