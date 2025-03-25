import api from '../http/index';

export default class StationsService {
  static async addStation(name, priority, group) {
    return api.post('/new-station', { name, priority, group });
  }

  static async getStations() {
    return api.get('/stations');
  }

  static async deleteStation(name) {
    return api.delete('/delete-station', { data: { name } });
  }

  static async stationChangeStatus(name, newStatus) {
    return api.patch('/change-status-station', { name, newStatus });
  }
}
