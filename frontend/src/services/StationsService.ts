import { AxiosResponse } from 'axios';
import api from '../http/index';
import { IStation, INewStation } from '../store/types';

export default class StationsService {
  static async addStation(
    newStation: INewStation
  ): Promise<AxiosResponse<IStation>> {
    return api.post<IStation>('/new-station', newStation);
  }

  static async getStations(): Promise<AxiosResponse<IStation[]>> {
    return api.get<IStation[]>('/stations');
  }

  static async deleteStation(name: string): Promise<AxiosResponse<IStation>> {
    return api.delete<IStation>('/delete-station', { data: { name } });
  }

  static async stationChangeStatus(
    name: string,
    newStatus: boolean
  ): Promise<AxiosResponse<IStation>> {
    return api.patch<IStation>('/change-station-status', { name, newStatus });
  }
}
