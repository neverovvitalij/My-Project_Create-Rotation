import { AxiosResponse } from 'axios';
import api from '../http/index';
import { IAo, INewAo } from '../store/types';

export default class AoService {
  static async getAoListe(): Promise<AxiosResponse<IAo[]>> {
    return api.get<IAo[]>('/ao-liste');
  }

  static async addAo(newStation: INewAo): Promise<AxiosResponse<IAo>> {
    return api.post<IAo>('/new-ao', newStation);
  }

  static async deleteAo(
    name: string,
    group: number
  ): Promise<AxiosResponse<IAo>> {
    return api.delete<IAo>('/delete-ao', { data: { name, group } });
  }

  static async changeStatusAoTask(
    name: string,
    newStatus: boolean,
    group: number
  ): Promise<AxiosResponse<IAo>> {
    return api.patch<IAo>('/change-ao-status', { name, newStatus, group });
  }
}
