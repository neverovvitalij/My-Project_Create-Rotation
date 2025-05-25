import { observer } from 'mobx-react-lite';
import { FaSpinner } from 'react-icons/fa';
import { useContext, useMemo, useState, useRef } from 'react';
import { toJS } from 'mobx';
import ExcelPreview from '../components/ExcelPreview';
import styles from '../styles/RotationPlan.module.css';
import { Context } from '../index';

const RotationPlan = () => {
  const { store } = useContext(Context);
  const previewRef = useRef(null);

  const [preassigned, setPreassigned] = useState([]);
  const [specialAssignments, setSpecialAssignments] = useState([]);
  const [cycles, setCycles] = useState('5');

  const [confirmedRotation, setConfirmedRotation] = useState(false);
  const [rotationForDownload, setRotationForDownload] = useState(false);
  const [loader, setLoader] = useState(false);
  const [msg, setMsg] = useState('');

  const rotations = toJS(store.rotation);
  const stationsList = toJS(store.stations);
  const employees = toJS(store.employeeList);

  const onClickPreview = async () => {
    setLoader(true);
    try {
      setMsg('');
      setRotationForDownload(false);
      setConfirmedRotation(false);
      await store.getDailyRotation(specialAssignments, preassigned, cycles);
      await previewRef.current.loadPreview();
      setConfirmedRotation(true);
    } catch (error) {
      console.error('Failed to load rotation', error.message);
    } finally {
      setLoader(false);
    }
  };

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

  const confirmRotation = async () => {
    setLoader(true);
    setConfirmedRotation(true);
    const { highPriorityRotation, cycleRotations } = rotations;

    if (!highPriorityRotation || !cycleRotations?.length) {
      store.setErrorMsg('Not enough data to confirm rotation.');
      return;
    }

    try {
      const response = await store.confirmRotation();
      setMsg(response?.message);
      setRotationForDownload(true);
    } catch (error) {
      console.error('Error confirming rotation:', error.message || error);
    } finally {
      setLoader(false);
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

  const groupedEmployees = useMemo(() => {
    return employees.reduce((acc, emp) => {
      const grp = emp.group;
      if (!acc[grp]) acc[grp] = [];
      acc[grp].push(emp);
      return acc;
    }, {});
  }, [employees]);

  const isFullyAssigned =
    store.activeEmployee !== store.activeStations + specialAssignments.length;

  return (
    <div className={styles.container}>
      {/* Button panel */}
      <div className={styles.buttonPanel}>
        <button
          disabled={!store.user.isActivated || loader || isFullyAssigned}
          className={styles.button}
          onClick={onClickPreview}
        >
          Load rotation
        </button>

        <select
          placeholder="Cycles"
          className={styles.cyclesDropdown}
          value={cycles}
          onChange={(e) => setCycles(e.target.value)}
          required
        >
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
        {confirmedRotation ? (
          <button
            disabled={rotationForDownload || loader}
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
      {loader && <FaSpinner className={styles.spinner} />}
      {msg && <p className={styles.success}>{msg}</p>}
      {isFullyAssigned && (
        <p className={styles.error}>
          Bitte prüfen Sie die Anzahl der Mitarbeiter und Stationen.
        </p>
      )}
      <h2>{`Rotations plan ${rotations.date}`}</h2>
      <ExcelPreview
        ref={previewRef}
        preassigned={toJS(preassigned)}
        specialAssignments={toJS(specialAssignments)}
      />
      {/* List of employees */}
      <h3
        className={styles.groupHeader}
      >{`Available employees ${store.activeEmployee} | Needed ${store.activeStations}`}</h3>
      {Object.entries(groupedEmployees).map(([groupName, groupEmps]) => (
        <section key={groupName} className={styles.groupSection}>
          <h3 className={styles.groupHeader}>Group {groupName}</h3>
          <h3
            className={styles.groupHeader}
          >{`Available employees ${store.activeEmployeeByGroup[groupName]} | Needed ${store.stationsByGroup[groupName]}`}</h3>
          <ul className={styles.available}>
            {groupEmps.map((emp) => {
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
                    value={stationValue}
                    onChange={(e) =>
                      handleStationChange(emp.name, e.target.value)
                    }
                    disabled={!emp.status}
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
                      placeholder="Enter task"
                      value={sonderJob}
                      onChange={(e) =>
                        handleSonderJobChange(emp.name, e.target.value)
                      }
                      disabled={!emp.status}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export default observer(RotationPlan);
