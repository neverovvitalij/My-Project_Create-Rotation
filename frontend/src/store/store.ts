import { makeAutoObservable } from 'mobx';
import { isAxiosError } from 'axios';
import AuthService from '../services/AuthService';
import WorkerService from '../services/EmployeesService';
import StationsService from '../services/StationsService';
import RotationPlanService from '../services/RotationPlanService';
import AoService from '../services/AoService';

import {
  IStore,
  IUser,
  IRotation,
  IStation,
  IEmployee,
  INewStation,
  IPromiseResponse,
  ICandidate,
  ISpecialAssignment,
  IPreassignedEntry,
  INewAo,
  IAo,
} from './types.js';

export default class Store implements IStore {
  user: Partial<IUser> = {};
  isAuth = false;
  isLoading = false;
  errorMsg = '';
  authMsg = '';
  stations: IStation[] = [];
  employeeList: IEmployee[] = [];
  rotation: IRotation = {
    specialRotation: new Map(),
    highPriorityRotation: new Map(),
    cycleRotations: [],
    allWorkers: [],
    aoRotationQueue: new Map(),
  };
  newStation: INewStation = { name: '', priority: 1 };
  isInitializing = true;
  aoList: IAo[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  //Setters
  setUser(user: Partial<IUser> = {}): void {
    this.user = user;
  }

  setAuth(isAuth: boolean): void {
    this.isAuth = isAuth;
  }

  setIsLoading(isLoading: boolean): void {
    this.isLoading = isLoading;
  }

  setIsInitializing(isInitializing: boolean): void {
    this.isInitializing = isInitializing;
  }

  setErrorMsg(errorMsg: string): void {
    this.errorMsg = errorMsg;
  }

  setAuthMsg(authMsg: string): void {
    this.authMsg = authMsg;
  }

  setEmployeeList(employeeList: IEmployee[]): void {
    this.employeeList = employeeList;
  }

  setStations(stations: IStation[]): void {
    this.stations = stations;
  }

  setNewStation(newStation: INewStation): void {
    this.newStation = newStation;
  }

  setDailyRotation(rotation: IRotation): void {
    this.rotation = rotation;
  }

  setAoList(aoList: IAo[]): void {
    this.aoList = aoList;
  }

  //Getters
  get activeEmployee(): number {
    return this.employeeList.filter(
      (emp) => emp.status === true && emp.stations.length > 0
    ).length;
  }

  get activeEmployeeForQuali(): Set<string> {
    return new Set(
      this.employeeList
        .filter((emp) => emp.status === true && emp.stations.length === 0)
        .map((emp) => emp.name)
    );
  }

  get activeStations(): number {
    return this.stations.filter((stn) => stn.status === true).length;
  }

  get activeEmployeeByGroup(): Record<string, number> {
    return this.employeeList.reduce<Record<number, number>>((acc, emp) => {
      const grp = emp.group;
      if (acc[grp] === undefined) acc[grp] = 0;
      if (emp.status === true) acc[grp]++;
      return acc;
    }, {});
  }

  get stationsByGroup(): Record<string, number> {
    return this.stations.reduce<Record<number, number>>((acc, stn) => {
      const grp = stn.group;
      if (acc[grp] === undefined) acc[grp] = 0;
      if (stn.status === true) acc[grp]++;
      return acc;
    }, {});
  }

  //Functions
  async loadData(): Promise<void> {
    try {
      const employees = await WorkerService.fetchWorkers();
      const stations = await StationsService.getStations();
      const aoList = await AoService.getAoListe();
      this.setEmployeeList(employees.data);
      this.setStations(stations.data);
      this.setAoList(aoList.data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.setErrorMsg('Error loading data');
      console.error('Error loading data:', message);
    }
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const response = await AuthService.login(email, password);
      localStorage.setItem('token', response.data.accessToken);
      this.setAuth(true);
      this.setUser(response.data.user);
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        this.setAuthMsg(msg);
      } else {
        this.setAuthMsg('Error logging in');
        console.error(error);
      }
    }
  }

  async registration(
    email: string,
    password: string,
    role: string,
    costCenter: string,
    shift: string,
    plant: string
  ): Promise<void> {
    try {
      const response = await AuthService.registration(
        email,
        password,
        role,
        costCenter,
        shift,
        plant
      );

      setTimeout(() => {
        localStorage.setItem('token', response.data.accessToken);
        this.setAuth(true);
        this.setUser(response.data.user);
      }, 10_000);
    } catch (error: unknown) {
      const msg = isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message ?? error.message
        : 'Error registering';
      this.setAuthMsg(msg);
      throw new Error(msg);
    }
  }

