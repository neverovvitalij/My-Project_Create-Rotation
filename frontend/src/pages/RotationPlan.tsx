import { observer } from 'mobx-react-lite';
import { FaSpinner } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import { useContext, useMemo, useState, useRef, FC } from 'react';
import { toJS } from 'mobx';
import ExcelPreview, { ExcelPreviewHandle } from '../components/ExcelPreview';
import styles from '../styles/RotationPlan.module.css';
import { Context } from '../index';
import {
  IEmployee,
  IPreassignedEntry,
  ISpecialAssignment,
} from '../store/types';

const RotationPlan: FC = () => {
  const { store } = useContext(Context);
  const previewRef = useRef<ExcelPreviewHandle | null>(null);
  const Spinner = FaSpinner as React.FC<IconBaseProps>;

  const [preassigned, setPreassigned] = useState<IPreassignedEntry[]>([]);
  const [specialAssignments, setSpecialAssignments] = useState<
    ISpecialAssignment[]
  >([]);
  const [cycles, setCycles] = useState<number>(5);

  const [confirmedRotation, setConfirmedRotation] = useState(false);
  const [rotationForDownload, setRotationForDownload] = useState(false);
  const [loader, setLoader] = useState(false);
  const [msg, setMsg] = useState('');

  const rotations = toJS(store.rotation);
  const employees = toJS(store.employeeList);

  store.setErrorMsg('');
  const onClickPreview = async () => {
    store.setErrorMsg('');
    setLoader(true);
    try {
      setMsg('');
      setRotationForDownload(false);
      setConfirmedRotation(false);
      await store.getDailyRotation(specialAssignments, preassigned, cycles);
      await previewRef.current?.loadPreview();
      setConfirmedRotation(true);
    } catch (error: unknown) {
      console.error('Failed to load rotation', error);
    } finally {
      setLoader(false);
    }
  };

  const handleStationChange = (workerName: string, newStation: string) => {
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
  const handleSonderJobChange = (workerName: string, newJob: string) => {
    setSpecialAssignments((prev) =>
      prev.map((item) =>
        item.worker === workerName ? { ...item, job: newJob } : item
      )
    );
  };

  // -- Get what has been selected for this employee (station or 'sonder') --
  const getCurrentStationForWorker = (workerName: string) => {
    const sonderItem = specialAssignments.find((s) => s.worker === workerName);
    if (sonderItem) {
      return 'sonder';
    }
    const preItem = preassigned.find((p) => p.worker === workerName);
    return preItem ? preItem.station : '';
  };

  // -- The current job for this employee, if they are in sonder --
  const getSonderJobForWorker = (workerName: string) => {
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

      if (response.success) {
        setMsg('Plan has been confirmed and saved.');
        setRotationForDownload(true);
      }
    } catch (error) {
      console.error('Error confirming rotation:', error);
      setRotationForDownload(false);
    } finally {
      setLoader(false);
    }
  };

  const downloadRotation = async () => {
    try {
      await store.downloadLatestConfirmedRotation();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleCheck = async (worker: IEmployee) => {
    const newStatus = !worker.status;
    await store.changeWorkerStatus(worker.name, newStatus);
    setPreassigned((prev) =>
      prev.filter((item) => item.worker !== worker.name)
    );
    setSpecialAssignments((prev) =>
      prev.filter((item) => item.worker !== worker.name)
    );
  };

  type GroupedEmployees = Record<string, IEmployee[]>;

  const groupedEmployees = useMemo<GroupedEmployees>(() => {
    return employees.reduce<GroupedEmployees>((acc, emp) => {
      const key = String(emp.group);
      (acc[key] ??= []).push(emp);
      return acc;
    }, {});
  }, [employees]);

  const isFullyAssigned =
    store.activeEmployee !== store.activeStations + specialAssignments.length;

  return (
    <div className={styles.container}>
      <h2>Rotationsplan</h2>
      {/* Button panel */}
      <div className={styles.buttonPanel}>
        <button
          disabled={!store.user.isActivated || loader || isFullyAssigned}
          className={styles.button}
          onClick={onClickPreview}
        >
          Rotation laden
        </button>
        <select
          className={styles.cyclesDropdown}
          value={cycles}
          onChange={(e) => setCycles(Number(e.target.value))}
          required
        >
          <option value="" disabled>
            Runde wählen
          </option>
          <option value={5}>5</option>
          <option value={4}>4</option>
          <option value={3}>3</option>
          <option value={2}>2</option>
          <option value={1}>1</option>
        </select>
        {confirmedRotation ? (
          <button
            disabled={rotationForDownload || loader}
            className={styles.button}
            onClick={confirmRotation}
          >
            Plan speichern
          </button>
        ) : null}
        {rotationForDownload && (
          <button onClick={downloadRotation} className={styles.button}>
            Plan herunterladen
          </button>
        )}
      </div>
      {loader && <Spinner className={styles.spinner} />}
      {msg && <p className={styles.success}>{msg}</p>}
      {store.errorMsg && <p className={styles.error}>{store.errorMsg}</p>}

      {isFullyAssigned && (
        <p className={styles.error}>
          Bitte prüfen Sie die Anzahl der Mitarbeiter und Stationen.
        </p>
      )}
      <ExcelPreview
        ref={previewRef}
        preassigned={toJS(preassigned)}
        specialAssignments={toJS(specialAssignments)}
      />
      {/* List of employees */}
      <h3
        className={styles.groupHeader}
      >{`Verfügbare Mitarbeiter (gesamt) ${store.activeEmployee} | Benötigt ${store.activeStations}`}</h3>
      {Object.entries(groupedEmployees).map(([groupName, groupEmps]) => (
        <section key={groupName} className={styles.groupSection}>
          <h3 className={styles.groupHeader}>Gruppe {groupName}</h3>
          <h3
            className={styles.groupHeader}
          >{`Verfügbare Mitarbeiter ${store.activeEmployeeByGroup[groupName]} | Benötigt ${store.stationsByGroup[groupName]}`}</h3>
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
                    <option value="">Zuweisen</option>
                    <option value="sonder">Sonder</option>
                    {emp.stations.map((station) => (
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
