import { observer } from 'mobx-react-lite';
import { useContext, useState } from 'react';
import { Context } from '../index';
import styles from '../styles/AddNewWorker.module.css';

const AddNewWorker = () => {
  const [candidateName, setCandidateName] = useState('');
  const [group, setGroup] = useState('');
  const [role, setRole] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [selectedStations, setSelectedStations] = useState([]);
  const { store } = useContext(Context);

  const handleChangeSubmit = async (event) => {
    event.preventDefault();
    const stations = selectedStations.map((station) => ({
      name: station,
      isActive: true,
    }));

    if (!candidateName) {
      return store.setErrorMsg('Employee name is missing');
    }
    if (!group) {
      return store.setErrorMsg('Employee group is missing');
    }
    if (stations.length <= 0) {
      return store.setErrorMsg('At least one station must be selected');
    }

    const candidate = {
      name: candidateName,
      stations,
      group: parseInt(group, 10),
      role,
      costCenter,
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
            <label htmlFor="name" className={styles.label}>
              Name:
            </label>
            <input
              id="name"
              value={candidateName}
              type="text"
              onChange={(e) => setCandidateName(e.target.value)}
              className={styles.inputField}
              placeholder="Enter worker name"
            />
            <label className={styles.label}>Role:</label>
            <input
              value={role}
              type="text"
              onChange={(e) => setRole(e.target.value)}
              className={styles.inputField}
              placeholder="Enter worker role"
            />
          </div>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Group:</label>
            <input
              className={styles.inputField}
              placeholder="Station group (number > 0)"
              value={group}
              type="number"
              min="1"
              onChange={(e) => setGroup(e.target.value)}
            />
            <label className={styles.label}>CostCenter:</label>
            <input
              className={styles.inputField}
              placeholder="Enter worker CostCenter"
              value={costCenter}
              type="text"
              onChange={(e) => setCostCenter(e.target.value)}
            />
          </div>
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
