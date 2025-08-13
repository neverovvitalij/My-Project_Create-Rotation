import { observer } from 'mobx-react-lite';
import {
  useState,
  useContext,
  useRef,
  FC,
  FormEvent,
  useMemo,
  ChangeEvent,
} from 'react';
import { Context } from '../index';
import SingleStation from '../components/SingleStation';
import styles from '../styles/StationsList.module.css';
import { INewStation, IStation, IStore } from '../store/types';

const StationsList: FC = () => {
  const [stationName, setStationName] = useState<string>('');
  const [stationPriority, setStationPriority] = useState<number>(1);
  const [stationGroup, setStationGroup] = useState<number>(1);
  const { store } = useContext(Context) as { store: IStore };
  const [showAddStationForm, setShowAddStationForm] = useState<boolean>(false);
  const addStationFormRef = useRef<HTMLDivElement | null>(null);

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

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    store.setErrorMsg('');

    if (!stationName.trim()) {
      store.setErrorMsg('Please enter the station name.');
      return;
    }
    if (!stationPriority || stationPriority <= 0) {
      store.setErrorMsg('Please enter a valid priority (number > 0).');
      return;
    }

    try {
      const newStation: INewStation = {
        name: stationName,
        priority: stationPriority,
        group: stationGroup,
      };
      await store.addNewStation(newStation);
    } catch (error: unknown) {
      if (error === 'string') {
        console.error(error);
        alert(`Station ${stationName} already exists`);
      } else {
        console.error('Error adding station');
      }
    }
    setStationName('');
    setStationPriority(1);
    setStationGroup(1);
  };

  // Dynamic group display
  const groupedStations = useMemo(() => {
    const groups: Record<string, IStation[]> = {};
    for (const station of store.stations) {
      const key = String(station.group ?? 'Supporters');
      (groups[key] ||= []).push(station);
    }
    Object.values(groups).forEach((list) =>
      list.sort((a, b) => a.name.localeCompare(b.name))
    );
    return groups;
  }, [store.stations]);

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>Stationenliste</h2>

      {/* Dynamic group display */}
      <div className={styles.stationGroups}>
        {Object.entries(groupedStations).map(([group, stations]) => (
          <div key={group} className={styles.groupColumn}>
            <h3>Gruppe {group}</h3>
            {stations
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((station) => (
                <SingleStation station={station} key={station._id} />
              ))}
          </div>
        ))}
      </div>
      <button
        disabled={!store.user.isActivated}
        className={styles.toggleButton}
        onClick={toggleAddStationForm}
      >
        {showAddStationForm ? 'Formular ausblenden' : 'Station hinzufügen'}
      </button>
      {showAddStationForm && (
        <div className={styles.addNewStationContainer} ref={addStationFormRef}>
          <form onSubmit={handleFormSubmit} className={styles.addStationForm}>
            <input
              className={styles.addStationInput}
              placeholder="New station"
              value={stationName}
              type="text"
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setStationName(e.target.value)
              }
            />
            <select
              className={styles.addStationInput}
              value={stationPriority}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setStationPriority(Number(e.target.value))
              }
            >
              <option value="" disabled>
                Priorität
              </option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
            <select
              className={styles.addStationInput}
              value={stationGroup}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setStationGroup(Number(e.target.value))
              }
            >
              <option value="" disabled>
                Gruppe
              </option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
            <button className={styles.addStationButton} type="submit">
              Station hinzufügen
            </button>
            {store.errorMsg && (
              <p className={styles.errorMessage}>{store.errorMsg}</p>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default observer(StationsList);
