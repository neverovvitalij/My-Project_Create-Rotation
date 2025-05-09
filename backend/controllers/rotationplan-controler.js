const ApiError = require('../exceptions/api-error');
const ConfirmedRotation = require('../models/confirmedrotation-model');
const RotationPlanServise = require('../services/rotationplan-service');

class RotationPlanController {
  constructor() {
    this.getDailyRotation = this.getDailyRotation.bind(this);
    this.confirmRotation = this.confirmRotation.bind(this);
    this.downloadConfirmedRotation = this.downloadConfirmedRotation.bind(this);
  }

  // Generate a rotation plan
  async getDailyRotation(req, res, next) {
    const costCenter = req.user.costCenter;
    try {
      const rotationService = new RotationPlanServise();
      const cycles = parseInt(req.query.cycles, 10) || 5;

      // Destructure both preassigned and sonderAssignments here
      const { specialAssignments, preassigned } = req.body;

      if (isNaN(cycles) || cycles <= 0) {
        return next(ApiError.BadRequest('Invalid cycles parameter.'));
      }

      // Validate preassigned
      if (preassigned && !Array.isArray(preassigned)) {
        return next(
          ApiError.BadRequest(
            'Preassigned must be an array of { station, person } objects'
          )
        );
      }

      // Pass cycles, preassigned, and sonderAssignments
      const result = await rotationService.generateDailyRotation(
        specialAssignments || [],
        preassigned || [],
        cycles,
        costCenter
      );
      if (!result || typeof result !== 'object') {
        return next(ApiError.BadRequest('Invalid rotation data format.'));
      }
      return res.json(result);
    } catch (error) {
      console.error('Error generating daily rotation:', error.message),
        next(ApiError.BadRequest('Error creating plan', error.message));
    }
  }

  // Confirm the rotation plan
  async confirmRotation(req, res, next) {
    const costCenter = req.user.costCenter;

    try {
      const rotationService = new RotationPlanServise();
      const {
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers,
      } = req.body;

      if (
        !highPriorityRotation ||
        typeof highPriorityRotation !== 'object' ||
        !Array.isArray(cycleRotations) ||
        cycleRotations.length === 0
      ) {
        return next(
          ApiError.BadRequest('Error confirming plan, invalid input')
        );
      }

      const result = await rotationService.confirmRotation(
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers,
        costCenter
      );
      return res.json({
        result,
        message: 'Plan has been confirmed and saved.',
      });
    } catch (error) {
      console.error('Error confirming rotation:', error.message);
      next(ApiError.BadRequest('Error confirming plan', error.message));
    }
  }

  // Download the latest confirmed plan
  async downloadConfirmedRotation(req, res, next) {
    const costCenter = req.user.costCenter;

    try {
      const confirmedRotation = await ConfirmedRotation.findOne({ costCenter })
        .sort({ createdAt: -1 })
        .lean();

      if (!confirmedRotation) {
        return res
          .status(404)
          .json({ message: 'No confirmed plan available for download' });
      }

      const {
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers,
      } = confirmedRotation.rotation;
      const rotationService = new RotationPlanServise();
      const { buffer, fileName } = await rotationService.saveRotationToExcel(
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers
      );
      res
        .status(200)
        .set({
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Transfer-Encoding': 'binary',
          'Cache-Control': 'no-cache',
          'Content-Length': buffer.length,
        })
        .send(buffer);
    } catch (error) {
      console.error('Error downloading confirmed rotation:', error.message);
      next(ApiError.BadRequest('Error downloading rotation'));
    }
  }
}

module.exports = new RotationPlanController();
