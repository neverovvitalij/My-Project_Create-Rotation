import { observer } from 'mobx-react-lite';
import { FC, FormEvent, useContext, useState } from 'react';
import { Context } from '../index';
import InfoTip from './InfoTip';
import styles from '../styles/AddNewWorker.module.css';
import { ICandidate, IStore } from '../store/types';

const AddNewWorker: FC = () => {
  const [candidateName, setCandidateName] = useState<string>('');
  const [group, setGroup] = useState<number>(1);
  const [selectedStations, setSelectedStations] = useState<string[]>([]);
  const { store } = useContext(Context) as { store: IStore };

  const handleChangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    const candidate: ICandidate = {
      name: candidateName,
      stations,
      group,
    };
    await store.addWorker(candidate);

    setCandidateName('');
    setGroup(1);
    setSelectedStations([]);
  };

  const handleStationChange = (stationName: string) => {
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
        <InfoTip label="How to assign stations">
          <strong>Tipps zum Hinzufügen von Mitarbeitern:</strong>
          <ul style={{ margin: '6px 0 0 16px' }}>
            <li>Geben Sie den Namen des Mitarbeiters ein.</li>
            <li>Wählen Sie die passende Gruppe aus.</li>
            <li>
              Wählen Sie die Stationen aus, die der Mitarbeiter beherrscht.
            </li>
          </ul>
        </InfoTip>

        <div className={styles.inputRow}>
          <input
            id="name"
            value={candidateName}
            type="text"
            onChange={(e) => setCandidateName(e.target.value)}
            className={`${styles.inputField} ${styles.inputText}`}
            placeholder="Mitarbeiternamen eingeben"
          />

          <select
            className={`${styles.inputField} ${styles.selectField} ${styles.selectNarrow}`}
            value={group}
            onChange={(e) => setGroup(Number(e.target.value))}
            aria-label="Gruppe wählen"
          >
            <option value="" disabled>
              Gruppe wählen
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
              ? 'Alle Stationen abwählen'
              : 'Alle Stationen auswählen'}
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
          Mitarbeiter hinzufügen
        </button>
        {store.errorMsg && (
          <h2 className={styles.errorMsg}>{store.errorMsg}</h2>
        )}
      </form>
    </div>
  );
};

export default observer(AddNewWorker);
