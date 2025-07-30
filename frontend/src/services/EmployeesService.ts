import { AxiosResponse } from 'axios';
import api from '../http/index';
import { ICandidate, IEmployee, IPromiseResponse } from '../store/types';

export default class WorkerService {
  static async fetchWorkers(): Promise<AxiosResponse<IEmployee[]>> {
    return api.get<IEmployee[]>('/workers');
  }

  static async addWorker(
    candidate: ICandidate
  ): Promise<AxiosResponse<IEmployee>> {
    return api.post<IEmployee>('/add-worker', candidate);
  }

  static async deleteWorker(name: string): Promise<AxiosResponse<IEmployee>> {
    return api.delete<IEmployee>('/delete-worker', { data: { name } });
  }

  static async workerChangeStatus(
    name: string,
    newStatus: boolean
  ): Promise<AxiosResponse<IEmployee>> {
    return api.patch<IEmployee>('/change-worker-status', { name, newStatus });
  }

  static async removeStationFromWorker(
    name: string,
    stationToRemove: string
  ): Promise<AxiosResponse<IPromiseResponse>> {
    return api.patch<IPromiseResponse>(`/worker/${name}/station-to-delete`, {
      name,
      stationToRemove,
    });
  }

  static async addStationToWorker(
    name: string,
    stationToAdd: string
  ): Promise<AxiosResponse<IPromiseResponse>> {
    return api.patch<IPromiseResponse>(`/worker/${name}/station-to-add`, {
      name,
      stationToAdd,
    });
  }
}
