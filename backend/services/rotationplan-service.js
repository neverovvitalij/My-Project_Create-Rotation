const path = require('path');
const ExcelJS = require('exceljs');
const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ConfirmedRotation = require('../models/confirmedrotation-model');
const StationModel = require('../models/station-model');

class RotationPlanService {
  constructor() {
    this.stations = [];
  }

  /**
   * @param {number} cycles                 - How many rotation "cycles"
   * @param {Array}  preassigned            - Preassigned assignments, [{ station, person }, ...]
   * @param {Array}  sonderAssignments      - Sonder array, [{ person, job }, ...]
   * @returns {{
   *   sonderRotation: Object,              // person -> job
   *   highPriorityRotation: Object,        // station -> person
   *   dailyRotations: Array<Object>,       // [{ station -> person }, ...] for each cycle
   *   date: string
   * }}
   */
  async generateDailyRotation(specialAssignments = [], preassigned, cycles) {
    try {
      // 1) Initialization of stations
      if (!this.stations || this.stations.length === 0) {
        await this.initialize();
      }
      const activeStations = this.stations.filter((s) => s.status === true);
      if (activeStations.length === 0) {
        return {
          specialRotation: {},
          highPriorityRotation: {},
          dailyRotations: [],
          date: new Date().toISOString().split('T')[0],
        };
      }

      // 2) Initialization of queues
      const existingQueues = await RotationQueueModel.find();
      if (!existingQueues || existingQueues.length === 0) {
        await this.initializeQueue();
      }

      // We load the queues
      this.rotationQueues = new Map();
      for (const station of activeStations) {
        const rotationQueue = await RotationQueueModel.findOne({
          station: station.name,
        }).populate('queue');
        this.rotationQueues.set(
          station.name,
          rotationQueue?.queue.slice() || []
        );
      }

      // 3) Preparation of results
      const dailyRotations = []; // Array of daily rotations
      const highPriorityRotation = new Map(); //Map(station -> worker)
      const specialRotation = new Map(); // Object (worker -> job)
      const fixedAssignments = {}; // station -> worker
      const specialWorkers = new Set(); // Set of people assigned to Special

      // ----------------------------------------------------------------
      //   (A) Sonder
      // ----------------------------------------------------------------
      // For example, in `sonderAssignments = [{ person: "Vasya", job: "Special task" }, ...]`
      for (const { worker, job } of specialAssignments) {
        // We form an object (person -> job)
        specialRotation.set(worker, job);
        // Add to the set to exclude this person from HighPriority and Daily
        specialWorkers.add(worker);
      }

      // ----------------------------------------------------------------
      //   (B) High Priority (priority >= 2)
      // ----------------------------------------------------------------
      // 1. preassigned (excluding "special", since we already handled it)
      for (const assignment of preassigned) {
        const { station: stationName, worker: workerName } = assignment;
        const station = activeStations.find((s) => s.name === stationName);
        if (!station) continue;

        const queue = this.rotationQueues.get(station.name) || [];
        let found = queue.find((p) => p.name === workerName);
        if (!found) {
          found = await WorkerModel.findOne({ name: workerName });
          if (found) {
            queue.push(found);
          }
        }
        if (found) {
          highPriorityRotation.set(stationName, found.name);
          fixedAssignments[stationName] = found.name;
        }
      }

      // 2. Assign all stations with priority >= 2
      for (const station of activeStations.filter((s) => s.priority >= 2)) {
        if (fixedAssignments[station.name]) continue;

        const queue = this.rotationQueues.get(station.name);
        if (!queue || queue.length === 0) continue;

        let assigned = false;
        // a) try by group
        for (const worker of queue) {
          if (specialWorkers.has(worker.name)) continue;

          const stationInfo = worker.stations.find(
            (s) => s.name === station.name
          );
          const stationGroup = station.group || null;
          const workerGroup = worker.group || null;

          if (
            worker.status &&
            stationInfo?.isActive &&
            !Object.values(fixedAssignments).includes(worker.name) &&
            stationGroup === workerGroup
          ) {
            highPriorityRotation.set(station.name, worker.name);
            fixedAssignments[station.name] = worker.name;
            assigned = true;
            break;
          }
        }

        // b) if not found by group, assign any available worker
        if (!assigned) {
          for (const worker of queue) {
            if (specialWorkers.has(worker.name)) continue;
            const stationInfo = worker.stations.find(
              (s) => s.name === station.name
            );
            if (
              worker.status &&
              stationInfo?.isActive &&
              !Object.values(fixedAssignments).includes(worker.name)
            ) {
              highPriorityRotation.set(station.name, worker.name);
              fixedAssignments[station.name] = worker.name;
              break;
            }
          }
        }
      }

      // ----------------------------------------------------------------
      //   (C) Regular (daily) rotation
      // ----------------------------------------------------------------
    } catch (error) {}
  }
}
