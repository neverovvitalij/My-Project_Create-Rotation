import { makeAutoObservable } from 'mobx';
import AuthService from '../services/AuthService.js';
import WorkerService from '../services/WorkerService.js';
import StationsService from '../services/StationsService.js';
import RotationPlanService from '../services/RotationPlanService.js';

export default class Store {
  user = {};
  isAuth = false;
  isLoading = false;
  errorMsg = '';
  authMsg = '';
  employeeList = [];
  stations = [];
  newStation = { name: '', priority: 0 };
  rotation = {
    specialRotation: {},
    highPriorityRotation: {},
    cycleRotations: [],
    date: '',
    allWorkers: [],
  };
  isInitializing = true;

  constructor() {
    makeAutoObservable(this);
  }

  setUser(user) {
    this.user = user;
  }

  setAuth(value) {
    this.isAuth = value;
  }

  setIsLoading(value) {
    this.isLoading = value;
  }

  setIsInitializing(value) {
    this.isInitializing = value;
  }

  setErrorMsg(msg) {
    this.errorMsg = msg;
  }

  setAuthMsg(msg) {
    this.authMsg = msg;
  }

  setEmployeeList(data) {
    this.employeeList = Array.isArray(data) ? data : [];
  }

  setStations(data) {
    this.stations = Array.isArray(data) ? data : [];
  }

  setNewStation(station) {
    this.newStation = station;
  }

  setDailyRotation({
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    date,
    allWorkers,
  }) {
    this.rotation = {
      specialRotation: specialRotation || {},
      highPriorityRotation: highPriorityRotation || {},
      cycleRotations: Array.isArray(cycleRotations) ? cycleRotations : [],
      date: date,
      allWorkers: allWorkers || [],
    };
  }

  get activeEmployee() {
    return this.employeeList.filter((emp) => emp.status).length;
  }

  get activeStations() {
    return this.stations.filter((stn) => stn.status).length;
  }

  get activeEmployeeByGroup() {
    return this.employeeList.reduce((acc, emp) => {
      const grp = emp.group;
      if (!acc[grp]) acc[grp] = 0;
      if (emp.status) acc[grp]++;
      return acc;
    }, {});
  }

  get stationsByGroup() {
    return this.stations.reduce((acc, stn) => {
      const grp = stn.group;
      if (!acc[grp]) acc[grp] = 0;
      if (stn.status) acc[grp]++;
      return acc;
    }, {});
  }

  async loadData() {
    try {
      const workersResponse = await WorkerService.fetchWorkers();
      const stationsResponse = await StationsService.getStations();
      this.setEmployeeList(workersResponse.data);
      this.setStations(stationsResponse.data);
    } catch (error) {
      this.setErrorMsg('Error loading data');
      console.error('Error loading data:', error.message || error);
    }
  }

  async login(email, password) {
    try {
      const response = await AuthService.login(email, password);
      localStorage.setItem('token', response.data.accessToken);
      this.setAuth(true);
      this.setUser(response.data.user);
    } catch (error) {
      this.setAuthMsg(error.response?.data?.message || 'Error logging in');
    }
  }

  async registration(email, password, role, costCenter, shift, plant) {
    try {
      const response = await AuthService.registration(
        email,
        password,
        role,
        costCenter,
        shift,
        plant
      );
      if (response) {
        setTimeout(() => {
          localStorage.setItem('token', response.data.accessToken);
          this.setAuth(true);
          this.setUser(response.data.user);
        }, 10000);
      }
    } catch (error) {
      this.setAuthMsg(error.response?.data?.message || 'Error registering');
    }
  }

  async logout() {
    try {
      await AuthService.logout();
      localStorage.removeItem('token');
      this.setAuth(false);
      this.setUser({});
    } catch (error) {
      console.error('Error logging out of account:', error.message || error);
    }
  }

  async checkAuth() {
    this.setIsInitializing(true);
    this.setIsLoading(true);
    try {
      const response = await AuthService.refresh();
      localStorage.setItem('token', response.data.accessToken);
      this.setAuth(true);
      this.setUser(response.data.user);
    } catch (error) {
      console.error('Error checking authorization:', error.message || error);
    } finally {
      this.setIsLoading(false);
      this.setIsInitializing(false);
    }
  }

