import { AxiosResponse } from 'axios';
import api from '../http/index';
import {
  IConfirmedRotation,
  IPreassignedEntry,
  IRotation,
  ISpecialAssignment,
  AllWorkers,
} from '../store/types';

export default class RotationPlanService {
  static async previewExcel(rotation: IRotation): Promise<AxiosResponse<Blob>> {
    return api.post<Blob>('/rotation-preview-excel', rotation, {
      responseType: 'blob',
    });
  }

  static async rotationData(
    specialAssignments: ISpecialAssignment[] | null,
    preassigned: IPreassignedEntry[] | null,
    cycles: number
  ): Promise<AxiosResponse<IRotation>> {
    return api.post<IRotation>('/rotation-data', {
      specialAssignments,
      preassigned,
      cycles,
    });
  }

  static async confirmRotation(
    allWorkers: AllWorkers,
    specialRotation: Record<string, string>,
    highPriorityRotation: Record<string, string>,
    cycleRotations: Array<Record<string, string>>
  ): Promise<AxiosResponse<IConfirmedRotation>> {
    return api.post<IConfirmedRotation>('/confirm-rotation', {
      allWorkers,
      specialRotation,
      highPriorityRotation,
      cycleRotations,
    });
  }

  static async downloadLatestConfirmedRotation(): Promise<AxiosResponse<Blob>> {
    return api.get<Blob>('/download-latest-confirmed-rotation', {
      responseType: 'blob',
    });
  }
}
