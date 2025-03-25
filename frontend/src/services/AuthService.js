import api from '../http/index';

export default class AuthService {
  static async registration(email, password) {
    return api.post('/registartion', { email, password });
  }

  static async login(email, password) {
    return api.post('/login', { email, password });
  }

  static async logout() {
    return api.post('/logout');
  }

  static async refresh() {
    return api.get('/refresh');
  }

  static async requestResetPassword(email) {
    return api.post('/request-reset-password', { email });
  }

  static async resetPassword(token, newPassword) {
    return api.post('/reset-password', { token, newPassword });
  }
}
