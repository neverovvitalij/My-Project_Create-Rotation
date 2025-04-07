import api from '../http/index';

export default class WorkerService {
  static async fetchWorkers() {
    return api.get('/workers');
  }

  static async addWorker(candidate) {
    return api.post('/add-worker', candidate);
  }

  static async deleteWorker(name) {
    return api.delete('/delete-worker', { data: { name } });
  }

  static async workerChangeStatus(name, newStatus) {
    return api.patch('/change-worker-status', { name, newStatus });
  }

  static async removeStationFromWorker(name, stationToRemove) {
    return api.patch(`/worker/${name}/station-to-delete`, {
      name,
      stationToRemove,
    });
  }

  static async addStationToWorker(name, stationToAdd) {
    return api.patch(`/worker/${name}/station-to-add`, { name, stationToAdd });
  }
}
