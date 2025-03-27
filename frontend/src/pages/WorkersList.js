import { observer } from 'mobx-react-lite';
import { useState, useContext, useRef } from 'react';
import { Context } from '../index';
import SingleWorker from '../components/SingleWorker';
import AddNewWorker from '../components/AddNewWorker';
import styles from '../styles/WorkersList.module.css';

const WorkersList = () => {
  const { store } = useContext(Context);
  const [showAddWorkerForm, setShowAddWorkerForm] = useState(false);
  const [activeWorker, setActiveWorker] = useState(null);
  const addWorkerFromRef = useRef(null);

  const toggleAddWorkerFrom = () => {
    store.setErrorMsg('');
    setShowAddWorkerForm((prev) => !prev);

    if (!showAddWorkerForm) {
      setTimeout(() => {
        addWorkerFromRef.current.scrollIntoView({
          behavior: 'smoth',
          block: 'start',
        });
      }, 100);
    }
  };

  const groupedEmploees = store.employeeList.reduce((groups, employee) => {
    const group = employee.group;
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(employee);
    return groups;
  }, {});

  return (
    <div className={styles.container}>
      <h2 className={styles.header}>Employee List</h2>
      <div className={styles.workersGrid}>
        {store.employeeList.length > 0 ? (
          Object.entries(groupedEmploees).map(([group, employees]) => (
            <div className={styles.groupColumn} key={group}>
              <h3>Group {group}</h3>
              {employees
                .slice()
                .sort((a, b) => a.name.localCompare(b.name))
                .map((employee) => (
                  <SingleWorker
                    worker={employee}
                    key={employee._id}
                    activeWorker={activeWorker}
                    setActiveWorker={setActiveWorker}
                  />
                ))}
            </div>
          ))
        ) : (
          <p className={styles.noWorkersMessage}>
            No employees found. Please add new ones.
          </p>
        )}
      </div>
      <button className={styles.toggleButton} onClick={toggleAddWorkerFrom}>
        {showAddWorkerForm ? 'Hide form' : 'Add worker'}
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
