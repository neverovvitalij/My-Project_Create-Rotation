import { observer } from 'mobx-react-lite';
import { useState, useContext, useRef } from 'react';
import { Context } from '../index';
import SingleStation from '../components/SingleStation';
import styles from '../styles/StationsList.module.css';

const StationsList = () => {
  const [stationName, setStationName] = useState('');
  const [stationPriority, setStationPriority] = useState('');
  const [stationGroup, setStationGroup] = useState('');
  const { store } = useContext(Context);
  const [showAddStationForm, setShowAddStationForm] = useState(false);
  const addStationFormRef = useRef(null);

  const toggleAddStationForm = () => {
    store.setErrorMsg('');
    setShowAddStationForm((prev) => !prev);

    if (!showAddStationForm) {
      setTimeout(() => {
        addStationFormRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    store.setErrorMsg('');

    if (!stationName.trim()) {
      store.setErrorMsg('Please enter the station name.');
      return;
    }
    if (
      !stationPriority.trim() ||
      isNaN(stationPriority) ||
      stationPriority <= 0
    ) {
      store.setErrorMsg('Please enter a valid priority (number > 0).');
      return;
    }

    try {
      const newStation = {
        name: stationName,
        priority: parseInt(stationPriority, 10),
        group: parseInt(stationGroup, 10),
      };
      await store.addNewStation(newStation);
    } catch (error) {
      if (error.respons && error.respons.status === 400) {
        console.error('Station already exists', error.respons.data.message);
        alert(`Station ${stationName} already exists`);
      } else {
        console.error('Error adding station', error);
      }
    }
    setStationName('');
    setStationPriority('');
    setStationGroup('');
  };

  // Dynamic group display
  const groupedStations = store.stations.reduce((groups, station) => {
    const group = station.group || 'Day';
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(station);
    return groups;
  }, {});

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>Station List</h2>

      {/* Dynamic group display */}
      <div className={styles.stationGroups}>
        {Object.entries(groupedStations).map(([group, stations]) => (
          <div key={group} className={styles.groupColumn}>
            <h3>Group {group}</h3>
            {stations
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((station) => (
                <SingleStation station={station} key={station._id} />
              ))}
          </div>
        ))}
      </div>
      <button className={styles.toggleButton} onClick={toggleAddStationForm}>
        {showAddStationForm ? 'hide form' : 'Add station'}
      </button>
      {showAddStationForm && (
        <div className={styles.addNewStationContainer} ref={addStationFormRef}>
          <div className={styles.addStationForm}>
            <form onSubmit={handleFormSubmit}>
              <input
                className={styles.addStationInput}
                placeholder="New station"
                value={stationName}
                type="text"
                required
                onChange={(e) => setStationName(e.target.value)}
              />
              <input
                className={styles.addStationInput}
                placeholder="Station priority (number > 0)"
                value={stationPriority}
                type="number"
                required
                min="1"
                onChange={(e) => setStationPriority(e.target.value)}
              />
              <input
                className={styles.addStationInput}
                placeholder="Station group (number > 0)"
                value={stationGroup}
                type="number"
                min="1"
                onChange={(e) => setStationGroup(e.target.value)}
              />
              <button className={styles.addStationButton} type="submit">
                Add Station
              </button>
              {store.errorMsg && (
                <p className={styles.errorMessage}>{store.errorMsg}</p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default observer(StationsList);
