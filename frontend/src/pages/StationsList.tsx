import { observer } from 'mobx-react-lite';
import {
  useState,
  useContext,
  useEffect,
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
import { usePersistentSet } from '../hooks/usePersistentSet';
import InfoTip from '../components/InfoTip';

const StationsList: FC = () => {
  const [stationName, setStationName] = useState<string>('');
  const [stationPriority, setStationPriority] = useState<number>(1);
  const [stationGroup, setStationGroup] = useState<number>(1);
  const { store } = useContext(Context) as { store: IStore };
  const [showAddStationForm, setShowAddStationForm] = useState<boolean>(false);
  const addStationFormRef = useRef<HTMLFormElement | null>(null);

  const storageKey = `openGroups:stations:${store.user?.id ?? 'anon'}`;
  const {
    has: isOpen,
    toggle: toggleGroup,
    setSet,
  } = usePersistentSet(storageKey);

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

  useEffect(() => {
    const existing = new Set(Object.keys(groupedStations));
    setSet((prev) => new Set([...prev].filter((g) => existing.has(g))));
  }, [groupedStations, setSet]);

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>Stationenliste</h2>

      <div className={styles.stationGroups}>
        {Object.entries(groupedStations).map(([group, stations]) => {
          const grp = String(group);
          const panelId = `actions-panel-${grp}`;

          return (
            <div key={group} className={styles.groupColumn}>
              <h3>Gruppe {group}</h3>
              <button
                type="button"
                className={styles.actionsToggle}
                onClick={() => toggleGroup(grp)}
                aria-expanded={isOpen(grp)}
                aria-controls={panelId}
              >
                {isOpen(grp) ? 'Gruppe ausblenden' : 'Gruppe zeigen'}
                <span className={styles.caret} />
              </button>
              <div
                id={panelId}
                className={`${styles.buttonPanel} ${
                  isOpen(grp) ? styles.open : ''
                }`}
              >
                {stations
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((station) => (
                    <SingleStation station={station} key={station._id} />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
      <button
        disabled={!store.user.isActivated}
        className={styles.toggleButton}
        onClick={toggleAddStationForm}
      >
        {showAddStationForm ? 'Formular ausblenden' : 'Station hinzufügen'}
      </button>
      {showAddStationForm && (
        <form
          onSubmit={handleFormSubmit}
          className={styles.addNewStationContainer}
          ref={addStationFormRef}
        >
          <h3 className={styles.sectionHeader}>
            <InfoTip label="How to assign stations">
              <strong>Tips for assigning stations:</strong>
              <ul style={{ margin: '6px 0 0 16px' }}>
                <li>
                  Alle Stationen der regulären Rotation haben Priorität 1.
                </li>
                <li>
                  Alle Stationen, die ganztägig besetzt werden (z. B.
                  Unterstützer), haben Priorität 2.
                </li>
                <li>
                  Stationen, die ganztägig besetzt werden müssen und die nur
                  sehr wenige Mitarbeitende beherrschen (z. B. B&B), haben
                  Priorität 3.
                </li>
              </ul>
            </InfoTip>
          </h3>
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
      )}
    </div>
  );
};

export default observer(StationsList);
