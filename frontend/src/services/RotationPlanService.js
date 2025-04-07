import api from '../http/index';

export default class RotationPlanService {
  static async dailyRotation(specialAssignments, preassigned) {
    return api.post('/daily-rotation', { specialAssignments, preassigned });
  }

  static async confirmRotation(
    specialRotation,
    highPriorityRotation,
    cycleRotations
  ) {
    return api.post('/confirm-rotation', {
      specialRotation,
      highPriorityRotation,
      cycleRotations,
    });
  }

  static async downloadLatestConfirmedRotation() {
    return api.get('/download-latest-confirmed-rotation', {
      responseType: 'blob',
    });
  }
}
