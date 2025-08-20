import { observer } from 'mobx-react-lite';
import { MdDelete, MdUpdate } from 'react-icons/md';
import type { IconBaseProps } from 'react-icons';
import { FC, useContext, useState } from 'react';
import { Context } from '../index';
import styles from '../styles/SingleWorker.module.css';
import { IEmployee, IStore } from '../store/types';

type WorkerId = IEmployee['_id'];

type SingleEmployeeProps = {
  worker: IEmployee;
  activeWorker: WorkerId | null;
  setActiveWorker: React.Dispatch<React.SetStateAction<WorkerId | null>>;
};
const SingleWorker: FC<SingleEmployeeProps> = ({
  worker,
  activeWorker,
  setActiveWorker,
}) => {
  const { store } = useContext(Context) as { store: IStore };
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [complete, setComplete] = useState<boolean>(false);
  const Delete = MdDelete as React.FC<IconBaseProps>;
  const Update = MdUpdate as React.FC<IconBaseProps>;

  const toggleStationVisibility = () => {
    setActiveWorker((prev) => (prev === worker._id ? null : worker._id));
  };

  const removeStationFromWorker = async (
    name: string,
    stationToRemove: string
  ) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to remove station "${stationToRemove}"?`
    );
    if (confirmDelete) {
      try {
        await store.removeStationFromWorker(name, stationToRemove);
      } catch (error) {
        console.error('Could not remove station');
        alert('Could not remove station');
      }
    }
  };

  const deleteWorker = async (name: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete employee "${name}"?`
    );
    if (confirmDelete) {
      try {
        await store.deleteWorker(name);
      } catch (error) {
        console.error('Could not delete employee', error);
        alert('Could not delete employee');
      }
    }
  };

  const handleAddStation = (stationName: string) => {
    setSelectedStation(stationName);
    setComplete(false);
  };

  const handleSubmitAddStation = async () => {
    if (!selectedStation) return;

    try {
      await store.addStationToWorker(worker.name, selectedStation);
      setSelectedStation('');
      setComplete(true);
    } catch (error) {
      console.error('Could not add station', error);
      alert('Could not add station');
    }
  };

  const stationsVisible = activeWorker === worker._id;

  return (
    <li
      className={`${styles.workerCard} ${stationsVisible ? styles.open : ''}`}
    >
      <span>{worker.name}</span>

      <button
        type="button"
        className={`${styles.iconBtn} ${styles.iconBtnNeutral}`}
        onClick={toggleStationVisibility}
        aria-label="Show stations"
      >
        <Update />
      </button>

      <button
        type="button"
        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
        onClick={() => deleteWorker(worker.name)}
        aria-label="Delete worker"
      >
        <Delete />
      </button>

      <ol
        className={`${styles.stationsList} ${
          stationsVisible ? styles.active : ''
        }`}
      >
        {worker.stations
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((station, index) => (
            <li key={index} className={styles.stationItem}>
              {station.name}
              <button
                type="button"
                className={`${styles.iconBtnSm} ${styles.iconBtnDanger}`}
                onClick={() =>
                  removeStationFromWorker(worker.name, station.name)
                }
                aria-label={`Remove ${station.name}`}
              >
                <Delete />
              </button>
            </li>
          ))}
        <select
          className={styles.stationSelect}
          value={selectedStation}
          onChange={(e) => handleAddStation(e.target.value)}
        >
          <option value="" disabled>
            Station wählen
          </option>
          {store.stations
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(
              (station) =>
                !worker.stations.map((s) => s.name).includes(station.name)
            )
            .map((station) => (
              <option key={station._id} value={station.name}>
                {station.name}
              </option>
            ))}
        </select>
        {selectedStation && (
          <button className={styles.addButton} onClick={handleSubmitAddStation}>
            Add station
          </button>
        )}
        {complete && ` ✅ Ok`}
      </ol>
    </li>
  );
};

export default observer(SingleWorker);
