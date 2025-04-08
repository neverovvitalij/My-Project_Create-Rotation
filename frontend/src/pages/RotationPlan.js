import { observer } from 'mobx-react-lite';
import { FaSpinner } from 'react-icons/fa';
import { useContext, useState } from 'react';
import { toJS } from 'mobx';
import styles from '../styles/RotationPlan.module.css';
import { Context } from '../index';

const RotationPlan = () => {
  const { store } = useContext(Context);

  const [preassigned, setPreassigned] = useState([]);
  const [specialAssignments, setSpecialAssignments] = useState([]);

  const [confirmedRotation, setConfirmedRotation] = useState(false);
  const [rotationForDownload, setRotationForDownload] = useState(false);

  const rotations = toJS(store.rotation);
  const stationsList = toJS(store.stations);

  // 1) Remove from preassigned if it exists
  // 2) Remove from specialAssignments if it exists
  // 3) If "sonder" is selected, add it to the specialAssignments array
  // 4) If another station is selected (not empty), add it to preassigned
  // If newStation === '', that means "remove assignment", add nothing
  const handleStationChange = (workerName, newStation) => {
    setPreassigned((prev) => prev.filter((item) => item.worker !== workerName));
    setSpecialAssignments((prev) =>
      prev.filter((item) => item.worker !== workerName)
    );

    if (newStation === 'sonder') {
      setSpecialAssignments((prev) => [
        ...prev,
        { worker: workerName, job: '' },
      ]);
    } else if (newStation) {
      setPreassigned((prev) => [
        ...prev,
        { worker: workerName, station: newStation },
      ]);
    }
  };

  // -- Logic for entering "job" for sonder --
  const handleSonderJobChange = (workerName, newJob) => {
    setSpecialAssignments((prev) =>
      prev.map((item) =>
        item.worker === workerName ? { ...item, job: newJob } : item
      )
    );
  };

  // -- Get what has been selected for this employee (station or 'sonder') --
  const getCurrentStationForWorker = (workerName) => {
    const sonderItem = specialAssignments.find((s) => s.worker === workerName);
    if (sonderItem) {
      return 'sonder';
    }
    const preItem = preassigned.find((p) => p.worker === workerName);
    return preItem ? preItem.station : '';
  };

  // -- The current job for this employee, if they are in sonder --
  const getSonderJobForWorker = (workerName) => {
    const sonderItem = specialAssignments.find((s) => s.worker === workerName);
    return sonderItem ? sonderItem.job : '';
  };

  // -- Plan-related methods --
  const getRotationDataForDay = async () => {
    setRotationForDownload(false);
    try {
      setConfirmedRotation(true);
      await store.getDailyRotation(specialAssignments, preassigned);
    } catch (error) {
      console.error('Failed to load rotation', error.message);
    } finally {
      setConfirmedRotation(false);
    }
  };

  const confirmRotation = async () => {
    setConfirmedRotation(true);
    const { specialRotation, highPriorityRotation, cycleRotations } = rotations;

    if (!highPriorityRotation || !cycleRotations?.length) {
      store.setErrorMsg('Not enough data to confirm rotation.');
      return;
    }

    try {
      await store.confirmRotation(
        specialRotation,
        highPriorityRotation,
        cycleRotations
      );
      setRotationForDownload(true);
    } catch (error) {
      console.error('Error confirming rotation:', error.message || error);
    } finally {
      setConfirmedRotation(false);
    }
  };

  const downloadRotation = async () => {
    try {
      await store.downloadLatestConfirmedRotation();
    } catch (error) {
      console.error('Error downloading file:', error.message || error);
    }
  };

  const handleCheck = async (worker) => {
    const newStatus = !worker.status;
    await store.changeWorkerStatus(worker.name, newStatus);
  };

  return (
    <div className={styles.container}>
      {/* Button panel */}
      <div className={styles.buttonPanel}>
        <button className={styles.button} onClick={getRotationDataForDay}>
          Load rotation
        </button>
        {rotations.cycleRotations?.length ? (
          <button
            disabled={confirmedRotation}
            className={styles.button}
            onClick={confirmRotation}
          >
            Save plan
          </button>
        ) : null}
        {rotationForDownload && (
          <button onClick={downloadRotation} className={styles.button}>
            Download plan
          </button>
        )}
      </div>
      {confirmedRotation && <FaSpinner className={styles.spinner} />}
      <h2>{`Available employees ${store.activeEmployeeCount} | Needed ${store.stationsCount}`}</h2>
      {/* List of employees */}
      <ul className={styles.available}>
        {store.employeeList.map((emp) => {
          const stationValue = getCurrentStationForWorker(emp.name);
          const sonderJob = getSonderJobForWorker(emp.name);

          return (
            <li key={emp._id} className={styles.empItem}>
              <span>{emp.name}</span>
              <input
                type="checkbox"
                className={styles.inputCheckbox}
                checked={emp.status}
                onChange={() => handleCheck(emp)}
              />
              <select
                className={styles.stationDropdown}
                onChange={(e) => handleStationChange(emp.name, e.target.value)}
                value={stationValue}
              >
                <option value="">Assign</option>
                <option value="sonder">Special</option>
                {stationsList.map((station) => (
                  <option key={station._id} value={station.name}>
                    {station.name}
                  </option>
                ))}
              </select>

              {stationValue === 'sonder' && (
                <input
                  type="text"
                  className={styles.inputSonder}
                  placeholder="Enter tast"
                  value={sonderJob ?? ' '}
                  onChange={(e) =>
                    handleSonderJobChange(emp.name, e.target.value)
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
      <h2>{`Rotations plan ${rotations.date}`}</h2>
      {/* High Priority Rotations */}
      <section className={styles.highPriority}>
        <p className={styles.gruppeTitle}>Entire day</p>
        {rotations.highPriorityRotation &&
        Object.keys(rotations.highPriorityRotation).length > 0 ? (
          <div className={styles.highPriorityList}>
            {Object.entries(rotations.highPriorityRotation).map(
              ([station, worker]) => (
                <div key={station} className={styles.highPriorityStation}>
                  <h3>{station}</h3>
                  <p>{worker}</p>
                </div>
              )
            )}
          </div>
        ) : (
          <p>Loading high priority rotation data...</p>
        )}
      </section>
      {/* Special tasks (Sonder Rotations) */}
      {Object.keys(rotations.specialRotation).length > 0 && (
        <>
          <section className={styles.highPriority}>
            <p className={styles.groupTitle}>Special task</p>
            <div className={styles.highPriorityList}>
              {Object.entries(rotations.specialRotation).map(
                ([workerName, job]) => (
                  <div key={workerName} className={styles.highPriorityStation}>
                    <h3>{workerName}</h3>
                    <p>{job}</p>
                  </div>
                )
              )}
            </div>
          </section>
        </>
      )}
      {/* Daily Rotations */}
      <section className={styles.dailyRotation}>
        {rotations.cycleRotations?.length > 0 ? (
          rotations.cycleRotations.map((rot, cycleIndex) => (
            <div key={cycleIndex} className={styles.cycle}>
              <h3>Cycle {cycleIndex + 1}</h3>
              <ul>
                {Object.entries(rot).map(([station, worker], indx) => (
                  <li key={station}>
                    <strong>{`${indx + 1}. ${station}`}:</strong> {worker}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p>Loading daily rotation data...</p>
        )}
      </section>
    </div>
  );
};

export default observer(RotationPlan);
