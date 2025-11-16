const WorkerModel = require('../models/worker-model');
const RotationQueueModel = require('../models/rotationqueue-model');
const ConfirmedRotation = require('../models/confirmedrotation-model');
const StationModel = require('../models/station-model');
const AoRotationQueue = require('../models/aorotationqueue-model');
const AoModel = require('../models/ao-model');

class RotationPlanService {
  constructor() {
    // In-memory cache for station definitions (populated via initialize()).
    this.stations = [];
  }

  /**
   * Generate rotation data (preview/JSON) for a given costCenter/shift/plant and number of cycles.
   * This method:
   *  1) Loads station definitions and filters active stations.
   *  2) Fetches workers and auto-preassigns single-station workers where safe.
   *  3) Loads per-station queues into memory (this.rotationQueues).
   *  4) Creates helper schedules for workers with fewer skills than cycles.
   *  5) Verifies coverage for priority stations (priority >= 2) via bipartite matching.
   *  6) Generates daily cycles for regular stations (priority === 1) and verifies coverage.
   *  7) Persists queue rotations and builds the AO rotation queue using only names present in cycles.
   *  8) Returns a structured payload with all computed mappings.
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
      // Keep only active stations for this run.
      activeStations = this.stations.filter((s) => s.status === true);

      // Nothing to do if there are no active stations.
      if (!activeStations.length) {
        return {
          specialRotation: {},
          highPriorityRotation: {},
          cycleRotations: [],
          date: new Date().toISOString().split('T')[0],
        };
      }
    } catch (error) {
      // Station bootstrap failed (DB, connectivity, etc.)
      console.error('Error loading stations:', error);
      throw new Error('Station initialization failed');
    }

    // (2) Fetch all active workers for the given context; preassign trivial single-station cases.
    let availableWorkers = [];
    try {
      const availableWorkersFromDB = await WorkerModel.find({
        costCenter,
        shift,
        plant,
        status: true,
      });

      // These sets are used to detect conflicts with preassigned/special or high-priority names.
      const hasWorkerName = new Set(
        [...preassigned, ...specialAssignments].map(({ worker }) => worker)
      );
      const hasStationName = new Set(
        [...activeStations]
          .filter((stn) => stn.priority > 1)
          .map((stn) => stn.name)
      );

      // Auto-preassign workers who have exactly one station AND are not already reserved,
      // and that station is not high priority. Everyone else goes to the available pool.
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

    // (3) Load per-station queues (Queue docs are lazily created if missing).
    try {
      await this.loadRotationQueues(activeStations, costCenter, shift, plant);
    } catch (err) {
      console.error('Error initializing/loading rotation queues:', err.message);
      throw new Error('Failed to initialize rotation queues');
    }

    // (4) Prepare helper structures for the "schedulable" set: workers with at least 1 active skill
    //     and fewer active skills than the number of cycles. This is used to pre-fill some slots.
    const workerSchedules = {}; // name -> array of length cycles, planned station names (or '')
    const removedStations = new Set(); // mask of stations collected from schedulable workers

    // Compute "schedulable" workers.
    const schedulable = availableWorkers.filter((w) => {
      const skills = w.stations.filter((s) => s.isActive).map((s) => s.name);
      return skills.length > 0 && skills.length < cycles;
    });

    // Quick lookup: worker name -> Set of their active skills (for competency checks).
    const skillSetByWorker = new Map();
    availableWorkers.forEach((w) => {
      const activeSkills = w.stations
        .filter((s) => s.isActive)
        .map((s) => s.name);
      skillSetByWorker.set(w.name, new Set(activeSkills));
    });

    // Build a mask of stations that appear in schedulable workers (used to avoid some conflicts later).
    schedulable.forEach((w) => {
      const skills = w.stations.filter((s) => s.isActive).map((s) => s.name);
      skills.forEach((st) => removedStations.add(st));
    });

    // Sets to exclude high-priority/preassigned stations when computing schedulable skills.
    const hasStationName = new Set(
      activeStations.filter((stn) => stn.priority > 1).map((stn) => stn.name)
    );
    const hasPreasinedStations = new Set(
      preassigned.map(({ station }) => station)
    );

    // Map worker -> allowed skills (filtered by active, not high-priority, not preassigned, in mask).
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

    // Build empty schedule slots per schedulable worker.
    const names = Array.from(skillsByWorker.keys());
    for (const name of names) {
      workerSchedules[name] = Array.from({ length: cycles }, () => '');
    }

    // Round-robin across cycles: fill workerSchedules[name][cycle] with a valid station when possible,
    // ensuring no station is duplicated within the same cycle.
    for (let c = 0; c < cycles; c++) {
      const used = new Set(); // stations taken in this cycle

      names.forEach((name, i) => {
        const skills = skillsByWorker.get(name);
        const skillSet = skillSetByWorker.get(name) || new Set();
        let chosen;

        // Try a shifted scan over skills to spread load between workers.
        for (let t = 0; t < skills.length; t++) {
          const candidate = skills[(i + c + t) % skills.length];
          if (!used.has(candidate) && skillSet.has(candidate)) {
            chosen = candidate;
            break;
          }
        }

        // Fallback: base offset only (still must be competent and not used in this cycle).
        if (!chosen) {
          const candidate = skills[(i + c) % skills.length];
          if (!used.has(candidate) && skillSet.has(candidate)) {
            chosen = candidate;
          }
        }

        // Set if found; otherwise keep empty slot (no valid/available option).
        if (chosen) {
          workerSchedules[name][c] = chosen;
          used.add(chosen);
        }
      });
    }

    // Remove schedulable workers from the general available pool (they are preplanned separately).
    const scheduledNames = new Set(names);
    availableWorkers = availableWorkers.filter(
      (x) => !scheduledNames.has(x.name)
    );

    // (5) Verify coverage for PRIORITY stations (priority >= 2) using bipartite matching.
    //     This guarantees we can pick unique workers for each such station before final assignment.
    try {
      // Exclude names already taken by preassigned + special.
      const namesPre = new Set(
        [...preassigned, ...specialAssignments].map(({ worker }) => worker)
      );
      const preassignedStations = new Set(
        preassigned.map(({ station }) => station)
      );

      // Build the list of priority stations that must be covered (do NOT exclude by removedStations).
      const priorityStations = activeStations
        .filter(
          (stn) =>
            stn.priority >= 2 &&
            stn.status === true &&
            !preassignedStations.has(stn.name)
        )
        .sort(
          (a, b) => b.priority - a.priority || a.name.localeCompare(b.name)
        );

      // For each priority station: collect candidate workers from its queue
      // who are active, competent (isActive for that station), and not pre-reserved.
      const candidatesByStation = new Map();
      for (const st of priorityStations) {
        const q = this.rotationQueues.get(st.name) || [];
        const same = [];
        const any = [];
        for (const w of q) {
          if (!w?.status) continue;
          const canDoActive = w.stations?.some(
            (s) => s.name === st.name && s.isActive
          );
          if (!canDoActive) continue;
          if (namesPre.has(w.name)) continue;

          if (w.group === st.group) same.push(w.name);
          any.push(w.name);
        }
        // Prefer group-matching first; then anyone; dedupe while keeping order.
        const uniq = (arr) => Array.from(new Set(arr));
        const ordered = uniq([...same, ...any]);
        candidatesByStation.set(st.name, ordered);
      }

      // Order stations by scarcity (fewest candidates first), then by priority descending.
      const scarceFirst = priorityStations.slice().sort((a, b) => {
        const ca = candidatesByStation.get(a.name)?.length ?? 0;
        const cb = candidatesByStation.get(b.name)?.length ?? 0;
        return (
          ca - cb || b.priority - a.priority || a.name.localeCompare(b.name)
        );
      });

      // Simple DFS-based maximum matching:
      // takenByWorker: workerName -> stationName
      // matched: stationName -> workerName
      const takenByWorker = Object.create(null);
      const matched = Object.create(null);

      function tryAssign(stationName, seen = new Set()) {
        if (seen.has(stationName)) return false;
        seen.add(stationName);

        const candidates = candidatesByStation.get(stationName) || [];
        for (const wName of candidates) {
          if (!takenByWorker[wName]) {
            // Free worker: assign directly.
            takenByWorker[wName] = stationName;
            matched[stationName] = wName;
            return true;
          } else {
            // Worker is used by another station — try to re-route that station.
            const otherStation = takenByWorker[wName];
            if (tryAssign(otherStation, seen)) {
              takenByWorker[wName] = stationName;
              matched[stationName] = wName;
              return true;
            }
          }
        }
        return false;
      }

      // Attempt to assign every priority station uniquely.
      let ok = 0;
      for (const st of scarceFirst) {
        if (tryAssign(st.name, new Set())) ok++;
      }

      // If not all are matched, report the missing stations to the user (German message).
      if (ok !== scarceFirst.length) {
        const missing = scarceFirst
          .filter((st) => !matched[st.name])
          .map((st) => `„${st.name}“`)
          .join(', ');
        throw new Error(
          `Nicht genügend Mitarbeitende für Prioritäts-Stationen: ${missing}`
        );
      }
    } catch (err) {
      // Keep user-facing log in German; bubble the message up.
      console.error(
        `Fehler bei der Überprüfung der Priority-Stationen: ${err.message}`
      );
      throw new Error(err.message);
    }

    try {
      // Containers for final result.
      // specialRotation: Map(workerName -> { worker, job })
      // highPriorityRotation: Map(stationName -> workerObj)
      // cycleRotations: Array<dailyRotation>, where dailyRotation is { [stationName]: workerObj }
      const specialRotation = new Map();
      const highPriorityRotation = new Map();
      const cycleRotations = [];
      const fixedAssignments = {}; // stationName -> workerName (reserved)
      const specialWorkers = new Set(); // set of worker names reserved for special tasks

      // (A) Apply special ("Sonder") assignments. These workers become reserved globally.
      for (const { worker: workerName, job } of specialAssignments) {
        specialRotation.set(workerName, { worker: workerName, job });
        specialWorkers.add(workerName);
      }

      // (B) High-priority assignments (priority >= 2)
      //  1) Apply explicit preassigned overrides for high-priority stations.
      for (const { station: stationName, worker: workerName } of preassigned) {
        const station = activeStations.find((s) => s.name === stationName);
        if (!station) continue;
        const queue = this.rotationQueues.get(station.name) || [];
        let found = queue.find((p) => p.name === workerName);
        if (!found) {
          // Not present in queue — try loading from DB and append to the queue.
          found = await WorkerModel.findOne({ name: workerName });
          if (found) queue.push(found);
        }
        if (found) {
          highPriorityRotation.set(stationName, found);
          fixedAssignments[stationName] = found.name;
        }
      }

      //  2) Fill GV stations (subset of priority stations whose names include 'gv').
      const gvStations = activeStations.filter(
        ({ name, priority, status }) =>
          priority >= 2 && status && name.toLowerCase().includes('gv')
      );

      for (const station of gvStations) {
        const queue = this.rotationQueues.get(station.name) || [];

        // Prefer active competency for this station; fallback to anyone who has the station (even if not isActive).
        const primary = queue.find(
          (w) =>
            !fixedAssignments[station.name] &&
            w.status &&
            w.stations.some((stn) => stn.name === station.name && stn.isActive)
        );
        const fallback = queue.find(
          (w) =>
            !fixedAssignments[station.name] &&
            w.status &&
            w.stations.some((stn) => stn.name === station.name)
        );

        const chosen = primary ?? fallback;

        if (chosen) {
          highPriorityRotation.set(station.name, chosen);
          fixedAssignments[station.name] = chosen.name;
        }
      }

      //  3) Fill remaining priority stations:
      //     - Prefer same-group & active competency.
      //     - For priority 3, accept any group if base conditions true.
      //     - Otherwise, fallback to first available.
      const priorityStations = activeStations
        .filter(
          ({ name, priority, status }) =>
            priority >= 2 && status && !name.toLowerCase().includes('gv')
        )
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

        // Try to find a worker who matches group and is not already reserved for another station.
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

        // Fallback: take the first available competent worker not yet reserved.
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

      // (C) Generate daily cycles for REGULAR stations (priority === 1).
      //     We first check that we *can* cover the set of required cycle stations uniquely,
      //     excluding banned workers (special/fixed/preassigned), then proceed per day.
      try {
        // Names reserved by preassigned/special.
        const namesPre = new Set(
          [...preassigned, ...specialAssignments].map(({ worker }) => worker)
        );
        const preassignedStations = new Set(
          preassigned.map(({ station }) => station)
        );

        // Collect required regular stations for cycles (exclude removed mask).
        const cycleStations = activeStations.filter(
          (stn) =>
            stn.priority === 1 &&
            stn.status === true &&
            !preassignedStations.has(stn.name) &&
            !removedStations.has(stn.name)
        );

        // Build the banned set so they won't be used for regular cycles.
        const bannedWorkers = new Set([
          ...Object.values(fixedAssignments || {}),
          ...specialWorkers,
          ...namesPre,
        ]);

        // For each regular station: build eligible candidate names from its queue (active & competent & not banned).
        const eligibleByStation = new Map();
        for (const st of cycleStations) {
          const q = (this.rotationQueues.get(st.name) || []).filter(
            (w) =>
              w?.status === true &&
              w.stations?.some((s) => s.name === st.name && s.isActive) &&
              !bannedWorkers.has(w.name)
          );

          const same = q.filter((w) => w.group === st.group).map((w) => w.name);
          const any = q.map((w) => w.name);

          const uniq = (arr) => Array.from(new Set(arr));
          eligibleByStation.set(st.name, { same: uniq(same), any: uniq(any) });
        }

        // Sort by scarcity to maximize the chance of a perfect unique coverage.
        const sortedStations = cycleStations.slice().sort((a, b) => {
          const ea = eligibleByStation.get(a.name);
          const eb = eligibleByStation.get(b.name);
          const la = ea?.any?.length || 0;
          const lb = eb?.any?.length || 0;
          return la - lb || a.name.localeCompare(b.name);
        });

        // DFS-based maximum matching for regular stations as a sanity check before day-by-day fill.
        const takenByWorker = Object.create(null); // workerName -> stationName
        const matched = Object.create(null); // stationName -> workerName

        function tryAssign(stationName, seen) {
          if (seen.has(stationName)) return false;
          seen.add(stationName);

          const lists = eligibleByStation.get(stationName) || {
            same: [],
            any: [],
          };
          const candidates = Array.from(
            new Set([...(lists.same || []), ...(lists.any || [])])
          );

          for (const wName of candidates) {
            if (!takenByWorker[wName]) {
              takenByWorker[wName] = stationName;
              matched[stationName] = wName;
              return true;
            } else {
              const otherStation = takenByWorker[wName];
              if (tryAssign(otherStation, seen)) {
                takenByWorker[wName] = stationName;
                matched[stationName] = wName;
                return true;
              }
            }
          }
          return false;
        }

        // Try to assign all required stations once.
        let ok = 0;
        for (const st of sortedStations) {
          const seen = new Set();
          if (tryAssign(st.name, seen)) ok++;
        }

        if (ok !== sortedStations.length) {
          const missing = sortedStations
            .filter((st) => !matched[st.name])
            .map((st) => `„${st.name}“`)
            .join(', ');
          // German message for user-facing error.
          throw new Error(
            `Nicht genügend Mitarbeitende für folgende Zyklus-Stationen: ${missing}`
          );
        }
      } catch (err) {
        console.error(
          `Fehler bei der Überprüfung der Zyklus-Stationen: ${err.message}`
        );
        throw new Error(err.message);
      }

      // Day-by-day rotation construction for all cycles.
      for (let cycle = 0; cycle < cycles; cycle++) {
        const dailyRotation = {}; // stationName -> workerObj for this day

        // Keep track of names already used this day to avoid duplicates across stations.
        const assignedWorkers = new Set([
          ...Object.values(fixedAssignments),
          ...specialWorkers,
        ]);

        // 0) Pre-fill from workerSchedules (workers with fewer skills than cycles).
        for (const [workerName, schedule] of Object.entries(workerSchedules)) {
          if (assignedWorkers.has(workerName)) continue;
          const stationName = schedule[cycle];
          const queue = this.rotationQueues.get(stationName) || [];
          const idx = queue.findIndex((p) => p.name === workerName);
          if (idx !== -1) {
            dailyRotation[stationName] = queue[idx];
            assignedWorkers.add(workerName);
            // Rotate queue slot to the back.
            queue.push(queue.splice(idx, 1)[0]);
          }
        }

        // 1) Fill remaining regular (priority < 2) stations.
        for (const station of activeStations) {
          if (dailyRotation.hasOwnProperty(station.name)) continue;
          if (station.priority >= 2) continue; // skip high-priority here
          const queue = this.rotationQueues.get(station.name) || [];
          if (queue.length === 0) continue;

          let assigned = false;

          // a) If station is explicitly fixed to a worker (from prior steps), try that worker first.
          if (fixedAssignments[station.name]) {
            const name = fixedAssignments[station.name];
            const idx = queue.findIndex((p) => p.name === name);
            if (idx !== -1) {
              dailyRotation[station.name] = queue[idx];
              assignedWorkers.add(name);
              queue.push(queue.splice(idx, 1)[0]);
              assigned = true;
            }
          }

          // b) Prefer same-group worker with active competency and not yet assigned today.
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

          // c) Avoid repeating the same worker as previous cycle for this station, if possible.
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

          // d) Last resort: take the first competent & free worker.
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

        // 2) Intra-day deduplication: if a worker appears on multiple stations, swap with a unique worker when possible.
        const counts = {};
        Object.values(dailyRotation).forEach(
          (w) => (counts[w.name] = (counts[w.name] || 0) + 1)
        );
        for (const [workerName, cnt] of Object.entries(counts)) {
          if (cnt > 1) {
            // Find the stations where this worker is used.
            const stations = Object.entries(dailyRotation)
              .filter(([_, w]) => w.name === workerName)
              .map(([st]) => st);

            // Try to resolve by swapping the second occurrence with a unique worker.
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

        // 3) Sanity check: ensure all required cycle stations for this day are covered.
        {
          const preassignedStations = new Set(
            preassigned.map(({ station }) => station)
          );
          const requiredCycleStations = activeStations
            .filter(
              (stn) =>
                stn.priority === 1 &&
                stn.status === true &&
                !preassignedStations.has(stn.name) &&
                !removedStations.has(stn.name)
            )
            .map((s) => s.name);

          const missingNow = requiredCycleStations.filter(
            (stName) =>
              !dailyRotation[stName] ||
              !(
                (dailyRotation[stName] && dailyRotation[stName].name) ||
                dailyRotation[stName]
              )
          );

          if (missingNow.length > 0) {
            // German user-facing message including the cycle index (1-based).
            throw new Error(
              `Zyklus ${
                cycle + 1
              }: Nicht abgedeckte Stationen: ${missingNow.join(', ')}`
            );
          }
        }

        // Commit this day.
        cycleRotations.push(dailyRotation);
      }

      // (6) Persist updated per-station queue order back to DB (reflecting any rotations performed).
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

      // (7) Build the final array of all workers for response (fresh from DB).
      const allWorkers = await WorkerModel.find({ costCenter, shift, plant });

      // (8) AO rotation queue:
      //     - Synchronize AO queue membership with current workers (preserve existing order).
      //     - Choose AO assignees only from names that actually appeared in cycle rotations (allowedNames).
      //     - Rotate exactly the chosen entry after assignment.
      let rotationQueueForAOTask = await AoRotationQueue.findOne({
        station: 'AO',
        costCenter,
        shift,
        plant,
      });

      if (!rotationQueueForAOTask) {
        rotationQueueForAOTask = new AoRotationQueue({
          station: 'AO',
          queue: [],
          costCenter,
          shift,
          plant,
        });
      }

      // Sync AO queue members to the current set of workers (update fields; append missing; keep order).
      const existing = rotationQueueForAOTask.queue || [];
      const byId = new Map(existing.map((e) => [String(e.workerId), e]));

      for (const w of allWorkers) {
        const id = String(w._id);
        if (byId.has(id)) {
          const rec = byId.get(id);
          rec.name = w.name.trim();
          rec.group = w.group;
          rec.costCenter = w.costCenter;
          rec.shift = w.shift;
          rec.plant = w.plant;
        } else {
          existing.push({
            workerId: w._id,
            name: w.name.trim(),
            group: w.group,
            costCenter: w.costCenter,
            shift: w.shift,
            plant: w.plant,
          });
        }
      }

      // Drop invalid entries (e.g., worker removed).
      const validIds = new Set(allWorkers.map((w) => String(w._id)));
      rotationQueueForAOTask.queue = existing.filter((e) =>
        validIds.has(String(e.workerId))
      );

      // Only those workers that actually appear in cycles are eligible for AO today.
      const pickName = (w) => (typeof w === 'string' ? w : w?.name || '');
      const useAllCycles = true;
      const allowedNames = new Set(
        useAllCycles
          ? (cycleRotations || []).flatMap((rot) =>
              Object.values(rot || {}).map(pickName)
            )
          : Object.values(cycleRotations?.[0] || {}).map(pickName)
      );
      for (const n of Array.from(allowedNames)) {
        if (!n || !n.trim()) allowedNames.delete(n);
      }
      const isAllowed = (name) => allowedNames.has(name);

      // Build AO assignments in order of AO tasks; rotate the queue on each assignment.
      const allAoTasksName = await AoModel.find({
        costCenter,
        status: true,
        shift,
        plant,
      }).lean();

      const aoRotationQueue = new Map();
      const queue = rotationQueueForAOTask.queue || [];

      // Index selection policy for AO:
      //  - First try allowed & same group.
      //  - Then allowed (any group).
      //  - Then same group (fallback).
      //  - Else first entry (if queue is non-empty).
      function findIndexForTask(taskGroup) {
        // 1) allowed + same group
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i];
          if (
            p &&
            isAllowed(p.name) &&
            (taskGroup == null || p.group === taskGroup)
          )
            return i;
        }
        // 2) allowed (any group)
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i];
          if (p && isAllowed(p.name)) return i;
        }
        // 3) same group (fallback without allowed)
        for (let i = 0; i < queue.length; i++) {
          const p = queue[i];
          if (p && (taskGroup == null || p.group === taskGroup)) return i;
        }
        // 4) any (final fallback)
        return queue.length ? 0 : -1;
      }

      for (const task of allAoTasksName) {
        const taskKey = `Gruppe:${task.group} AO:${task.name}`;
        const idx = findIndexForTask(task.group);
        if (idx === -1) continue; // no one available — skip

        const chosen = queue[idx];
        aoRotationQueue.set(taskKey, chosen.name);

        // Rotate only the chosen entry.
        queue.push(queue.splice(idx, 1)[0]);
      }

      // Persist updated AO queue order.
      rotationQueueForAOTask.markModified('queue');
      await rotationQueueForAOTask.save();

      // Final payload for client.
      return {
        specialRotation: Object.fromEntries(specialRotation),
        highPriorityRotation: Object.fromEntries(highPriorityRotation),
        cycleRotations,
        allWorkers,
        aoRotationQueue: Object.fromEntries(aoRotationQueue),
        date: new Date().toISOString().split('T')[0],
      };
    } catch (error) {
      // Top-level generation failed — keep server log in English, message content may be bubbled to client elsewhere.
      console.error('Error generating rotation data:', error);
      throw new Error(error || 'Error generating rotation data');
    }
  }

  /**
   * Ensure every active station has a RotationQueue document.
   * Load queues and normalize them into in-memory arrays of worker objects:
   *   this.rotationQueues: Map<stationName, Array<workerObj>>
   */
  async loadRotationQueues(activeStations, costCenter, shift, plant) {
    // Create missing queue documents with eligible workers (active skills for that station).
    for (const station of activeStations) {
      let rq = await RotationQueueModel.findOne({
        station: station.name,
        costCenter,
        shift,
        plant,
      });
      if (!rq) {
        const workers = await WorkerModel.find({
          stations: { $elemMatch: { name: station.name, isActive: true } },
          costCenter,
          shift,
          plant,
        }).sort({ name: 1 });

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

    // Populate queues into memory with fully-hydrated worker objects.
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
        // Drop entries missing workerId (data hygiene).
        .filter((item) => item.workerId)
        // Map queue items to plain worker objects.
        .map((item) => {
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
   * Load station definitions from DB and keep just what we need (name, priority, group, status).
   * Sort in descending priority so that high-priority handling can process earlier if needed.
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

  /**
   * Rebuild queues for all stations currently in this.stations.
   * Useful for initial setup or full re-seeding. Not used in the main flow.
   */
  async initializeQueue(costCenter, shift, plant) {
    if (!this.stations || this.stations.length === 0) {
      throw new Error(
        'Stations list is empty. Please initialize stations first.'
      );
    }

    for (const station of this.stations) {
      const stationName = station.name;

      // Get all workers competent for this station (active skill).
      const workers = await WorkerModel.find({
        stations: { $elemMatch: { name: stationName, isActive: true } },
      }).sort({ name: 1 });

      // Find or create a queue doc for this station.
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

      // Set queue to the current eligible worker list.
      rotationQueue.queue = workers.map((worker) => ({
        workerId: worker._id,
        name: worker.name.trim(),
        group: worker.group,
        costCenter: worker.costCenter,
        shift: worker.shift,
        plant: worker.plant,
      }));

      await rotationQueue.save();
    }
  }

  /**
   * Persist a "confirmed" rotation:
   *  - Save the structure into ConfirmedRotation.
   *  - Rotate each per-station queue by moving the used worker to the end.
   *  - Rotate AO queue entries similarly.
   */
  async confirmRotation(
    allWorkers,
    specialRotation = null,
    highPriorityRotation,
    cycleRotations,
    aoRotationQueue,
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
      // Persist the whole structure for auditing/exports.
      const confirmedRotation = new ConfirmedRotation({
        costCenter,
        shift,
        plant,
        rotation: {
          specialRotation: { ...specialRotation },
          highPriorityRotation: { ...highPriorityRotation },
          cycleRotations: cycleRotations.map((rotation) => ({ ...rotation })),
          allWorkers,
          aoRotationQueue: { ...aoRotationQueue },
        },
      });

      await confirmedRotation.save();

      // Helper: rotate a station queue after using a specific worker (move to end).
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
          // German log: worker not found in queue for this station.
          console.error(
            `Workers ${workerName} is missing in the queue for station ${station}.`
          );
        }
      };

      // Helper: rotate AO queue after using a specific worker (move to end).
      const updateAoQueue = async (aoTask, workerName) => {
        const rotationAoQueue = await AoRotationQueue.findOne({
          station: 'AO',
          costCenter,
          shift,
          plant,
        });
        if (!rotationAoQueue || rotationAoQueue.queue.length === 0) {
          return;
        }
        const worker = await WorkerModel.findOne({ name: workerName });
        if (!worker) {
          return;
        }

        const idx = rotationAoQueue.queue.findIndex(
          (item) => String(item.workerId) === String(worker._id)
        );

        if (idx !== -1) {
          rotationAoQueue.queue.push(rotationAoQueue.queue.splice(idx, 1)[0]);
          rotationAoQueue.markModified('queue');
          await rotationAoQueue.save();
        } else {
          // German log: worker not found in AO queue for this task.
          console.error(
            `Workers ${workerName} is missing in the queue for AO ${aoTask}.`
          );
        }
      };

      // Apply rotations for all used assignments (special, high-priority, cycles, AO).
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

      for (const [aoTask, workerName] of Object.entries(aoRotationQueue)) {
        await updateAoQueue(aoTask, workerName);
      }

      // Invalidate in-memory queues; next run will reload fresh from DB.
      this.rotationQueues = null;

      return { confirmedRotation };
    } catch (error) {
      // Server-side confirmation error.
      console.error('Error confirming rotation:', error);
      throw new Error('Error confirming rotation');
    }
  }
}

module.exports = RotationPlanService;
