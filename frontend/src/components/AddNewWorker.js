import { observer } from 'mobx-react-lite';
import { useContext, useState } from 'react';
import { Context } from '../index';
import styles from '../styles/AddNewWorker.module.css';

const AddNewWorker = () => {
  const [candidateName, setCandidateName] = useState('');
  const [group, setGroup] = useState('');
  const [selectedStations, setSelectedStations] = useState([]);
  const { store } = useContext(Context);

  const handleChangeSubmit = async (event) => {
    event.preventDefault();
    const stations =
      selectedStations.map((station) => ({
        name: station,
        isActive: true,
      })) || [];

    if (!candidateName) {
      return store.setErrorMsg('Employee name is missing');
    }
    if (!group) {
      return store.setErrorMsg('Employee group is missing');
    }

    const candidate = {
      name: candidateName,
      stations,
      group: parseInt(group, 10),
    };
    await store.addWorker(candidate);

    setCandidateName('');
    setGroup('');
    setSelectedStations([]);
  };

  const handleStationChange = (stationName) => {
    setSelectedStations((prevSelectedStation) => {
      if (prevSelectedStation.includes(stationName)) {
        return prevSelectedStation.filter((s) => s !== stationName);
      } else {
        return [...prevSelectedStation, stationName];
      }
    });
  };

  const handleSelectAllStations = () => {
    if (selectedStations.length === store.stations.length) {
      setSelectedStations([]);
    } else {
      setSelectedStations(store.stations.map((station) => station.name));
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleChangeSubmit} className={styles.form}>
        <div className={styles.inputRow}>
          <div className={styles.inputGroup}>
            <input
              htmlFor="name"
              id="name"
              value={candidateName}
              type="text"
              onChange={(e) => setCandidateName(e.target.value)}
              className={styles.inputField}
              placeholder="Enter worker name"
            />
          </div>
          <select
            className={styles.inputField}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="" disabled>
              Grupe wählen
            </option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </div>

        <div className={styles.stationSelection}>
          <button
            type="button"
            onClick={handleSelectAllStations}
            className={styles.toggleStationsButton}
          >
            {selectedStations.length === store.stations.length
              ? 'Deselect All Stations'
              : 'Select All Stations'}
          </button>

          <div className={styles.stationsList}>
            {store.stations.length > 0 ? (
              store.stations
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((station) => (
                  <div
                    key={station._id}
                    className={`${styles.stationItem} ${
                      selectedStations.includes(station.name)
                        ? styles.selected
                        : ''
                    }`}
                    onClick={() => handleStationChange(station.name)}
                  >
                    <label className={styles.stationLabel}>
                      <input
                        type="checkbox"
                        checked={selectedStations.includes(station.name)}
                        onChange={(e) => e.stopPropagation()}
                        className={styles.stationCheckbox}
                      />
                      {station.name}
                    </label>
                  </div>
                ))
            ) : (
              <div className={styles.noStations}>No stations available</div>
            )}
          </div>
        </div>

        <button type="submit" className={styles.submitButton}>
          Add Worker
        </button>
        {store.errorMsg && (
          <h2 className={styles.errorMsg}>{store.errorMsg}</h2>
        )}
      </form>
    </div>
  );
};

export default observer(AddNewWorker);
