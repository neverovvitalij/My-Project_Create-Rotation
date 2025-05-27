const ApiError = require('../exceptions/api-error');
const ConfirmedRotation = require('../models/confirmedrotation-model');
const RotationPlanService = require('../services/rotationplan-service');

class RotationPlanController {
  constructor() {
    this.getRotationData = this.getRotationData.bind(this);
    this.previewExcel = this.previewExcel.bind(this);
    this.confirmRotation = this.confirmRotation.bind(this);
    this.downloadConfirmedRotation = this.downloadConfirmedRotation.bind(this);
  }

  async getRotationData(req, res, next) {
    try {
      const { specialAssignments = [], preassigned = [], cycles } = req.body;
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;

      const service = new RotationPlanService();
      const data = await service.generateRotationData(
        specialAssignments,
        preassigned,
        cycles,
        costCenter,
        shift
      );
      return res.json(data);
    } catch (error) {
      next(ApiError.BadRequest('Error creating rotation JSON', error.message));
    }
  }

  async previewExcel(req, res, next) {
    try {
      const {
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers,
      } = req.body;

      const service = new RotationPlanService();
      const { buffer, fileName } = await service.buildExcelBuffer(
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers
      );
      return res
        .status(200)
        .set({
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        })
        .send(buffer);
    } catch (err) {
      console.error('Error generating daily rotation:', err);
      next(ApiError.BadRequest('Error creating plan', err.message));
    }
  }

  // Confirm the rotation plan
  async confirmRotation(req, res, next) {
    try {
      const costCenter = req.user.costCenter;
      const shift = req.user.shift;
      const rotationService = new RotationPlanService();
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
        costCenter,
        shift
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
    const shift = req.user.shift;

    try {
      const confirmedRotation = await ConfirmedRotation.findOne({
        costCenter,
        shift,
      })
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
      const rotationService = new RotationPlanService();
      const { buffer, fileName } = await rotationService.buildExcelBuffer(
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
