import { makeAutoObservable } from 'mobx';
import AuthServise from './services/AuthServise.js';
import UserService from './services/UserService.js';
import StationsService from './services/StationsService.js';
import RotationPlanService from './services/RotationPlanService.js';

export default class Store {
  user = {};
  isAuth = false;
  isLoading = false;
  isInitializing = true;
  errorMsg = '';
  authErrorMsg = '';
  employeeList = [];
  stations = [];
  newStation = { name: '', priority: 0 };
  dailyRotation = {
    specialRotation: {},
    highPriorityRotation: {},
    rotation: [],
    date: '',
  };

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

  setAuthErrorMsg(msg) {
    this.authErrorMsg = msg;
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

  setDailyRotation({ specialRotation, highPriorityRotation, rotation, date }) {
    this.dailyRotation = {
      specialRotation: specialRotation || {},
      highPriorityRotation: highPriorityRotation || {},
      rotation: Array.isArray(rotation) ? rotation : [],
      date: date,
    };
  }

  get activeEmployeeCount() {
    return this.employeeList.filter((emp) => emp.status).length;
  }

  get stationsCount() {
    return this.stations.filter((stn) => stn.status).length;
  }

  async loadData() {
    try {
      const personsResponse = await UserService.fetchPersons();
      const stationsResponse = await StationsService.getStations();
      this.setEmployeeList(personsResponse.data);
      this.setStations(stationsResponse.data);
    } catch (error) {
      this.setErrorMsg('Error loading data');
      console.error('Error loading data:', error.message || error);
    }
  }

  async login(email, password) {
    try {
      const responseLogin = await AuthServise.login(email, password);
      localStorage.setItem('token', responseLogin.data.accessToken);
      this.setAuth(true);
      this.setUser(responseLogin.data.user);
    } catch (error) {
      this.setAuthErrorMsg(
        error.responseLogin?.data?.message || 'Error logging in'
      );
    }
  }

  async registartion(email, password) {
    try {
      const responseRegistration = await AuthServise.registration(
        email,
        password
      );
      localStorage.setItem('token', responseRegistration.data.accessToken);
      this.setAuth(true);
      this.setUser(responseRegistration.data.user);
    } catch (error) {
      this.setAuthErrorMsg(
        error.responseLogin?.data?.message || 'Error registering'
      );
    }
  }

  async logout() {
    try {
      await AuthServise.logout();
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
      const responseCheckAuth = await AuthServise.refresh();
      localStorage.setItem(responseCheckAuth.data.accessToken);
      this.setAuth(true);
      this.setUser(responseCheckAuth.data.user);
    } catch (error) {
      console.error('Error checking authorization:', error.message || error);
    } finally {
      this.setIsLoading(false);
      this.setIsInitializing(false);
    }
  }

  async requestResetPassword(email) {
    try {
      const responseReqResPassword = await AuthServise.requestResetPassword(
        email
      );
      return responseReqResPassword.data;
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
      const responseResPassword = await AuthServise.resetPassword(
        token,
        newPassword
      );
      return responseResPassword.data;
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

  async addPerson(candidate) {
    try {
      const responseAddPerson = await UserService.addPerson(candidate);
      this.setEmployeeList([...this.employeeList, responseAddPerson.data]);
      this.setErrorMsg('');
      this.loadData();
    } catch (error) {
      this.setErrorMsg(
        error.response?.data?.message || 'Error adding employee'
      );
    }
  }

  async addNewStation({ name, priority, group }) {
    try {
      const responseAddNewStation = await StationsService.addStation(
        name,
        priority,
        group
      );
      this.setNewStation(responseAddNewStation.data);
      this.setErrorMsg('');
      this.loadData();
    } catch (error) {
      this.setErrorMsg(`Station ${name} already exists`);
    }
  }

  async deleteStation(station) {
    try {
      const responseDeleteStation = await StationsService.deleteStation(
        station
      );
      this.setStations(
        this.stations.filter((s) => s.name !== responseDeleteStation.name)
      );
      this.setErrorMsg('');
      this.loadData();
    } catch (error) {
      this.setErrorMsg('Error deleting station:', error.message || error);
    }
  }

  async deletePerson(name) {
    try {
      const responseDeletePerson = await UserService.deletePerson(name);
      this.setEmployeeList(
        this.employeeList.filter(
          (person) => person.name !== responseDeletePerson.name
        )
      );
      this.setErrorMsg('');
      this.loadData();
    } catch (error) {
      this.setErrorMsg('Error deleting employee:', error.message || error);
    }
  }

  async removeStationFromPerson(name, stationToRemove) {
    try {
      const responseRemStnFromPerson =
        await UserService.removeStationFromPerson(name, stationToRemove);
      this.loadData();
      return responseRemStnFromPerson.data;
    } catch (error) {
      console.error('Error removing station:', error.message || error);
    }
  }

  async addStationToPerson(name, stationToAdd) {
    try {
      const responseAddStnToPerson = await UserService.addStationToPerson(
        name,
        stationToAdd
      );
      this.loadData();
      return responseAddStnToPerson.data;
    } catch (error) {
      console.error('Error adding station:', error.message || error);
    }
  }

  async getDailyRotation(specialAssignments = null, preassigned = null) {
    try {
      const responseDailyRotation = await RotationPlanService.dailyRotation(
        specialAssignments,
        preassigned
      );
      this.setDailyRotation(responseDailyRotation.data);
    } catch (error) {
      this.setErrorMsg('Error creating rotation plan');
    }
  }

  async confirmRotation(
    specialRotation = null,
    highPriorityRotation,
    dailyRotations
  ) {
    try {
      if (
        !highPriorityRotation ||
        typeof highPriorityRotation !== 'object' ||
        !Array.isArray(dailyRotations) ||
        dailyRotations.length === 0
      ) {
        throw new Error('Incorrect rotation data');
      }

      const responseConfirmRotation = await RotationPlanService.confirmRotation(
        specialRotation,
        highPriorityRotation,
        dailyRotations
      );

      if (responseConfirmRotation?.data) {
        this.setErrorMsg('');
      } else {
        throw new Error('Server response is empty');
      }
    } catch (error) {
      console.error(error.response?.data?.message || error.message);
      this.setErrorMsg('Error confirming rotation');
    }
  }

  async downloadLatestConfirmedRotation() {
    try {
      const responseDwnldLatstConfirmdRotation =
        await RotationPlanService.downloadLatestConfirmedRotation();

      if (
        responseDwnldLatstConfirmdRotation.status === 200 &&
        responseDwnldLatstConfirmdRotation.data
      ) {
        const blob = new Blob([responseDwnldLatstConfirmdRotation.data], {
          type: 'application/pdf',
        });

        let fileName = responseDwnldLatstConfirmdRotation.headers[
          'content-disposition'
        ]
          ? responseDwnldLatstConfirmdRotation.headers['content-disposition']
              .split('filename=')[1]
              ?.replace(/"/g, '')
          : `rotation_plan${new Date().toISOString().split('T')[0]}.xlsx`;

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        throw new Error('File not received.');
      }
    } catch (error) {
      this.setErrorMsg('Error downloading file');
    }
  }

  async changeEmployeeStatus(name, newStatus) {
    try {
      await UserService.personChangeStatus(name, newStatus);

      this.setEmployeeList(
        this.employeeList.map((emp) =>
          emp.name === name ? { ...emp, status: newStatus } : emp
        )
      );
      this.setErrorMsg('');
    } catch (error) {
      this.setErrorMsg('Status update error', error.message);
    }
  }

  async changeStationStatus(name, newStatus) {
    try {
      await StationsService.stationChangeStatus(name, newStatus);

      this.setStations(
        this.stations.map((station) =>
          station.name === name ? { ...station, status: newStatus } : station
        )
      );
      this.setErrorMsg('');
    } catch (error) {
      this.setErrorMsg('Status update error', error.message);
    }
  }
}
