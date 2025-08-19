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
  setErrorMsg(msg: string): void;
  addNewStation(newStation: INewStation): Promise<void>;
  addWorker(candidate: ICandidate): Promise<void>;
  logout(): Promise<void>;
  deleteStation(station: string): Promise<void>;
  changeStationStatus(name: string, newStatus: boolean): Promise<void>;
  removeStationFromWorker(
    name: string,
    stationToRemove: string
  ): Promise<IPromiseResponse>;
  addStationToWorker(
    name: string,
    stationToAdd: string
  ): Promise<IPromiseResponse>;
  deleteWorker(name: string): Promise<void>;
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
