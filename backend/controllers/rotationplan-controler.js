const path = require('path');
const fs = require('fs').promises;
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

      // Validate specialAssignments (if needed)
      // return next(
      //   ApiError.BadRequest(
      //     'sonderAssignments must be an array of { person, job } objects'
      //   )
      // );

      // Pass cycles, preassigned, and sonderAssignments
      const result = await rotationService.generateDailyRotation(
        specialAssignments || [],
        preassigned || [],
        cycles
      );

      if (!result || typeof result !== 'object') {
        return next(ApiError.BadRequest('Invalid rotation data format.'));
      }
      res.json(result);
    } catch (error) {
      console.error('Error generating daily rotation:', error.message),
        next(ApiError.BadRequest('Error creating plan', error.message));
    }
  }

  // Confirm the rotation plan
  async confirmRotation(req, res, next) {
    try {
      const rotationService = new RotationPlanServise();
      const { specialRotation, highPriorityRotation, dailyRotation } = req.body;

      if (
        !highPriorityRotation ||
        typeof highPriorityRotation !== 'object' ||
        !Array.isArray(dailyRotation) ||
        dailyRotation.length === 0
      ) {
        return next(
          ApiError.BadRequest('Error confirming plan, invalid input')
        );
      }

      const result = await rotationService.confirmRotation(
        specialRotation,
        highPriorityRotation,
        dailyRotation
      );
      res.json({ result, message: 'Plan has been confirmed and saved.' });
    } catch (error) {
      console.error('Error confirming rotation:', error.message);
      next(ApiError.BadRequest('Error confirming plan', error.message));
    }
  }

  // Download the latest confirmed plan
  async downloadConfirmedRotation(req, res, next) {
    try {
      const confirmedRotation = await ConfirmedRotation.findOne()
        .sort({ date: -1 })
        .lean();

      if (!confirmedRotation) {
        return res
          .status(404)
          .json({ message: 'No confirmed plan available for download' });
      }

      const { specialRotation, highPriorityRotation, dailyRotation } =
        confirmedRotation.rotation;

      const rotationService = new RotationPlanServise();
      const filePath = await rotationService.saveRotationToExcel(
        specialRotation,
        highPriorityRotation,
        dailyRotation
      );

      if (!filePath) {
        console.error('Error: File was not created.');
        return res.status(500).send('Error creating Excel file');
      }

      const fileName = path.basename(filePath);
      res.download(filePath, fileName, async (err) => {
        if (err) {
          console.error('Error sending file:', err);
          return res.status(500).send('Error transferring file.');
        }
        try {
          await fs.unlink(filePath); // Remove the file after successful send
        } catch (unlinkErr) {
          console.error('Error deleting file:', unlinkErr);
        }
      });
    } catch (error) {
      console.error('Error downloading confirmed rotation:', error.message);
      next(ApiError.BadRequest('Error downloading rotation'));
    }
  }
}

module.exports = new RotationPlanController();
