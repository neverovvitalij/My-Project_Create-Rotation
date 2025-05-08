import api from '../http/index';

export default class RotationPlanService {
  static async dailyRotation(specialAssignments, preassigned) {
    return api.post('/daily-rotation', { specialAssignments, preassigned });
  }

  static async confirmRotation(
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    allWorkers
  ) {
    return api.post('/confirm-rotation', {
      specialRotation,
      highPriorityRotation,
      cycleRotations,
      allWorkers,
    });
  }

  static async downloadLatestConfirmedRotation() {
    return api.get('/download-latest-confirmed-rotation', {
      responseType: 'blob',
    });
  }
}