  async logout(): Promise<void> {
    try {
      await AuthService.logout();
      localStorage.removeItem('token');
      this.setAuth(false);
      this.setUser({});
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        this.setAuthMsg(msg);
      } else {
        this.setAuthMsg('Error logging out of account');
        console.error(error);
      }
    }
  }

  async checkAuth(): Promise<void> {
    this.setIsInitializing(true);
    this.setIsLoading(true);
    try {
      const response = await AuthService.refresh();
      localStorage.setItem('token', response.data.accessToken);
      this.setAuth(true);
      this.setUser(response.data.user);
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        this.setAuthMsg(msg);
      } else {
        this.setAuthMsg('Error checking authorization');
        console.error(error);
      }
    } finally {
      this.setIsLoading(false);
      this.setIsInitializing(false);
    }
  }

  async requestResetPassword(email: string): Promise<IPromiseResponse> {
    try {
      const response = await AuthService.requestResetPassword(email);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError<{ success?: boolean; message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        return {
          success: false,
          message: msg,
        };
      } else {
        return {
          success: false,
          message: 'Network error or server unreachable.',
        };
      }
    }
  }

  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<IPromiseResponse> {
    try {
      const response = await AuthService.resetPassword(token, newPassword);
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError<{ success?: boolean; message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        return {
          success: false,
          message: msg,
        };
      } else {
        return {
          success: false,
          message: 'Network error or server unreachable.',
        };
      }
    }
  }

  async addWorker(candidate: ICandidate): Promise<void> {
    try {
      await WorkerService.addWorker(candidate);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Error adding employee';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in addWorker:', error);
        this.setErrorMsg('Error adding employee');
      }
    }
  }

  async addNewStation(newStation: INewStation): Promise<void> {
    try {
      await StationsService.addStation(newStation);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Error adding station';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in addNewStation:', error);
        this.setErrorMsg('Error adding station');
      }
    }
  }

  async deleteStation(station: string): Promise<void> {
    try {
      await StationsService.deleteStation(station);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Error deleting station';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in deleting station:', error);
        this.setErrorMsg('Error deleting station');
      }
    }
  }

  async deleteWorker(name: string): Promise<void> {
    try {
      await WorkerService.deleteWorker(name);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Error deleting employee';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in deleting employee:', error);
        this.setErrorMsg('Error deleting employee');
      }
    }
  }

  async removeStationFromWorker(
    name: string,
    stationToRemove: string
  ): Promise<IPromiseResponse> {
    try {
      const response = await WorkerService.removeStationFromWorker(
        name,
        stationToRemove
      );
      await this.loadData();
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError<{ success?: boolean; message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        return {
          success: false,
          message: msg,
        };
      } else {
        return {
          success: false,
          message: 'Error removing station',
        };
      }
    }
  }

  async addStationToWorker(
    name: string,
    stationToAdd: string
  ): Promise<IPromiseResponse> {
    try {
      const response = await WorkerService.addStationToWorker(
        name,
        stationToAdd
      );
      await this.loadData();
      return response.data;
    } catch (error: unknown) {
      if (isAxiosError<{ success?: boolean; message?: string }>(error)) {
        const msg = error.response?.data?.message ?? error.message;
        return {
          success: false,
          message: msg,
        };
      } else {
        return {
          success: false,
          message: 'Error adding station',
        };
      }
    }
  }

  async getDailyRotation(
    specialAssignments: ISpecialAssignment[] | null,
    preassigned: IPreassignedEntry[] | null,
    cycles: number
  ): Promise<IRotation> {
    try {
      const response = await RotationPlanService.rotationData(
        specialAssignments,
        preassigned,
        cycles
      );

      this.setDailyRotation(response.data);
      return response.data;
    } catch (error: unknown) {
      let msg: string;

      if (isAxiosError<{ message?: string }>(error)) {
        msg =
          error.response?.data?.message ??
          'Error while generating daily rotation';
      } else {
        console.error('Unknown error while generating rotation', error);
        msg = 'Error while generating daily rotation';
      }

      this.setErrorMsg(msg);

      throw new Error(msg);
    }
  }

  async confirmRotation(): Promise<IPromiseResponse> {
    try {
      const entriesOf = (x: any) =>
        x instanceof Map ? Array.from(x.entries()) : Object.entries(x || {});

      const pickName = (w: any) =>
        typeof w === 'string' ? w.trim() : (w?.name ?? '').trim();

      // 1) specialRotation: может быть Map<string, {job: string}> или plain
      const specialRotation = Object.fromEntries(
        entriesOf(this.rotation.specialRotation).map(
          ([workerName, val]: any) => [
            String(workerName).trim(),
            (val?.job ?? (typeof val === 'string' ? val : '')).trim(),
          ]
        )
      );

      // 2) highPriorityRotation: Map<string, Employee> | Record<string, Employee | string>
      const highPriorityRotation = Object.fromEntries(
        entriesOf(this.rotation.highPriorityRotation).map(
          ([station, w]: any) => [String(station), pickName(w)]
        )
      );

      // 3) cycleRotations: Array<Record<string, Employee | string>>
      const cycleRotations = (this.rotation.cycleRotations || []).map((rot) =>
        Object.fromEntries(
          entriesOf(rot)
            .map(([station, w]: any) => [String(station), pickName(w)])
            .filter(([, name]) => !!name) // выбросим пустые назначения
        )
      );

      // 4) aoRotationQueue: уже plain object (Record<string, IEmployee | string>)
      const aoRotationQueue = Object.fromEntries(
        Object.entries(this.rotation.aoRotationQueue || {}).map(
          ([k, v]: any) => [k, pickName(v)]
        )
      );

      const allWorkers = this.rotation.allWorkers;
      const response = await RotationPlanService.confirmRotation(
        allWorkers,
        specialRotation,
        highPriorityRotation,
        cycleRotations,
        aoRotationQueue
      );

      if (!response.data) {
        throw new Error('Server response is empty');
      }

      this.setErrorMsg('');
      return {
        success: true,
        message: 'Plan has been confirmed and saved.',
      };
    } catch (error: unknown) {
      let msg: string;

      if (isAxiosError<{ message?: string }>(error)) {
        msg =
          error.response?.data?.message ?? 'Error confirming cycleRotations';
      } else {
        console.error(
          'Unknown error while Error confirming cycleRotations',
          error
        );
        msg = 'Error confirming cycleRotations';
      }

      this.setErrorMsg(msg);

      throw new Error(msg);
    }
  }

  async downloadLatestConfirmedRotation(): Promise<void> {
    try {
      const response =
        await RotationPlanService.downloadLatestConfirmedRotation();

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
          if (match && match[1]) fileName = decodeURIComponent(match[1]);
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
    } catch (error: unknown) {
      this.setErrorMsg('Error downloading file');
      console.error('downloadLatestConfirmedRotation:', error);
    }
  }

  async changeWorkerStatus(name: string, newStatus: boolean): Promise<void> {
    try {
      await WorkerService.workerChangeStatus(name, newStatus);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Status update error';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in updating status:', error);
        this.setErrorMsg('Status update error');
      }
    }
  }

  async changeWorkerStationStatus(
    name: string,
    newStatus: boolean,
    stationName: string
  ): Promise<void> {
    try {
      await WorkerService.workerChangeStationStatus(
        name,
        newStatus,
        stationName
      );
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Status update error';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in updating status:', error);
        this.setErrorMsg('Status update error');
      }
    }
  }

  async changeStationStatus(name: string, newStatus: boolean): Promise<void> {
    try {
      await StationsService.stationChangeStatus(name, newStatus);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Status update error';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in updating status:', error);
        this.setErrorMsg('Status update error');
      }
    }
  }

  async addNewAo(newAo: INewAo): Promise<void> {
    try {
      await AoService.addAo(newAo);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Error adding AO';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in addNewAO:', error);
        this.setErrorMsg('Error adding AO');
      }
    }
  }

  async deleteAo(name: string, group: number): Promise<void> {
    try {
      await AoService.deleteAo(name, group);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Error deleting AO';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in deleting AO:', error);
        this.setErrorMsg('Error deleting AO');
      }
    }
  }

  async changeStatusAoTask(
    name: string,
    newStatus: boolean,
    group: number
  ): Promise<void> {
    try {
      await AoService.changeStatusAoTask(name, newStatus, group);
      this.setErrorMsg('');
      await this.loadData();
    } catch (error: unknown) {
      if (isAxiosError<{ message?: string }>(error)) {
        const msg = error.response?.data?.message ?? 'Status update error';
        this.setErrorMsg(msg);
      } else {
        console.error('Unexpected error in updating status:', error);
        this.setErrorMsg('Status update error');
      }
    }
  }
}
