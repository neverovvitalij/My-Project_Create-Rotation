import api from '../http/index';

export default class RotationPlanService {
  static async previewExcel(
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    allWorkers
  ) {
    return api.post(
      '/rotation-preview-excel',
      { specialRotation, highPriorityRotation, cycleRotations, allWorkers },
      { responseType: 'blob' }
    );
  }

  static async rotationData(specialAssignments, preassigned, cycles) {
    return api.post('/rotation-data', {
      specialAssignments,
      preassigned,
      cycles,
    });
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
