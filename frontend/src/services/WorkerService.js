import api from '../http/index';

export default class WorkerService {
  static async fetchWorkers() {
    return api.get('/workers');
  }

  static async addWorker(candidate) {
    return api.post('/add-worker', candidate);
  }

  static async deleteWorker(name) {
    return api.delete('/dlt-worker', { data: name });
  }

  static async workerChangeStatus(name, newStatus) {
    return api.patch('/worker-change-status', { name, newStatus });
  }

  static async removeStationFromWorker(name, stationToRemove) {
    return api.patch(`/worker/${name}/stationtodell`, {
      name,
      stationToRemove,
    });
  }

  static async addStationToWorker(name, stationToAdd) {
    return api.patch(`/person/${name}/stationtoadd`, { name, stationToAdd });
  }
}
