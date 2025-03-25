import api from '../http/index';

export default class RotationPlanService {
  static async dailyRotation(specialAssignments, preassigned) {
    return api.post('/daily-rotation', { specialAssignments, preassigned });
  }

  static async confirmRotation(
    specialRotation,
    highPriorityRotation,
    dailyRotations
  ) {
    return api.post('/confirm-rotation', {
      specialRotation,
      highPriorityRotation,
      dailyRotations,
    });
  }

  static async downloadLatestConfirmedRotation() {
    return api.get('/download-latest-confirmed-rotation', {
      responseType: 'blob',
    });
  }
}
