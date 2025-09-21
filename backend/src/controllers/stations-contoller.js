const stationService = require('../services/station-service');

class SationController {
  async getStations(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const plant = req.user.plant;
      const stations = await stationService.getStations({
        costCenter,
        shift,
        plant,
      });
      res.json(stations);
    } catch (error) {
      next(error);
    }
  }

  async addStation(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const plant = req.user.plant;

      const { name, priority, group } = req.body;
      if (typeof name === 'string' && /[.$]/.test(name)) {
        return res.status(400).json({
          error:
            'Der Name darf keinen Punkt („.“) oder Dollar („$“) enthalten.',
        });
      }
      const response = await stationService.addStation(
        name,
        priority,
        group,
        costCenter,
        shift,
        plant
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
      const plant = req.user.plant;

      const { name } = req.body;
      const response = await stationService.deleteStation(
        name,
        costCenter,
        shift,
        plant
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
      const plant = req.user.plant;

      const { name, newStatus } = req.body;
      const updatedStation = await stationService.stationChangeStatus(
        name,
        newStatus,
        costCenter,
        shift,
        plant
      );
      return res.json(updatedStation);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SationController();
