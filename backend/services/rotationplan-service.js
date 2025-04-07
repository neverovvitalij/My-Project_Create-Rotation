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
   *   cycleRotations: Array<Object>,       // [{ station -> person }, ...] for each cycle
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
        }).populate('queue');
        this.rotationQueues.set(
          station.name,
          rotationQueue?.queue.slice() || []
        );
      }

      // 3) Preparation of results
      const cycleRotations = []; // Array of daily rotations
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
      for (let cycle = 0; cycle < cycles; cycle++) {
        const dailyRotation = {};
        // Who is already "busy": HighPriority + Special
        const assignedWorkers = new Set([
          ...Object.values(fixedAssignments),
          ...specialWorkers,
        ]);

        for (const station of activeStations) {
          if (station.priority >= 2) {
            // already distributed as highPriority
            continue;
          }
          const queue = this.rotationQueues.get(station.name) || [];
          if (queue.length === 0) continue;

          let assigned = false;
          // If there is a fixed worker, we take them
          if (fixedAssignments[station.name]) {
            const workerName = fixedAssignments[station.name];
            const idx = queue.findIndex((p) => p.name === workerName);
            if (idx !== -1) {
              const worker = queue[idx];
              dailyRotation[station.name] = worker.name;
              assignedWorkers.add(worker.name);
              // move them to the end
              queue.push(queue.splice(idx, 1)[0]);
              assigned = true;
            }
          }

          // Otherwise look for an available worker
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
                !assignedWorkers.has(worker.name)
              ) {
                dailyRotation[station.name] = worker.name;
                assignedWorkers.add(worker.name);
                queue.push(queue.splice(i, 1)[0]);
                assigned = true;
                break;
              }
            }
          }
        }
        cycleRotations.push(dailyRotation);
      }

      // 4) Save updated queues in DB
      for (const [stationName, queue] of this.rotationQueues.entries()) {
        await RotationQueueModel.findOneAndUpdate(
          { station: stationName },
          { queue: queue.map((p) => p._id) }
        );
      }

      // 5) Return the result
      return {
        // Object: { "Ivanov": "Special task", ... }
        specialRotation: Object.fromEntries(specialRotation),
        // Convert Map -> Object
        highPriorityRotation: Object.fromEntries(highPriorityRotation),
        // Array: [ { station1: person1, station2: person2, ... }, ... ]
        cycleRotations,
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
      rotationQueue.queue = workers.map((worker) => worker._id);

      // Save the queue in the database
      await rotationQueue.save();
    }
  }

  async confirmRotation(
    specialRotation = null,
    highPriorityRotation,
    cycleRotations
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
        },
      });

      await confirmedRotation.save();
      const filePath = await this.saveRotationToExcel(
        specialRotation,
        highPriorityRotation,
        cycleRotations
      );

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
          (id) => id.toString() === worker._id.toString()
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
      return { confirmedRotation, filePath };
    } catch (error) {
      console.error('Error confirming rotation:', error);
      throw new Error('Error confirming rotation');
    }
  }

  async saveRotationToExcel(
    specialRotation,
    highPriorityRotation,
    cycleRotations
  ) {
    try {
      // == (1) Form the filename ==
      const currentDate = new Date().toISOString().split('T')[0];
      const fileName = `rotationsplan_${currentDate}_${Date.now()}.xlsx`;
      const fileNameParts = fileName.split('_');
      const dateFromFile = fileNameParts[1];

      // == (2) Create workbook and sheet ==
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Rotationplan');

      // == (3) Thin border style ==
      const borderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // == (4) Sheet parameters ==
      const numCycles = cycleRotations.length;
      const leftNumCycles = Math.min(numCycles, 5);
      const leftBlockColumns = 1 + leftNumCycles;
      const gapColumns = 1;
      const rightBlockColumns = 2;
      const totalColumns = leftBlockColumns + gapColumns + rightBlockColumns;
      const rightBlockStart = leftBlockColumns + gapColumns + 1;

      // == (5) First row (overall header) ==
      worksheet.mergeCells(1, 1, 1, totalColumns - 1);
      const headerCellTitle = worksheet.getCell(1, 1);
      headerCellTitle.value = 'Rotationsplan 395.5 A-Schicht Halle 4.0';
      headerCellTitle.font = { bold: true, size: 16 };
      headerCellTitle.alignment = { horizontal: 'left', vertical: 'middle' };
      headerCellTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };

      const headerCellDate = worksheet.getCell(1, totalColumns);
      headerCellDate.value = dateFromFile;
      headerCellDate.font = { bold: true, size: 14 };
      headerCellDate.alignment = { horizontal: 'right', vertical: 'middle' };
      headerCellDate.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' },
      };

      worksheet.getRow(1).height = 30;
      worksheet.getRow(1).eachCell((cell) => {
        cell.border = {
          ...cell.border,
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
        };
      });

      // ===============================
      //     UPPER BLOCK: HP + Special
      // ===============================
      let rowIndex = 2; // start from 2nd row

      // -- (A) Header (rowIndex)
      const topBlockHeaderRow = worksheet.getRow(rowIndex);
      topBlockHeaderRow.getCell(1).value = 'Mitarbeiter';
      topBlockHeaderRow.getCell(2).value = 'Station';
      topBlockHeaderRow.getCell(1).font = { bold: true };
      topBlockHeaderRow.getCell(2).font = { bold: true };

      topBlockHeaderRow.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFADD8E6' },
      };
      topBlockHeaderRow.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFADD8E6' },
      };
      topBlockHeaderRow.getCell(1).border = borderStyle;
      topBlockHeaderRow.getCell(2).border = borderStyle;

      // other columns = borders
      for (let col = 3; col < totalColumns; col++) {
        topBlockHeaderRow.getCell(col).border = borderStyle;
      }

      // Header "Sondertätigkeiten" (right block, merge cells)
      worksheet.mergeCells(rowIndex, rightBlockStart, rowIndex, totalColumns);
      const rightHeaderCell = worksheet.getCell(rowIndex, rightBlockStart);
      rightHeaderCell.value = 'Sondertätigkeiten';
      rightHeaderCell.font = { bold: true, size: 14 };
      rightHeaderCell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      rightHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF99CCFF' },
      };
      rightHeaderCell.border = borderStyle;
      topBlockHeaderRow.commit();

      rowIndex++; // move to the next row for data

      // -- (B) Data
      // Convert our objects into arrays of pairs to render a "zebra"
      const hpEntries = Object.entries(highPriorityRotation || {});
      const srEntries = Object.entries(specialRotation || {});

      // Determine max rows
      const maxLen = Math.max(hpEntries.length, srEntries.length);

      for (let i = 0; i < maxLen; i++) {
        const row = worksheet.getRow(rowIndex);

        // 1) High Priority (left part, columns 1 and 2)
        if (i < hpEntries.length) {
          const [station, worker] = hpEntries[i];
          row.getCell(1).value = worker;
          row.getCell(2).value = station;

          // "zebra":
          row.getCell(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4D4D' },
          };
          if (i % 2 === 1) {
            row.getCell(2).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD3D3D3' },
            };
          }
        } else {
          row.getCell(1).value = '';
          row.getCell(2).value = '';
        }

        // 2) Sonder (right part, columns rightBlockStart, rightBlockStart+1)
        if (i < srEntries.length) {
          const [workerName, job] = srEntries[i];
          row.getCell(rightBlockStart).value = workerName;
          row.getCell(rightBlockStart + 1).value = job;

          // "zebra" for the right block (similar approach with i % 2)
          row.getCell(rightBlockStart).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4D4D' },
          };
          if (i % 2 === 1) {
            row.getCell(rightBlockStart + 1).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD3D3D3' },
            };
          }
        } else {
          row.getCell(rightBlockStart).value = '';
          row.getCell(rightBlockStart + 1).value = '';
        }

        // Borders for the entire row
        for (let col = 1; col <= totalColumns; col++) {
          row.getCell(col).border = borderStyle;
        }
        row.commit();
        rowIndex++;
      }

      // Empty separator row
      worksheet.addRow([]);
      rowIndex++;

      // ===============================
      //     LOWER BLOCK: PIVOT
      // ===============================
      const pivotHeaderLeft = ['Mitarbeiter'];
      for (let i = 1; i <= leftNumCycles; i++) {
        pivotHeaderLeft.push(`Runde ${i}`);
      }
      const pivotHeader = pivotHeaderLeft.concat(['', '', '']);
      const pivotHeaderRow = worksheet.addRow(pivotHeader);

      for (let col = 1; col <= leftBlockColumns; col++) {
        const cell = pivotHeaderRow.getCell(col);
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF90EE90' },
        };
        cell.border = borderStyle;
      }
      pivotHeaderRow.getCell(leftBlockColumns + 1).border = borderStyle;
      for (let col = leftBlockColumns + 2; col <= totalColumns; col++) {
        pivotHeaderRow.getCell(col).border = borderStyle;
      }
      pivotHeaderRow.commit();
      rowIndex = worksheet.lastRow.number + 1;

      // Collect people for the Pivot, excluding HP
      const hpWorkersSet = new Set(Object.values(highPriorityRotation || {}));
      const pivotWorkersSet = new Set();
      cycleRotations.forEach((rotation) => {
        Object.values(rotation).forEach((p) => {
          if (p && !hpWorkersSet.has(p)) {
            pivotWorkersSet.add(p);
          }
        });
      });
      const pivotWorkers = Array.from(pivotWorkersSet).sort();

      let pivotRowCount = 0;
      pivotWorkers.forEach((worker) => {
        pivotRowCount++;
        const rowData = [worker];
        for (let i = 0; i < leftNumCycles; i++) {
          const rotation = cycleRotations[i] || {};
          const stations = [];
          for (const [st, assignedWorkers] of Object.entries(rotation)) {
            if (assignedWorkers === worker) {
              stations.push(st);
            }
          }
          rowData.push(stations.join(', '));
        }
        rowData.push('', '');
        worksheet.addRow(rowData);

        const dataRow = worksheet.getRow(worksheet.lastRow.number);
        // pivot zebra
        dataRow.getCell(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF4D4D' },
        };
        if (pivotRowCount % 2 === 1) {
          for (let col = 2; col <= leftBlockColumns; col++) {
            dataRow.getCell(col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD3D3D3' },
            };
          }
        }

        //borders
        for (let col = 1; col <= totalColumns; col++) {
          dataRow.getCell(col).border = borderStyle;
        }
        dataRow.commit();
      });

      // == (6) Column widths ==
      worksheet.getColumn(1).width = 16;
      worksheet.getColumn(2).width = 8;
      worksheet.getColumn(leftBlockColumns + 1).width = 3;
      for (let i = rightBlockStart; i <= totalColumns; i++) {
        worksheet.getColumn(i).width = 20;
      }
      worksheet.getColumn(1).width = 22;
      for (let i = 2; i <= leftBlockColumns; i++) {
        worksheet.getColumn(i).width = 8;
      }

      // == (7) Thick border around everything
      const finalLastRowForBorder = worksheet.lastRow.number;
      for (let r = 1; r <= finalLastRowForBorder; r++) {
        const row = worksheet.getRow(r);
        for (let c = 1; c <= totalColumns; c++) {
          const cell = row.getCell(c);
          if (r === 1) {
            cell.border = {
              ...cell.border,
              top: { style: 'thick', color: { argb: 'FF000000' } },
            };
          }
          if (r === finalLastRowForBorder) {
            cell.border = {
              ...cell.border,
              bottom: { style: 'thick', color: { argb: 'FF000000' } },
            };
          }
          if (c === 1) {
            cell.border = {
              ...cell.border,
              left: { style: 'thick', color: { argb: 'FF000000' } },
            };
          }
          if (c === totalColumns) {
            cell.border = {
              ...cell.border,
              right: { style: 'thick', color: { argb: 'FF000000' } },
            };
          }
        }
      }

      // == (8) Save file ==
      const finalFilePath = path.join(
        process.env.FILE_STORAGE_PATH || '/tmp',
        fileName
      );
      await workbook.xlsx.writeFile(finalFilePath);

      return finalFilePath;
    } catch (error) {
      console.error('Error creating Excel file:', error);
      throw new Error('Error creating Excel file');
    }
  }
}

module.exports = RotationPlanService;
