import { AxiosResponse } from 'axios';
import api from '../http/index';
import { IAuthResponse, IPromiseResponse } from '../store/types';

export default class AuthService {
  static async registration(
    email: string,
    password: string,
    role: string,
    costCenter: string,
    shift: string,
    plant: string
  ): Promise<AxiosResponse<IAuthResponse>> {
    return api.post<IAuthResponse>('/registration', {
      email,
      password,
      role,
      costCenter,
      shift,
      plant,
    });
  }

  static async login(
    email: string,
    password: string
  ): Promise<AxiosResponse<IAuthResponse>> {
    return api.post<IAuthResponse>('/login', { email, password });
  }

  static async logout() {
    return api.post('/logout');
  }

  static async refresh(): Promise<AxiosResponse<IAuthResponse>> {
    return api.get<IAuthResponse>('/refresh');
  }

  static async requestResetPassword(
    email: string
  ): Promise<AxiosResponse<IPromiseResponse>> {
    return api.post<IPromiseResponse>('/request-reset-password', { email });
  }

  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<AxiosResponse<IPromiseResponse>> {
    return api.post<IPromiseResponse>('/reset-password', {
      token,
      newPassword,
    });
  }
}
