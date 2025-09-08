const ExcelJS = require('exceljs');
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

    // === Check available workers for priority stations ===
    try {
      const hasStationName = new Set(
        [...activeStations]
          .filter((stn) => stn.priority > 1 && stn.status)
          .map((stn) => stn.name)
      );

      const availableWorkersForPriority = availableWorkers.filter((w) =>
        w.stations.some((s) => hasStationName.has(s.name))
      );

      for (const stn of hasStationName) {
        const indx = availableWorkersForPriority.findIndex((worker) =>
          worker.stations.some((s) => s.name === stn)
        );

        if (indx === -1) {
          throw new Error(
            `Stationen mit Priorität 2/3 können nicht abgedeckt werden.`
          );
        }

        availableWorkersForPriority.splice(indx, 1);
      }
    } catch (error) {
      console.error(
        `Fehler bei der Überprüfung der Priority-Stationen: ${error.message}`
      );
      throw new Error(error.message);
    }

    // Auto-preassigning single-station workers

    const workerSchedules = {};
    const removedStations = new Set();
    const schedulable = availableWorkers.filter((w) => {
      const skills = w.stations.filter((s) => s.isActive).map((s) => s.name);
      return skills.length > 0 && skills.length < cycles;
    });

    schedulable.forEach((w) => {
      const skills = w.stations.filter((s) => s.isActive).map((s) => s.name);
      skills.forEach((st) => removedStations.add(st));
    });

    const hasStationName = new Set(
      [...activeStations]
        .filter((stn) => stn.priority > 1)
        .map((stn) => stn.name)
    );

    const hasPreasinedStations = new Set(
      [...preassigned].map(({ station }) => station)
    );

    for (const w of schedulable) {
      const skills = w.stations
        .filter(
          (s) =>
            s.isActive &&
            !hasStationName.has(s.name) &&
            !hasPreasinedStations.has(s.name) &&
            hasPreasinedStations.add(s?.name)
        )
        .map((s) => s.name);
      workerSchedules[w.name] = Array.from(
        { length: cycles },
        (_, i) => skills[i % skills.length]
      );
      availableWorkers = availableWorkers.filter((x) => x.name !== w.name);
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

  async buildExcelBuffer(
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    allWorkers,
    costCenter,
    shift
  ) {
    try {
      // 1) Filename
      const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1');
      const fileName = `rotationsplan_${tomorrowDate}.xlsx`;
      const dateFromFile = fileName.split('_')[1].split('.')[0];

      // 2) Workbook & worksheet
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Rotationplan');

      // 3) Common border style
      const border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      const fillGray = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };
      const fillBlue = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFADD8E6' },
      };

      // 4) Layout
      const numCycles = cycleRotations.length;
      const leftCycles = Math.min(numCycles, 5);
      const leftCols = 1 + leftCycles;
      const gapCols = 1;
      const rightCols = 2;
      const totalCols = leftCols + gapCols + rightCols;
      const rightStart = leftCols + gapCols + 1;

      // 5) Title row
      ws.mergeCells(1, 1, 1, totalCols - 1);
      const titleCell = ws.getCell(1, 1);
      titleCell.value = `Rotationsplan ${costCenter} ${shift}-Schicht`;
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      titleCell.fill = fillGray;

      const dateCell = ws.getCell(1, totalCols);
      dateCell.value = dateFromFile;
      dateCell.font = { bold: true, size: 14 };
      dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
      dateCell.fill = fillGray;

      ws.getRow(1).height = 30;
      ws.getRow(1).eachCell((cell) => {
        cell.border = {
          ...border,
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
        };
      });

      // 6) Left part: groups (unchanged from before)...
      let row = 2;
      const hpNames = new Set(
        Object.values(highPriorityRotation || {}).map((w) =>
          typeof w === 'object' ? w.name : w
        )
      );
      const pivot = new Set();
      cycleRotations.forEach((rot) =>
        Object.values(rot).forEach((w) => {
          const nm = typeof w === 'object' ? w.name : w;
          if (nm && !hpNames.has(nm)) pivot.add(nm);
        })
      );
      const byGroup = {};
      allWorkers.forEach(({ name, group, status }) => {
        if (pivot.has(name) && status)
          (byGroup[group] = byGroup[group] || []).push(name);
      });
      for (const [grp, names] of Object.entries(byGroup).sort((a, b) =>
        a[0].localeCompare(b[0])
      )) {
        // group header
        ws.mergeCells(row, 1, row, leftCols);
        const gcell = ws.getCell(row, 1);
        gcell.value = `Gruppe ${grp}`;
        gcell.font = { bold: true };
        gcell.border = border;
        row++;
        // subheader
        const hdrRow = ws.getRow(row++);
        [
          'Mitarbeiter',
          ...Array.from({ length: leftCycles }, (_, i) => `Runde ${i + 1}`),
        ].forEach((txt, i) => {
          const c = hdrRow.getCell(i + 1);
          c.value = txt;
          c.font = { bold: true };
          c.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFCCFFCC' },
          };
          c.border = border;
        });
        // worker rows
        names.forEach((nm, idx) => {
          const wrow = ws.getRow(row++);
          wrow.getCell(1).value = nm;
          for (let i = 0; i < leftCycles; i++) {
            const rot = cycleRotations[i] || {};
            const sts = Object.entries(rot)
              .filter(([, w]) => ((w && w.name) || w) === nm)
              .map(([st]) => st)
              .join(', ');
            wrow.getCell(i + 2).value = sts;
          }
          wrow.eachCell((cell, col) => {
            cell.border = border;
            if (col === 1)
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFCCFFCC' },
              };
            else if (idx % 2)
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' },
              };
          });
        });
        row++;
      }

      // 7) Right part: High Priority, Sonder, Abwesend all starting at row=2
      // 7.1 High Priority
      const hpEntries = Object.entries(highPriorityRotation || {}).map(
        ([st, w]) => [typeof w === 'object' ? w.name : w, st]
      );
      const hpRow0 = 2;
      // header
      ws.getRow(hpRow0).getCell(rightStart).value = 'Tagesrotation';
      ws.getRow(hpRow0).getCell(rightStart).font = { bold: true };
      ws.getRow(hpRow0).getCell(rightStart).border = border;
      // entries
      hpEntries.forEach(([nm, st], i) => {
        const r = hpRow0 + i + 1;
        const rowHP = ws.getRow(r);
        rowHP.getCell(rightStart).value = nm;
        rowHP.getCell(rightStart + 1).value = st;
        // name cell fill = light blue
        rowHP.getCell(rightStart).fill = fillBlue;
        rowHP.getCell(rightStart).border = border;
        rowHP.getCell(rightStart + 1).border = border;
        if (i % 2) {
          ws.getCell(r, rightStart + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
        }
      });

      // 7.2 Sondertätigkeiten
      const srEntries = Object.entries(specialRotation || {}).map(
        ([nm, spec]) => [nm, typeof spec === 'object' ? spec.job : spec]
      );
      const ztkRow0 = hpRow0 + hpEntries.length + 2; // one blank row
      ws.getRow(ztkRow0).getCell(rightStart).value = 'Sondertätigkeiten';
      ws.getRow(ztkRow0).getCell(rightStart).font = { bold: true };
      ws.getRow(ztkRow0).getCell(rightStart).fill = fillBlue;
      ws.getRow(ztkRow0).getCell(rightStart).border = border;
      srEntries.forEach(([nm, job], i) => {
        const r = ztkRow0 + i + 1;
        const rowZ = ws.getRow(r);
        rowZ.getCell(rightStart).value = nm;
        rowZ.getCell(rightStart + 1).value = job;
        // name cell fill = light blue
        rowZ.getCell(rightStart).fill = fillBlue;
        rowZ.getCell(rightStart).border = border;
        rowZ.getCell(rightStart + 1).border = border;
        if (i % 2) {
          ws.getCell(r, rightStart + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' },
          };
        }
      });

      // 7.3 Abwesend
      const absent = allWorkers.filter((w) => !w.status).map((w) => w.name);
      const absRow0 = ztkRow0 + srEntries.length + 2;
      ws.getRow(absRow0).getCell(rightStart).value = 'Abwesend';
      ws.getRow(absRow0).getCell(rightStart).font = { bold: true };
      ws.getRow(absRow0).getCell(rightStart).fill = fillBlue;
      ws.getRow(absRow0).getCell(rightStart).border = border;
      for (let i = 0; i < absent.length; i += 2) {
        const r = absRow0 + i / 2 + 1;
        const rowA = ws.getRow(r);
        rowA.getCell(rightStart).value = absent[i];
        rowA.getCell(rightStart).fill = titleCell.fill;
        rowA.getCell(rightStart).border = border;
        if (absent[i + 1]) {
          rowA.getCell(rightStart + 1).value = absent[i + 1];
          rowA.getCell(rightStart + 1).border = border;
        }
      }

      // 8) Outline & column widths (unchanged)...
      const last = ws.lastRow.number;
      for (let r0 = 1; r0 <= last; r0++) {
        for (let c0 = 1; c0 <= totalCols; c0++) {
          const b = { ...border };
          if (r0 === 1) b.top = { style: 'thick', color: { argb: 'FF000000' } };
          if (r0 === last)
            b.bottom = { style: 'thick', color: { argb: 'FF000000' } };
          if (c0 === 1)
            b.left = { style: 'thick', color: { argb: 'FF000000' } };
          if (c0 === totalCols)
            b.right = { style: 'thick', color: { argb: 'FF000000' } };
          ws.getCell(r0, c0).border = b;
        }
      }
      ws.getColumn(1).width = 22;
      for (let c = 2; c <= leftCols; c++) ws.getColumn(c).width = 8;
      ws.getColumn(leftCols + 1).width = 3;
      for (let c = rightStart; c <= totalCols; c++) ws.getColumn(c).width = 20;
      ws.columns.forEach((col) => {
        let max = 0;
        col.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.row === 1) return;
          max = Math.max(max, String(cell.value || '').length);
        });
        col.width = Math.max(10, Math.min(max, 20)) + 2;
      });

      // 9) Save
      const buffer = await workbook.xlsx.writeBuffer();
      return { buffer, fileName };
    } catch (err) {
      console.error('Error creating Excel file:', err);
      throw new Error('Error creating Excel file');
    }
  }
}
module.exports = RotationPlanService;
