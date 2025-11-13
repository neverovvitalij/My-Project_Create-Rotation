const aoService = require('../services/ao-service');

class AoControler {
  async getAo(req, res, next) {
    try {
      const { costCenter, shift, plant } = req.user;

      const aoListe = await aoService.getAo({ costCenter, shift, plant });
      return res.json(aoListe);
    } catch (error) {
      next(error);
    }
  }

  async addAo(req, res, next) {
    try {
      const { costCenter, shift, plant } = req.user;
      const { name, group } = req.body;

      const ao = await aoService.addAo(name, costCenter, group, shift, plant);
      return res.json(ao);
    } catch (error) {
      next(error);
    }
  }

  async deleteAo(req, res, next) {
    try {
      const { costCenter, shift, plant } = req.user;
      const { name, group } = req.body;

      const ao = await aoService.deleteAo(
        name,
        costCenter,
        group,
        shift,
        plant
      );
      return res.json(ao);
    } catch (error) {
      next(error);
    }
  }

  async changeAostatus(req, res, next) {
    try {
      const { costCenter, shift, plant } = req.user;
      const { name, newStatus, group } = req.body;

      const updatedAo = await aoService.changeAostatus(
        name,
        newStatus,
        costCenter,
        group,
        shift,
        plant
      );

      return res.json(updatedAo);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AoControler();
