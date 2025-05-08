const ExcelJS = require('exceljs');
const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ConfirmedRotation = require('../models/confirmedrotation-model');
const StationModel = require('../models/station-model');

class RotationPlanService {
  constructor() {
    this.stations = [];
  }

  async generateDailyRotation(
    specialAssignments = [],
    preassigned = [],
    cycles
  ) {
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
          cycleRotations: [],
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
        }).populate(
          'queue.workerId',
          '_id name role costCenter group status stations'
        );

        const queue = (rotationQueue?.queue || []).map((item) => {
          const w = item.workerId;
          return {
            _id: w._id,
            name: w.name,
            group: w.group,
            role: w.role,
            costCenter: w.costCenter,
            status: w.status,
            stations: w.stations,
          };
        });
        this.rotationQueues.set(station.name, queue);
      }

      // 3) Preparation of results
      const cycleRotations = [];
      const highPriorityRotation = new Map();
      const specialRotation = new Map();
      const fixedAssignments = {};
      const specialWorkers = new Set();

      // ----------------------------------------------------------------
      //   (A) Sonder
      // ----------------------------------------------------------------
      // For example, in sonderAssignments = [{ person: "Vasya", job: "Special task" }, ...]
      for (const { worker: workerName, job } of specialAssignments) {
        const workerObj = Array.from(this.rotationQueues.values())
          .flat()
          .find((w) => w.name === workerName);
        if (!workerObj) continue;
        specialRotation.set(workerObj.name, {
          worker: workerObj,
          job,
        });
        specialWorkers.add(workerObj.name);
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
          highPriorityRotation.set(stationName, found);
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
            highPriorityRotation.set(station.name, worker);
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
              highPriorityRotation.set(station.name, worker);
              fixedAssignments[station.name] = worker.name;
              break;
            }
          }
        }
      }

      // ----------------------------------------------------------------
      //   (C) Regular (daily) rotation + duplicate resolution
      // ----------------------------------------------------------------
      for (let cycle = 0; cycle < cycles; cycle++) {
        const dailyRotation = {};
        // who is already busy: HighPriority + Special
        const assignedWorkers = new Set([
          ...Object.values(fixedAssignments),
          ...specialWorkers,
        ]);

        for (const station of activeStations) {
          if (station.priority >= 2) continue;
          const queue = this.rotationQueues.get(station.name) || [];
          if (queue.length === 0) continue;

          let assigned = false;
          // 1) fixed assignments
          if (fixedAssignments[station.name]) {
            const workerName = fixedAssignments[station.name];
            const idx = queue.findIndex((p) => p.name === workerName);
            if (idx !== -1) {
              const worker = queue[idx];
              dailyRotation[station.name] = worker;
              assignedWorkers.add(worker.name);
              queue.push(queue.splice(idx, 1)[0]);
              assigned = true;
            }
          }

          // 2) assignment by group
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

          // 3) fallback search considering previous round
          if (!assigned) {
            const prevRotation = cycle > 0 ? cycleRotations[cycle - 1] : {};
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
                prevRotation[station.name] !== worker.name
              ) {
                dailyRotation[station.name] = worker;
                assignedWorkers.add(worker.name);
                queue.push(queue.splice(i, 1)[0]);
                assigned = true;
                break;
              }
            }
          }
        }

        // 4) Check within the same day for duplicates—and if found, swap them
        const counts = {};
        for (const w of Object.values(dailyRotation)) {
          counts[w] = (counts[w] || 0) + 1;
        }
        for (const [worker, cnt] of Object.entries(counts)) {
          if (cnt > 1) {
            const stations = Object.entries(dailyRotation)
              .filter(([st, w]) => w === worker)
              .map(([st]) => st);
            for (let i = 1; i < stations.length; i++) {
              const dupStation = stations[i];
              const otherEntry = Object.entries(dailyRotation).find(
                ([st, w]) => counts[w] === 1 && st !== dupStation
              );
              if (!otherEntry) break;
              const [otherStation, otherWorker] = otherEntry;
              // swap assignments
              dailyRotation[dupStation] = otherWorker;
              dailyRotation[otherStation] = worker;
              counts[worker]--;
              counts[otherWorker]++;
              break;
            }
          }
        }

        cycleRotations.push(dailyRotation);
      }

      // 4) Save updated queues in DB
      for (const [stationName, queue] of this.rotationQueues.entries()) {
        await RotationQueueModel.findOneAndUpdate(
          { station: stationName },
          {
            queue: queue.map((p) => ({
              workerId: p._id,
              name: p.name,
              group: p.group,
              role: p.role,
              costCenter: p.costCenter,
            })),
          }
        );
      }
      // 5) Return the result
      // 1) Собираем «сырые» данные из всех очередей
      const allWorkersRaw = Array.from(this.rotationQueues.values())
        .flat()
        .map((w) => ({
          id: w._id.toString(), // для уникализации
          name: w.name,
          group: w.group,
          status: w.status,
          costCenter: w.costCenter,
          role: w.role,
        }));

      // 2) Убираем дубликаты по id
      const workersMap = new Map();
      for (const w of allWorkersRaw) {
        if (!workersMap.has(w.id)) {
          workersMap.set(w.id, w);
        }
      }

      // 3) Финальный массив уникальных сотрудников
      const allWorkers = Array.from(workersMap.values());
      return {
        specialRotation: Object.fromEntries(specialRotation),
        highPriorityRotation: Object.fromEntries(highPriorityRotation),
        cycleRotations,
        allWorkers,
        date: new Date().toISOString().split('T')[0],
      };
    } catch (error) {
      console.error('Error creating rotation plan:', error);
      throw new Error('Error creating rotation plan');
    }
  }

  async initialize() {
    const stations = await StationModel.find().sort({ priority: -1 });
    if (!stations || stations.length === 0) {
      throw new Error(
        'Stations list is empty. Please initialize stations first.'
      );
    }
    this.stations = stations.map((station) => ({
      name: station.name,
      priority: station.priority,
      group: station.group || null,
      status: station.status,
    }));
  }

  async initializeQueue() {
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
      });

      if (!rotationQueue) {
        rotationQueue = new RotationQueueModel({
          station: stationName,
          queue: [],
        });
      }

      // Form a queue of workers based on their IDs
      rotationQueue.queue = workers.map((worker) => ({
        workerId: worker._id,
        name: worker.name.trim(),
        group: worker.group,
        role: worker.role,
        costCenter: worker.costCenter,
      }));

      // Save the queue in the database
      await rotationQueue.save();
    }
  }

  async confirmRotation(
    specialRotation = null,
    highPriorityRotation,
    cycleRotations,
    allWorkers
  ) {
    if (!highPriorityRotation || !cycleRotations) {
      throw new Error(
        'Incorrect data: High-priority rotation or daily rotations missing'
      );
    }

    try {
      const confirmedRotation = new ConfirmedRotation({
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
        const rotationQueue = await RotationQueueModel.findOne({ station });
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

  async saveRotationToExcel(
    specialRotation,
    highPriorityRotation,
    cycleRotations,
    allWorkers
  ) {
    console.log(cycleRotations);
    try {
      // == (1) Build the filename ==
      const currentDate = new Date().toISOString().split('T')[0];
      const fileName = `rotationsplan_${currentDate}_${Date.now()}.xlsx`;
      const fileNameParts = fileName.split('_');
      const dateFromFile = fileNameParts[1];

      // == (2) Create the workbook and worksheet ==
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rotationplan');

      // == (3) Define thin border style ==
      const borderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // == (4) Sheet layout parameters ==
      const numCycles = cycleRotations.length;
      const leftNumCycles = Math.min(numCycles, 5);
      const leftCols = 1 + leftNumCycles;
      const gapCols = 1;
      const rightCols = 2;
      const totalCols = leftCols + gapCols + rightCols;
      const rightStart = leftCols + gapCols + 1;

      // == (5) Main header row ==
      worksheet.mergeCells(1, 1, 1, totalCols - 1);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = 'Rotationsplan 395.5 A‑Schicht Halle 4.0';
      titleCell.font = { bold: true, size: 16 };
      titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };

      const dateCell = worksheet.getCell(1, totalCols);
      dateCell.value = dateFromFile;
      dateCell.font = { bold: true, size: 14 };
      dateCell.alignment = { horizontal: 'right', vertical: 'middle' };
      dateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };

      worksheet.getRow(1).height = 30;
      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          ...borderStyle,
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
        };
      });

      // == (6) Top block: High‑Priority + Sonder ==
      let rowIdx = 2;
      const hdr = worksheet.getRow(rowIdx);
      hdr.getCell(1).value = 'Mitarbeiter';
      hdr.getCell(2).value = 'Station';
      [1, 2].forEach((c) => {
        const cell = hdr.getCell(c);
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFADD8E6' },
        };
        cell.border = borderStyle;
      });
      for (let c = 3; c <= totalCols; c++) hdr.getCell(c).border = borderStyle;
      worksheet.mergeCells(rowIdx, rightStart, rowIdx, totalCols);
      const sHdr = worksheet.getCell(rowIdx, rightStart);
      sHdr.value = 'Sondertätigkeiten';
      sHdr.font = { bold: true, size: 14 };
      sHdr.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      sHdr.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFADD8E6' },
      };
      sHdr.border = borderStyle;
      hdr.commit();

      // Populate HP + Special rows
      rowIdx++;
      const hpEntries = Object.entries(highPriorityRotation || {});
      const srEntries = Object.entries(specialRotation || {});
      const topLen = Math.max(hpEntries.length, srEntries.length);
      for (let i = 0; i < topLen; i++) {
        const row = worksheet.getRow(rowIdx);
        if (i < hpEntries.length) {
          const [station, worker] = hpEntries[i];
          row.getCell(1).value = worker;
          row.getCell(2).value = station;
          row.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFADD8E6' },
          };
          if (i % 2) {
            row.getCell(2).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD3D3D3' },
            };
          }
        }
        if (i < srEntries.length) {
          const [workerName, job] = srEntries[i];
          row.getCell(rightStart).value = workerName;
          row.getCell(rightStart + 1).value = job;
          row.getCell(rightStart).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFADD8E6' },
          };
          if (i % 2) {
            row.getCell(rightStart + 1).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD3D3D3' },
            };
          }
        }
        for (let c = 1; c <= totalCols; c++) {
          row.getCell(c).border = borderStyle;
        }
        row.commit();
        rowIdx++;
      }

      // spacer
      worksheet.addRow([]);
      rowIdx++;

      // == (7) Pivot by group, with sub‑headers ==
      const hpSet = new Set(Object.values(highPriorityRotation || {}));
      const pivotSet = new Set();
      cycleRotations.forEach((rot) =>
        Object.values(rot).forEach((n) => {
          if (n && !hpSet.has(n)) pivotSet.add(n.trim());
        })
      );
      const byGroup = {};
      allWorkers.forEach(({ name, group, status }) => {
        if (pivotSet.has(name) && status) {
          byGroup[group] = byGroup[group] || [];
          byGroup[group].push(name.trim());
        }
      });

      Object.entries(byGroup)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([grp, names]) => {
          // group header
          const grRow = worksheet.addRow([`Gruppe ${grp}`]);
          grRow.font = { bold: true };
          grRow.alignment = { horizontal: 'left' };
          worksheet.mergeCells(
            grRow.number,
            1,
            grRow.number,
            leftNumCycles + 1
          );
          grRow.eachCell((c) => (c.border = borderStyle));
          grRow.commit();

          // sub‑header
          const subTitles = [
            'Mitarbeiter',
            ...Array.from(
              { length: leftNumCycles },
              (_, i) => `Runde ${i + 1}`
            ),
          ];
          const subRow = worksheet.addRow(subTitles);
          subRow.eachCell((c) => {
            c.font = { bold: true };
            c.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFCCFFCC' },
            };
            c.border = borderStyle;
          });
          subRow.commit();

          // worker rows
          names.forEach((w, i) => {
            const data = [w];
            for (let c = 0; c < leftNumCycles; c++) {
              const rot = cycleRotations[c] || {};
              const sts = Object.entries(rot)
                .filter(([, x]) => x === w)
                .map(([s]) => s)
                .join(', ');
              data.push(sts);
            }
            const r = worksheet.addRow(data);
            r.getCell(1).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFCCFFCC' },
            };
            if (i % 2) {
              r.eachCell((c, col) => {
                if (col > 1) {
                  c.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' },
                  };
                }
              });
            }
            r.eachCell((c) => (c.border = borderStyle));
            r.commit();
          });

          // spacer
          worksheet.addRow([]);
        });

      // == (8) Abwesend block ==
      const absentList = allWorkers
        .filter((w) => !w.status)
        .map((w) => w.name.trim());
      if (absentList.length) {
        // header
        const hdrRow = worksheet.getRow(rowIdx);
        worksheet.mergeCells(rowIdx, rightStart, rowIdx, totalCols);
        const aHdr = hdrRow.getCell(rightStart);
        aHdr.value = 'Abwesend';
        aHdr.font = { bold: true, size: 14 };
        aHdr.alignment = { horizontal: 'center' };
        aHdr.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFADD8E6' },
        };
        aHdr.border = borderStyle;
        hdrRow.commit();
        rowIdx++;

        // two‑column layout, trim & reset font
        const names = absentList.map((o) => o.trim());
        for (let i = 0; i < names.length; i += 2) {
          const row = worksheet.getRow(rowIdx);
          // left cell
          const leftCell = row.getCell(rightStart);
          leftCell.value = names[i];
          leftCell.font = { bold: false };
          leftCell.border = borderStyle;
          // right cell if exists
          if (names[i + 1]) {
            const rightCell = row.getCell(rightStart + 1);
            rightCell.value = names[i + 1];
            rightCell.font = { bold: false };
            rightCell.border = borderStyle;
          }
          row.commit();
          rowIdx++;
        }
      }

      // == (9) Draw thick outline & set widths ==
      const last = worksheet.lastRow.number;
      for (let r = 1; r <= last; r++) {
        for (let c = 1; c <= totalCols; c++) {
          const cell = worksheet.getCell(r, c);
          const b = { ...borderStyle };
          if (r === 1) b.top = { style: 'thick', color: { argb: 'FF000000' } };
          if (r === last)
            b.bottom = { style: 'thick', color: { argb: 'FF000000' } };
          if (c === 1) b.left = { style: 'thick', color: { argb: 'FF000000' } };
          if (c === totalCols)
            b.right = { style: 'thick', color: { argb: 'FF000000' } };
          cell.border = b;
        }
      }

      worksheet.getColumn(1).width = 22;
      for (let c = 2; c <= leftCols; c++) {
        worksheet.getColumn(c).width = 8;
      }
      worksheet.getColumn(leftCols + 1).width = 3;
      for (let c = rightStart; c <= totalCols; c++) {
        worksheet.getColumn(c).width = 20;
      }

      // == (10) Save ==

      const buffer = await workbook.xlsx.writeBuffer();

      return { buffer, fileName };
    } catch (err) {
      console.error('Error creating Excel file:', err);
      throw new Error('Error creating Excel file');
    }
  }
}
module.exports = RotationPlanService;