  async requestResetPassword(email) {
    try {
      const response = await AuthService.requestResetPassword(email);

      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('Error resetting password:', error.response.data);
        return error.response.data;
      } else {
        console.error('Network error or server unreachable.');
        return {
          succes: false,
          message: 'Network error or server unreachable.',
        };
      }
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const response = await AuthService.resetPassword(token, newPassword);
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('Error resetting password:', error.response.data);
      } else {
        console.error('Network error or server unreachable.');
        return {
          success: false,
          message: 'Network error or server unreachable.',
        };
      }
    }
  }

  async addWorker(candidate) {
    try {
      await WorkerService.addWorker(candidate);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error) {
      this.setErrorMsg(
        error.response?.data?.message || 'Error adding employee'
      );
    }
  }

  async addNewStation({ name, priority, group }) {
    try {
      await StationsService.addStation(name, priority, group);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error) {
      const serverMsg =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message;
      this.setErrorMsg(serverMsg);
    }
  }

  async deleteStation(station) {
    try {
      await StationsService.deleteStation(station);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error) {
      this.setErrorMsg('Error deleting station:', error.message || error);
    }
  }

  async deleteWorker(name) {
    try {
      await WorkerService.deleteWorker(name);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error) {
      this.setErrorMsg('Error deleting employee:', error.message || error);
    }
  }

  async removeStationFromWorker(name, stationToRemove) {
    try {
      const response = await WorkerService.removeStationFromWorker(
        name,
        stationToRemove
      );
      await this.loadData();
      return response.data;
    } catch (error) {
      const msg = error.response?.data?.message || 'Error removing station';
      this.setErrorMsg(msg);
      throw error;
    }
  }

  async addStationToWorker(name, stationToAdd) {
    try {
      const response = await WorkerService.addStationToWorker(
        name,
        stationToAdd
      );
      await this.loadData();

      return response.data;
    } catch (error) {
      const msg = error.response?.data?.message || 'Error adding station';
      this.setErrorMsg(msg);
      throw error;
    }
  }

  async getDailyRotation(
    specialAssignments = null,
    preassigned = null,
    cycles
  ) {
    try {
      const response = await RotationPlanService.rotationData(
        specialAssignments,
        preassigned,
        cycles
      );
      this.setDailyRotation(response.data);
      return response.data;
    } catch (error) {
      const msg =
        error.response?.data?.message ||
        'Unknown error while generating rotation';
      this.setErrorMsg(msg);
      throw error;
    }
  }

  async confirmRotation() {
    try {
      const allWorkers = this.rotation.allWorkers;
      const specialRotation = Object.fromEntries(
        Object.entries(this.rotation.specialRotation).map(
          ([workerName, { job }]) => [workerName.trim(), job]
        )
      );

      const highPriorityRotation = Object.fromEntries(
        Object.entries(this.rotation.highPriorityRotation).map(
          ([station, workerObj]) => [station, workerObj.name.trim()]
        )
      );

      const cycleRotations = this.rotation.cycleRotations.map((rot) =>
        Object.fromEntries(
          Object.entries(rot).map(([station, workerObj]) => [
            station,
            workerObj.name.trim(),
          ])
        )
      );

      const response = await RotationPlanService.confirmRotation(
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        allWorkers
      );
      if (!response.data) {
        throw new Error('Server response is empty');
      }
      this.setErrorMsg('');
      return response.data;
    } catch (error) {
      console.error(error.response?.data?.message || error.message);
      this.setErrorMsg('Error confirming cycleRotations');
    }
  }

  async downloadLatestConfirmedRotation() {
    try {
      const response =
        await RotationPlanService.downloadLatestConfirmedRotation({
          responseType: 'blob',
        });

      if (response.status === 200 && response.data) {
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]
          .replace(/(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1');

        let fileName = 'Rotationplan ' + tomorrowDate + '.xlsx';
        const cd = response.headers['content-disposition'];
        if (cd) {
          const match =
            cd.match(/filename\*?=['"]?UTF-8''(.+?)['"]?$/i) ||
            cd.match(/filename=['"]?(.+?)['"]?$/i);
          if (match) fileName = decodeURIComponent(match[1]);
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('File not received.');
      }
    } catch (error) {
      this.setErrorMsg('Error downloading file');
    }
  }

  async changeWorkerStatus(name, newStatus) {
    try {
      await WorkerService.workerChangeStatus(name, newStatus);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error) {
      this.setErrorMsg('Status update error', error.message);
    }
  }

  async changeStationStatus(name, newStatus) {
    try {
      await StationsService.stationChangeStatus(name, newStatus);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error) {
      this.setErrorMsg('Status update error', error.message);
    }
  }
}
