import { observer } from 'mobx-react-lite';
import { useState, useEffect, useContext, useRef, FC, useMemo } from 'react';
import { Context } from '../index';
import SingleWorker from '../components/SingleWorker';
import AddNewWorker from '../components/AddNewWorker';
import { usePersistentSet } from '../hooks/usePersistentSet';
import styles from '../styles/WorkersList.module.css';
import { IEmployee, IStore } from '../store/types';

const WorkersList: FC = () => {
  const { store } = useContext(Context) as { store: IStore };
  const [showAddWorkerForm, setShowAddWorkerForm] = useState<boolean>(false);
  const [activeWorker, setActiveWorker] = useState<IEmployee['_id'] | null>(
    null
  );
  const addWorkerFromRef = useRef<HTMLDivElement | null>(null);

  const storageKey = `openGroups:employee:${store.user?.id ?? 'anon'}`;
  const {
    has: isOpen,
    toggle: toggleGroup,
    setSet,
  } = usePersistentSet(storageKey);

  const toggleAddWorkerFrom = () => {
    store.setErrorMsg('');
    setShowAddWorkerForm((prev) => !prev);

    if (!showAddWorkerForm) {
      setTimeout(() => {
        addWorkerFromRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    }
  };

  const groupedEmployees = useMemo(
    () =>
      store.employeeList.reduce<Record<number, IEmployee[]>>((acc, worker) => {
        (acc[worker.group] ??= []).push(worker);
        return acc;
      }, {}),
    [store.employeeList]
  );

  useEffect(() => {
    const existing = new Set(Object.keys(groupedEmployees));
    setSet((prev) => new Set([...prev].filter((g) => existing.has(g))));
  }, [groupedEmployees, setSet]);

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>Mitarbeiterliste</h2>
      <div className={styles.workersGrid}>
        {store.employeeList.length > 0 ? (
          Object.entries(groupedEmployees).map(([group, workers]) => {
            const grp = String(group);
            const panelId = `actions-panel-${grp}`;
            return (
              <div className={styles.groupColumn} key={group}>
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
                  {workers
                    .slice()
                    .sort((a, b) =>
                      a.name.localeCompare(b.name, undefined, {
                        numeric: true,
                        sensitivity: 'base',
                      })
                    )
                    .map((worker) => (
                      <SingleWorker
                        worker={worker}
                        key={worker._id}
                        activeWorker={activeWorker}
                        setActiveWorker={setActiveWorker}
                      />
                    ))}
                </div>
              </div>
            );
          })
        ) : (
          <p className={styles.noWorkersMessage}>
            Keine Mitarbeiter gefunden. Bitte füge neue hinzu
          </p>
        )}
      </div>
      <button
        disabled={!store.user.isActivated}
        className={styles.toggleButton}
        onClick={toggleAddWorkerFrom}
      >
        {showAddWorkerForm ? 'Formular ausblenden' : 'Mitarbeiter hinzufügen'}
      </button>
      {showAddWorkerForm && (
        <div className={styles.addNewWorkerContainer} ref={addWorkerFromRef}>
          <AddNewWorker />
        </div>
      )}
    </div>
  );
};

export default observer(WorkersList);
