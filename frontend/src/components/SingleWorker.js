import { observer } from 'mobx-react-lite';
import { MdDelete, MdUpdate } from 'react-icons/md';
import { useContext, useState } from 'react';
import { Context } from '../index';
import styles from '../styles/SingleWorker.module.css';

const SingleWorker = ({ worker, activeWorker, setActiveWorker }) => {
  const { store } = useContext(Context);
  const [selectedStation, setSelectedStation] = useState('');
  const [complete, setComplete] = useState('');
  const toggleStationVisibility = () => {
    setActiveWorker((prev) => (prev === worker._id ? null : worker._id));
  };

  const removeStationFromWorker = async (name, stationToRemove) => {
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

  const deleteWorker = async (name) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete employee "${name}"?`
    );
    if (confirmDelete) {
      try {
        await store.deleteWorker(name);
      } catch (error) {
        console.error('Could not delete employee', error.message);
        alert('Could not delete employee');
      }
    }
  };

  const handleAddStation = (stationName) => {
    setSelectedStation(stationName);
    setComplete('');
  };

  const handleSubmitAddStation = async () => {
    if (!selectedStation) return;

    try {
      await store.addStationToWorker(worker.name, selectedStation);
      setSelectedStation('');
      setComplete(true);
    } catch (error) {
      console.error('Could not add station', error.message);
      alert('Could not add station');
    }
  };

  const stationsVisible = activeWorker === worker._id;

  return (
    <li className={styles.workerCard}>
      <div>{worker.name}</div>
      <MdUpdate
        className={styles.updateIcon}
        onClick={toggleStationVisibility}
      />
      <MdDelete
        className={styles.deleteIcon}
        onClick={() => deleteWorker(worker.name)}
      />
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
              <MdDelete
                className={styles.deleteIcon2}
                onClick={() =>
                  removeStationFromWorker(worker.name, station.name)
                }
              />
            </li>
          ))}
        <select
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
