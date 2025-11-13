const ApiError = require('../exceptions/api-error');
const AoModel = require('../models/ao-model');

class AoService {
  async getAo(costCenter, shift, plant) {
    try {
      const ao = await AoModel.find(costCenter, shift, plant).lean();
      return ao;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error fetching AoTask:', msg);
      throw ApiError.BadRequest('Error fetching AoTask:', msg);
    }
  }

  async addAo(name, costCenter, group, shift, plant) {
    try {
      // Check if a AO with this name already exists
      const existingAo = await AoModel.exists({
        name,
        costCenter,
        group,
        shift,
        plant,
      });

      if (existingAo) {
        throw ApiError.BadRequest('Ao already exists');
      }

      // Create a new AO

      const Ao = new AoModel({
        name: name.trim(),
        costCenter,
        group,
        shift,
        plant,
      });

      await Ao.save();

      return Ao;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error while adding AO:', msg);
      throw ApiError.BadRequest(`Error adding AO: ${msg}`);
    }
  }

  async deleteAo(name, costCenter, group, shift, plant) {
    try {
      // Remove station from the database
      const Ao = await AoModel.findOneAndDelete({
        name,
        costCenter,
        group,
        shift,
        plant,
      });
      if (!Ao) {
        throw ApiError.BadRequest('AO not found');
      }

      return Ao;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error while deleting AO:', msg);
      throw ApiError.BadRequest(`Error deleting AO: ${msg}`);
    }
  }

  async changeAostatus(name, newStatus, costCenter, group, shift, plant) {
    try {
      const ao = await AoModel.findOneAndUpdate(
        { name, costCenter, group, shift, plant },
        { $set: { status: newStatus } },
        { new: true }
      );

      if (!ao) {
        throw ApiError.BadRequest('AO not found');
      }

      return ao;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error while updating AO:', msg);
      throw ApiError.BadRequest(`Error updating AO: ${msg}`);
    }
  }
}

module.exports = new AoService();
