const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ConfirmedRotation = require('../models/confirmedrotation-model');
const StationModel = require('../models/station-model');

class RotationPlanService {
  constructor() {
    // Cached list of station definitions
    this.stations = [];
  }

  /**
   * Generates rotation data for preview or JSON response.
   * @param {Array<{worker: string, job: string}>} specialAssignments
   * @param {Array<{station: string, worker: string}>} preassigned
   * @param {number} cycles                number of rotation cycles
   * @param {string} costCenter            cost center identifier
   * @param {string} shift                 shift identifier
   * @param {string} plant                 plant identifier
   * @returns {Promise<Object>}            rotation data structure
   */
  async generateRotationData(
    specialAssignments = [],
    preassigned = [],
    cycles,
    costCenter,
    shift,
    plant
  ) {
    // (1) Load station definitions if not already loaded
    let activeStations;
    try {
      if (!this.stations || this.stations.length === 0) {
        await this.initialize(costCenter, shift, plant);
      }
      // Keep only active stations
      activeStations = this.stations.filter((s) => s.status === true);

      // If no stations are active, return empty result
      if (!activeStations.length) {
        return {
          specialRotation: {},
          highPriorityRotation: {},
          cycleRotations: [],
          date: new Date().toISOString().split('T')[0],
        };
      }
    } catch (error) {
      console.error('Error loading stations:', error);
      throw new Error('Station initialization failed');
    }

    // Fetch all active workers for the given costCenter/shift/plant
    let availableWorkers = [];
    try {
      let availableWorkersFromDB = await WorkerModel.find({
        costCenter,
        shift,
        plant,
        status: true,
      });

      const hasWorkerName = new Set(
        [...preassigned, ...specialAssignments].map(({ worker }) => worker)
      );
      const hasStationName = new Set(
        [...activeStations]
          .filter((stn) => stn.priority > 1)
          .map((stn) => stn.name)
      );

      availableWorkersFromDB.forEach((obj) => {
        if (
          obj.stations.length === 1 &&
          !hasWorkerName.has(obj.name) &&
          !hasStationName.has(obj.stations[0].name)
        ) {
          preassigned.push({ worker: obj.name, station: obj.stations[0].name });
        } else {
          availableWorkers.push(obj);
        }
      });
    } catch (error) {
      console.error('Error fetch all active workers:', error.message);
      throw new Error('Failed to fetch all active workers');
    }

    // (2) load queues and
    try {
      await this.loadRotationQueues(activeStations, costCenter, shift, plant);
    } catch (err) {
      console.error('Error initializing/loading rotation queues:', err.message);
      throw new Error('Failed to initialize rotation queues');
    }

    // Auto-preassigning single-station workers

    const workerSchedules = {};
    const removedStations = new Set();

    // workers who are "schedulable": have at least 1 active skill and fewer skills than cycles
    const schedulable = availableWorkers.filter((w) => {
      const skills = w.stations.filter((s) => s.isActive).map((s) => s.name);
      return skills.length > 0 && skills.length < cycles;
    });

    // per-worker skill set (to check competency fast)
    const skillSetByWorker = new Map();
    availableWorkers.forEach((w) => {
      const activeSkills = w.stations
        .filter((s) => s.isActive)
        .map((s) => s.name);
      skillSetByWorker.set(w.name, new Set(activeSkills));
    });

    // collect all stations from schedulable workers (used later as a mask)
    schedulable.forEach((w) => {
      const skills = w.stations.filter((s) => s.isActive).map((s) => s.name);
      skills.forEach((st) => removedStations.add(st));
    });

    const hasStationName = new Set(
      activeStations.filter((stn) => stn.priority > 1).map((stn) => stn.name)
    );
    const hasPreasinedStations = new Set(
      preassigned.map(({ station }) => station)
    );

    // 1) allowed stations per worker
    const skillsByWorker = new Map();
    for (const w of schedulable) {
      const skills = w.stations
        .filter(
          (s) =>
            s.isActive &&
            !hasStationName.has(s.name) &&
            !hasPreasinedStations.has(s.name) &&
            removedStations.has(s.name)
        )
        .map((s) => s.name);
      if (skills.length > 0) skillsByWorker.set(w.name, skills);
    }

    // 2) round-robin assignment per cycle without same-station clashes in a round,
    //    and only assign stations the worker is competent for
    const names = Array.from(skillsByWorker.keys());
    for (const name of names) {
      workerSchedules[name] = Array.from({ length: cycles }, () => '');
    }

    for (let c = 0; c < cycles; c++) {
      const used = new Set(); // stations already taken in this cycle

      names.forEach((name, i) => {
        const skills = skillsByWorker.get(name);
        const skillSet = skillSetByWorker.get(name) || new Set();
        let chosen;

        // pick the first not-yet-used station from the worker's skills
        for (let t = 0; t < skills.length; t++) {
          const candidate = skills[(i + c + t) % skills.length];
          if (!used.has(candidate) && skillSet.has(candidate)) {
            chosen = candidate;
            break;
          }
        }

        // optional fallback: if none found, try base offset (still must be in skills and not used)
        if (!chosen) {
          const candidate = skills[(i + c) % skills.length];
          if (!used.has(candidate) && skillSet.has(candidate)) {
            chosen = candidate;
          }
        }

        // assign only if a suitable option exists
        if (chosen) {
          workerSchedules[name][c] = chosen;
          used.add(chosen);
        }
        // if no suitable option — keep empty string (no competency/slot available)
      });
    }

    // 3) remove scheduled workers from availableWorkers
    const scheduledNames = new Set(names);
    availableWorkers = availableWorkers.filter(
      (x) => !scheduledNames.has(x.name)
    );

    // === Check available workers for priority stations ===
    try {
      const namesPre = new Set(
        [...preassigned, ...specialAssignments].map(({ worker }) => worker)
      );
      const preassignedStations = new Set(
        preassigned.map(({ station }) => station)
      );

      let pool = availableWorkers.filter((obj) => !namesPre.has(obj.name));

      const cycleStations = activeStations
        .filter(
          (stn) =>
            stn.priority > 1 &&
            stn.status &&
            !preassignedStations.has(stn.name) &&
            !removedStations.has(stn.name)
        )
        .sort((a, b) => {
          const countA = pool.filter((w) =>
            w.stations.some((s) => s.name === a.name && s.isActive)
          ).length;
          const countB = pool.filter((w) =>
            w.stations.some((s) => s.name === b.name && s.isActive)
          ).length;
          return countA - countB;
        });

      for (const station of cycleStations) {
        const idx = pool.findIndex((worker) =>
          worker.stations.some((s) => s.name === station.name && s.isActive)
        );

        if (idx === -1) {
          throw new Error(
            `Nicht genügend Mitarbeitende für Station: "${station.name}"`
          );
        }

        pool.splice(idx, 1);
      }
    } catch (err) {
      console.error(
        `Fehler bei der Überprüfung der Priority-Stationen: ${err.message}`
      );
      throw new Error(err.message);
    }

    try {
      // Initialize result containers
      const specialRotation = new Map();
      const highPriorityRotation = new Map();
      const cycleRotations = [];
      const fixedAssignments = {};
      const specialWorkers = new Set();

      // (A) Process special assignments ("Sonder")
      for (const { worker: workerName, job } of specialAssignments) {
        specialRotation.set(workerName, { worker: workerName, job });
        specialWorkers.add(workerName);
      }

      // (B) High-priority assignments (stations priority >= 2)
      // 1) Pre-assigned overrides
      for (const { station: stationName, worker: workerName } of preassigned) {
        const station = activeStations.find((s) => s.name === stationName);
        if (!station) continue;
        const queue = this.rotationQueues.get(station.name) || [];
        let found = queue.find((p) => p.name === workerName);
        if (!found) {
          found = await WorkerModel.findOne({ name: workerName });
          if (found) queue.push(found);
        }
        if (found) {
          highPriorityRotation.set(stationName, found);
          fixedAssignments[stationName] = found.name;
        }
      }

      // 2) Fill remaining high-priority stations by matching group or any available
      const priorityStations = activeStations
        .filter(({ priority, status }) => priority >= 2 && status)
        .map((stn) => {
          const queue = this.rotationQueues.get(stn.name) || [];
          const availableCount = queue.filter((w) => w.status).length;
          return { ...stn, availableCount };
        })
        .sort(
          (a, b) =>
            a.availableCount - b.availableCount || b.priority - a.priority
        );
      for (const station of priorityStations) {
        if (fixedAssignments[station.name]) continue;
        const queue = this.rotationQueues.get(station.name) || [];
        let assigned = false;
        // Try matching by worker.group === station.group
        for (const worker of queue) {
          if (specialWorkers.has(worker.name)) continue;
          const stationInfo = worker.stations.find(
            (s) => s.name === station.name
          );

          const baseCond =
            worker.status &&
            stationInfo?.isActive &&
            !Object.values(fixedAssignments).includes(worker.name);

          if (station.priority === 3 && baseCond) {
            highPriorityRotation.set(station.name, worker);
            fixedAssignments[station.name] = worker.name;
            assigned = true;
            break;
          } else if (baseCond && worker.group === station.group) {
            highPriorityRotation.set(station.name, worker);
            fixedAssignments[station.name] = worker.name;
            assigned = true;
            break;
          }
        }
        // Fallback: assign first available
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
              highPriorityRotation.set(station.name, worker);
              fixedAssignments[station.name] = worker.name;
              break;
            }
          }
        }
      }

      // (C) Generate daily cycles for regular rotation
      try {
        const namesPre = new Set(
          [...preassigned, ...specialAssignments].map(({ worker }) => worker)
        );
        const preassignedStations = new Set(
          preassigned.map(({ station }) => station)
        );

        let pool = availableWorkers.filter((obj) => !namesPre.has(obj.name));

        const cycleStations = activeStations
          .filter(
            (stn) =>
              stn.priority === 1 &&
              stn.status &&
              !preassignedStations.has(stn.name) &&
              !removedStations.has(stn.name)
          )
          .sort((a, b) => {
            const countA = pool.filter((w) =>
              w.stations.some((s) => s.name === a.name && s.isActive)
            ).length;
            const countB = pool.filter((w) =>
              w.stations.some((s) => s.name === b.name && s.isActive)
            ).length;
            return countA - countB;
          });

        for (const station of cycleStations) {
          const idx = pool.findIndex((worker) =>
            worker.stations.some((s) => s.name === station.name && s.isActive)
          );

          if (idx === -1) {
            throw new Error(
              `Nicht genügend Mitarbeitende für Station: "${station.name}"`
            );
          }

          pool.splice(idx, 1);
        }
      } catch (err) {
        console.error(
          `Fehler bei der Überprüfung der Zyklus-Stationen: ${err.message}`
        );
        throw new Error(err.message);
      }

      for (let cycle = 0; cycle < cycles; cycle++) {
        const dailyRotation = {};
        // Keep track of already assigned names to avoid duplicates
        const assignedWorkers = new Set([
          ...Object.values(fixedAssignments),
          ...specialWorkers,
        ]);

        // 0) Pre-fill schedule for workers whose number of skills is less than cycles
        for (const [workerName, schedule] of Object.entries(workerSchedules)) {
          if (assignedWorkers.has(workerName)) continue;
          const stationName = schedule[cycle];
          const queue = this.rotationQueues.get(stationName) || [];
          const idx = queue.findIndex((p) => p.name === workerName);
          if (idx !== -1) {
            dailyRotation[stationName] = queue[idx];
            assignedWorkers.add(workerName);
            queue.push(queue.splice(idx, 1)[0]);
          }
        }

        for (const station of activeStations) {
          if (dailyRotation.hasOwnProperty(station.name)) continue;
          if (station.priority >= 2) continue;
          const queue = this.rotationQueues.get(station.name) || [];
          if (queue.length === 0) continue;

          let assigned = false;
          // 1) Use fixed assignment if present
          if (fixedAssignments[station.name]) {
            const name = fixedAssignments[station.name];
            const idx = queue.findIndex((p) => p.name === name);
            if (idx !== -1) {
              dailyRotation[station.name] = queue[idx];
              assignedWorkers.add(name);
              // rotate queue entry to the back
              queue.push(queue.splice(idx, 1)[0]);
              assigned = true;
            }
          }
          // 2) Try by group
          if (!assigned) {
            for (let i = 0; i < queue.length; i++) {
              const worker = queue[i];
              if (specialWorkers.has(worker.name)) continue;
              const stationInfo = worker.stations.find(
                (s) => s.name === station.name
              );
              if (
                worker.status &&
                stationInfo?.isActive &&
                !assignedWorkers.has(worker.name) &&
                worker.group === station.group
              ) {
                dailyRotation[station.name] = worker;
                assignedWorkers.add(worker.name);
                queue.push(queue.splice(i, 1)[0]);
                assigned = true;
                break;
              }
            }
          }
          // 3) Fallback: avoid repeating from previous cycle if possible
          if (!assigned) {
            const prev = cycle > 0 ? cycleRotations[cycle - 1] : {};
            for (let i = 0; i < queue.length; i++) {
              const worker = queue[i];
              if (specialWorkers.has(worker.name)) continue;
              const stationInfo = worker.stations.find(
                (s) => s.name === station.name
              );
              if (
                worker.status &&
                stationInfo?.isActive &&
                !assignedWorkers.has(worker.name) &&
                prev[station.name]?.name !== worker.name
              ) {
                dailyRotation[station.name] = worker;
                assignedWorkers.add(worker.name);
                queue.push(queue.splice(i, 1)[0]);
                assigned = true;
                break;
              }
            }
          }

          // if no alternative worker is available, allow repeating the previous assignment for this station
          if (!assigned) {
            for (const worker of queue) {
              const stationInfo = worker.stations.find(
                (s) => s.name === station.name
              );
              if (
                worker.status &&
                stationInfo?.isActive &&
                !assignedWorkers.has(worker.name)
              ) {
                dailyRotation[station.name] = worker;
                assignedWorkers.add(worker.name);
                assigned = true;
                break;
              }
            }
          }
        }
        // Resolve any duplicates within the same day by swapping
        const counts = {};
        Object.values(dailyRotation).forEach(
          (w) => (counts[w.name] = (counts[w.name] || 0) + 1)
        );
        for (const [workerName, cnt] of Object.entries(counts)) {
          if (cnt > 1) {
            // find stations with duplicate
            const stations = Object.entries(dailyRotation)
              .filter(([_, w]) => w.name === workerName)
              .map(([st]) => st);

            // swap second occurrence with a unique one
            for (let i = 1; i < stations.length; i++) {
              const dupSt = stations[i];
              const other = Object.entries(dailyRotation).find(
                ([st, w]) => counts[w.name] === 1 && st !== dupSt
              );
              if (!other) break;
              const [otherSt, otherW] = other;
              dailyRotation[dupSt] = otherW;
              dailyRotation[otherSt] = this.rotationQueues
                .get(otherSt)
                .find((p) => p.name === workerName);
              break;
            }
          }
        }
        cycleRotations.push(dailyRotation);
      }

      // (4) Persist updated queue order back to DB
      for (const [stationName, queue] of this.rotationQueues) {
        await RotationQueueModel.findOneAndUpdate(
          { station: stationName, costCenter, shift, plant },
          {
            queue: queue.map((p) => ({
              workerId: p._id,
              name: p.name,
              group: p.group,
              role: p.role,
              costCenter: p.costCenter,
              shift: p.shift,
              plant: p.plant,
            })),
          }
        );
      }

      // (5) Assemble final array of all workers for response
      const allWorkers = await WorkerModel.find({ costCenter, shift, plant });

      // Return full rotation data
      return {
        specialRotation: Object.fromEntries(specialRotation),
        highPriorityRotation: Object.fromEntries(highPriorityRotation),
        cycleRotations,
        allWorkers,
        date: new Date().toISOString().split('T')[0],
      };
    } catch (error) {
      console.error('Error generating rotation data:', error);
      throw new Error(error || 'Error generating rotation data');
    }
  }

  async loadRotationQueues(activeStations, costCenter, shift, plant) {
    //  Ensure each active station has a rotation queue document
    for (const station of activeStations) {
      let rq = await RotationQueueModel.findOne({
        station: station.name,
        costCenter,
        shift,
        plant,
      });
      if (!rq) {
        // Build queue of eligible workers for this station
        const workers = await WorkerModel.find({
          stations: { $elemMatch: { name: station.name, isActive: true } },
          costCenter,
          shift,
          plant,
        }).sort({ name: 1 });

        // Create new RotationQueue document
        rq = new RotationQueueModel({
          station: station.name,
          queue: workers.map((w) => ({
            workerId: w._id,
            name: w.name.trim(),
            group: w.group,
            costCenter: w.costCenter,
            shift: w.shift,
            plant: w.plant,
          })),
          costCenter,
          shift,
          plant,
        });
        await rq.save();
      }
    }

    // Load and normalize each queue into memory
    this.rotationQueues = new Map();
    for (const station of activeStations) {
      const rotationQueue = await RotationQueueModel.findOne({
        station: station.name,
        costCenter,
        shift,
        plant,
      }).populate(
        'queue.workerId',
        '_id name costCenter shift plant group status stations'
      );

      const queue = (rotationQueue?.queue || [])
        .filter((item) => item.workerId) // drop entries missing workerId
        .map((item) => {
          // map to worker objects
          const w = item.workerId;
          return {
            _id: w._id,
            name: w.name,
            group: w.group,
            costCenter: w.costCenter,
            shift: w.shift,
            plant: w.plant,
            status: w.status,
            stations: w.stations,
          };
        });
      this.rotationQueues.set(station.name, queue);
    }
  }

  /**
   * Loads station definitions from database.
   */
  async initialize(costCenter, shift, plant) {
    const stations = await StationModel.find({ costCenter, shift, plant }).sort(
      {
        priority: -1,
      }
    );
    if (!stations.length) throw new Error('No stations found for costCenter');
    this.stations = stations.map((s) => ({
      name: s.name,
      priority: s.priority,
      group: s.group,
      status: s.status,
    }));
  }

  async initializeQueue(costCenter, shift, plant) {
    if (!this.stations || this.stations.length === 0) {
      throw new Error(
        'Stations list is empty. Please initialize stations first.'
      );
    }

    for (const station of this.stations) {
      const stationName = station.name;

      // Get a list of all workers who can work at this station
      const workers = await WorkerModel.find({
        stations: { $elemMatch: { name: stationName, isActive: true } },
      }).sort({ name: 1 }); // Sort workers by name (alphabetically)
      // Create a new queue or update existing one
      let rotationQueue = await RotationQueueModel.findOne({
        station: stationName,
        costCenter,
        shift,
        plant,
      });

      if (!rotationQueue) {
        rotationQueue = new RotationQueueModel({
          station: stationName,
          queue: [],
          costCenter,
          shift,
          plant,
        });
      }

      // Form a queue of workers based on their IDs
      rotationQueue.queue = workers.map((worker) => ({
        workerId: worker._id,
        name: worker.name.trim(),
        group: worker.group,
        costCenter: worker.costCenter,
        shift: worker.shift,
        plant: worker.plant,
      }));

      // Save the queue in the database
      await rotationQueue.save();
    }
  }

  async confirmRotation(
    specialRotation = null,
    highPriorityRotation,
    cycleRotations,
    allWorkers,
    costCenter,
    shift,
    plant
  ) {
    if (!highPriorityRotation || !cycleRotations) {
      throw new Error(
        'Incorrect data: High-priority rotation or daily rotations missing'
      );
    }

    try {
      const confirmedRotation = new ConfirmedRotation({
        costCenter,
        shift,
        plant,
        rotation: {
          specialRotation: { ...specialRotation },
          highPriorityRotation: { ...highPriorityRotation },
          cycleRotations: cycleRotations.map((rotation) => ({ ...rotation })),
          allWorkers,
        },
      });

      await confirmedRotation.save();

      // Queue update
      const updateQueue = async (station, workerName) => {
        const rotationQueue = await RotationQueueModel.findOne({
          station,
          costCenter,
          shift,
          plant,
        });
        if (!rotationQueue || rotationQueue.queue.length === 0) {
          return;
        }
        const worker = await WorkerModel.findOne({ name: workerName });
        if (!worker) {
          return;
        }

        const index = rotationQueue.queue.findIndex(
          (item) => item.workerId.toString() === worker._id.toString()
        );

        if (index !== -1) {
          const [removed] = rotationQueue.queue.splice(index, 1);
          rotationQueue.queue.push(removed);
          await rotationQueue.save();
        } else {
          console.error(
            `Workers ${workerName} is missing in the queue for station ${station}.`
          );
        }
      };

      for (const [station, workerName] of Object.entries(specialRotation)) {
        await updateQueue(station, workerName);
      }

      for (const [station, workerName] of Object.entries(
        highPriorityRotation
      )) {
        await updateQueue(station, workerName);
      }

      for (const rotation of cycleRotations) {
        for (const [station, workerName] of Object.entries(rotation)) {
          await updateQueue(station, workerName);
        }
      }

      this.rotationQueues = null; // Reset local queue

      return { confirmedRotation };
    } catch (error) {
      console.error('Error confirming rotation:', error);
      throw new Error('Error confirming rotation');
    }
  }
}
module.exports = RotationPlanService;
