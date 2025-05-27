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

    // (2) load queues
    try {
      await this.loadRotationQueues(activeStations, costCenter, shift, plant);
    } catch (err) {
      console.error('Error initializing/loading rotation queues:', err);
      throw new Error('Failed to initialize rotation queues');
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
        const workerObj = Array.from(this.rotationQueues.values())
          .flat()
          .find((w) => w.name === workerName);
        if (!workerObj) continue;
        specialRotation.set(workerObj.name, { worker: workerObj, job });
        specialWorkers.add(workerObj.name);
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
      for (const station of activeStations.filter((s) => s.priority >= 2)) {
        if (fixedAssignments[station.name]) continue;
        const queue = this.rotationQueues.get(station.name) || [];
        let assigned = false;
        // Try matching by worker.group === station.group
        for (const worker of queue) {
          if (specialWorkers.has(worker.name)) continue;
          const stationInfo = worker.stations.find(
            (s) => s.name === station.name
          );
          if (
            worker.status &&
            stationInfo?.isActive &&
            !Object.values(fixedAssignments).includes(worker.name) &&
            worker.group === station.group
          ) {
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
            if (worker.status && stationInfo?.isActive) {
              highPriorityRotation.set(station.name, worker);
              fixedAssignments[station.name] = worker.name;
              break;
            }
          }
        }
      }

      // (C) Generate daily cycles for regular rotation
      for (let cycle = 0; cycle < cycles; cycle++) {
        const dailyRotation = {};
        // Keep track of already assigned names to avoid duplicates
        const assignedWorkers = new Set([
          ...Object.values(fixedAssignments),
          ...specialWorkers,
        ]);

        for (const station of activeStations) {
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
      const allWorkersRaw = Array.from(this.rotationQueues.values()).flat();
      const uniqueMap = new Map();
      for (const w of allWorkersRaw) {
        if (!uniqueMap.has(w._id.toString())) {
          uniqueMap.set(w._id.toString(), w);
        }
      }
      const allWorkers = Array.from(uniqueMap.values());

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
      throw new Error('Error generating rotation data');
    }
  }

  async loadRotationQueues(activeStations, costCenter, shift) {
    //  Ensure each active station has a rotation queue document
    for (const station of activeStations) {
      let rq = await RotationQueueModel.findOne({
        station: station.name,
        costCenter,
        shift,
      });
      if (!rq) {
        // Build queue of eligible workers for this station
        const workers = await WorkerModel.find({
          stations: { $elemMatch: { name: station.name, isActive: true } },
          costCenter,
          shift,
        }).sort({ name: 1 });

        // Create new RotationQueue document
        rq = new RotationQueueModel({
          station: station.name,
          queue: workers.map((w) => ({
            workerId: w._id,
            name: w.name.trim(),
            group: w.group,
            role: w.role,
            costCenter: w.costCenter,
            shift: w.shift,
          })),
          costCenter,
          shift,
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
      }).populate(
        'queue.workerId',
        '_id name role costCenter shift group status stations'
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
            role: w.role,
            costCenter: w.costCenter,
            shift: w.shift,
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
  async initialize(costCenter, shift) {
    const stations = await StationModel.find({ costCenter, shift }).sort({
      priority: -1,
    });
    if (!stations.length) throw new Error('No stations found for costCenter');
    this.stations = stations.map((s) => ({
      name: s.name,
      priority: s.priority,
      group: s.group,
      status: s.status,
    }));
  }

  async initializeQueue(costCenter, shift) {
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
      });

      if (!rotationQueue) {
        rotationQueue = new RotationQueueModel({
          station: stationName,
          queue: [],
          costCenter,
          shift,
        });
      }

      // Form a queue of workers based on their IDs
      rotationQueue.queue = workers.map((worker) => ({
        workerId: worker._id,
        name: worker.name.trim(),
        group: worker.group,
        role: worker.role,
        costCenter: worker.costCenter,
        shift: worker.shift,
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
    shift
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
      titleCell.value = `Rotationsplan ${costCenter} ${shift}‑Schicht`;
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
      const hpEntries = Object.entries(highPriorityRotation || {}).map(
        ([station, w]) => [station, typeof w === 'object' ? w.name : w]
      );

      // entries вида [имя_сотрудника, его_работа]
      const srEntries = Object.entries(specialRotation || {}).map(
        ([workerName, spec]) => [
          workerName,
          // если spec — объект с полем job, то job, иначе — сам spec
          typeof spec === 'object' && spec.job != null ? spec.job : spec,
        ]
      );

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

      // == (7) Pivot by group, with sub-headers ==
      const hpNames = new Set(
        Object.values(highPriorityRotation || {}).map((w) =>
          typeof w === 'object' ? w.name : w
        )
      );
      const pivotSet = new Set();
      cycleRotations.forEach((rot) =>
        Object.values(rot).forEach((worker) => {
          const name =
            worker && typeof worker === 'object' ? worker.name : worker;
          if (name && !hpNames.has(name)) pivotSet.add(name.trim());
        })
      );
      const byGroup = {};
      allWorkers.forEach(({ name, group, status }) => {
        if (pivotSet.has(name.trim()) && status) {
          byGroup[group] = byGroup[group] || [];
          byGroup[group].push(name.trim());
        }
      });

      // == (7.c) Worker rows with zebra striping ==
      Object.entries(byGroup)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([grp, names]) => {
          // Group header
          const grRow = worksheet.addRow([`Gruppe ${grp}`]);
          grRow.font = { bold: true };
          worksheet.mergeCells(
            grRow.number,
            1,
            grRow.number,
            leftNumCycles + 1
          );
          grRow.eachCell((c) => (c.border = borderStyle));
          grRow.commit();

          // Sub-header with round numbers
          const subTitles = [
            'Mitarbeiter',
            ...Array.from(
              { length: leftNumCycles },
              (_, i) => `Runde ${i + 1}`
            ),
          ];
          const subRow = worksheet.addRow(subTitles);
          subRow.eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFCCFFCC' },
            };
            cell.border = borderStyle;
          });
          subRow.commit();

          // Actual worker rows
          names.forEach((workerName, idx) => {
            const data = [workerName];
            for (let c = 0; c < leftNumCycles; c++) {
              const rot = cycleRotations[c] || {};
              const sts = Object.entries(rot)
                .filter(([, worker]) => {
                  const nm =
                    worker && typeof worker === 'object' ? worker.name : worker;
                  return nm === workerName;
                })
                .map(([station]) => station)
                .join(', ');
              data.push(sts);
            }
            const row = worksheet.addRow(data);
            row.eachCell((cell, colNumber) => {
              cell.border = borderStyle;
              if (colNumber === 1) {
                // first column always light-green
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFCCFFCC' },
                };
              } else if (idx % 2 === 1) {
                // zebra: odd rows dark-grey
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFD3D3D3' },
                };
              }
            });
            row.commit();
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

      // == (9.1) Auto-fit columns to their content ==
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, (cell) => {
          if (cell.row <= 2) return; // skip title and sub-header rows
          const text = cell.value == null ? '' : cell.value.toString();
          maxLength = Math.max(maxLength, text.length);
        });

        const cappedLength = Math.max(10, Math.min(maxLength, 20));

        column.width = cappedLength + 2;
      });

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
