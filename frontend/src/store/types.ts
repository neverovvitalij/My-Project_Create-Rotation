export interface IUser {
  id?: string;
  email: string;
  password: string;
  role: string;
  costCenter: string;
  activationLink?: string;
  adminActivationLink?: string;
  shift: string;
  plant: string;
  isActivated: boolean;
}

export interface IStationByEmployee {
  name: string;
  isActive: boolean;
  _id?: string;
}

export interface IEmployee {
  name: string;
  costCenter: string;
  shift: string;
  plant: string;
  stations: IStationByEmployee[];
  group: number;
  status?: boolean;
  _id?: string;
}

export interface IStation {
  name: string;
  priority: number;
  group: number;
  costCenter: string;
  shift: string;
  plant: string;
  status?: boolean;
  _id: string;
}

export interface INewStation {
  name: string;
  priority: number;
  group?: number;
}

export type SpecialRotation = Map<string, string>;
export type HighPriorityRotation = Map<string, IEmployee>;
export type CycleRotation = Record<string, IEmployee>;
export type CycleRotations = CycleRotation[];
export type AllWorkers = IEmployee[];

export interface IRotation {
  specialRotation: SpecialRotation;
  highPriorityRotation: HighPriorityRotation;
  cycleRotations: CycleRotations;
  allWorkers: AllWorkers;
}

export interface IConfirmedRotation {
  costCenter: string;
  shift: string;
  plant: string;
  rotation: IRotation;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStore {
  isAuth: boolean;
  isLoading: boolean;
  errorMsg: string;
  authMsg: string;
  stations: IStation[];
  employeeList: IEmployee[];
  rotation: IRotation;
  user: Partial<IUser>;
  newStation: INewStation;
  isInitializing: boolean;
  setUser(user: Partial<IUser>): void;
  setAuth(isAuth: boolean): void;
  setIsLoading(isLoading: boolean): void;
  setIsInitializing(isInitializing: boolean): void;
  setErrorMsg(msg: string): void;
  setAuthMsg(authMsg: string): void;
  setEmployeeList(employeeList: IEmployee[]): void;
  setStations(stations: IStation[]): void;
  setNewStation(newStation: INewStation): void;
  setDailyRotation(rotation: IRotation): void;
  get activeEmployee(): number;
  get activeStations(): number;
  get activeEmployeeByGroup(): Record<string, number>;
  get activeEmployeeForQuali(): Set<string>;
  get stationsByGroup(): Record<string, number>;
  loadData(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  registration(
    email: string,
    password: string,
    role: string,
    costCenter: string,
    shift: string,
    plant: string
  ): Promise<void>;
  logout(): Promise<void>;
  checkAuth(): Promise<void>;
  requestResetPassword(email: string): Promise<IPromiseResponse>;
  resetPassword(token: string, newPassword: string): Promise<IPromiseResponse>;
  addWorker(candidate: ICandidate): Promise<void>;
  addNewStation(newStation: INewStation): Promise<void>;
  deleteStation(station: string): Promise<void>;
  deleteWorker(name: string): Promise<void>;
  removeStationFromWorker(
    name: string,
    stationToRemove: string
  ): Promise<IPromiseResponse>;
  addStationToWorker(
    name: string,
    stationToAdd: string
  ): Promise<IPromiseResponse>;
  getDailyRotation(
    specialAssignments: ISpecialAssignment[] | null,
    preassigned: IPreassignedEntry[] | null,
    cycles: number
  ): Promise<IRotation>;
  confirmRotation(): Promise<IPromiseResponse>;
  downloadLatestConfirmedRotation(): Promise<void>;
  changeWorkerStatus(name: string, newStatus: boolean): Promise<void>;
  changeStationStatus(name: string, newStatus: boolean): Promise<void>;
}

export interface IPromiseResponse {
  success: boolean;
  message: string;
}

export interface ICandidate {
  name: string;
  stations: IStationByEmployee[];
  group: number;
}

export interface IAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: IUser;
}

export interface ISpecialAssignment {
  worker: string;
  job: string;
}

export interface IPreassignedEntry {
  worker: string;
  station: string;
}

export interface IRequestRotationData {
  specialAssignments: ISpecialAssignment[] | null;
  preassigned: IPreassignedEntry[] | null;
  cycles: number;
}
