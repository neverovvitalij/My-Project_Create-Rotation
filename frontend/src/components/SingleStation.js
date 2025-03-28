import { MdDelete } from 'react-icons/md';
import { observer } from 'mobx-react-lite';
import { useContext } from 'react';
import { Context } from '../index';
import styles from '../styles/SingleStation.module.css';

const SingleStation = ({ station }) => {
  const { store } = useContext(Context);
  const { name, priority, status } = station;

  const generateStars = (count) => '★'.repeat(count);

  const deleteStation = async (name) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the station "${name}"?`
    );
    if (confirmDelete) {
      try {
        await store.deleteStation(name);
      } catch (error) {
        console.error('Error deleting the station:', error);
        alert('Could not delete the station.');
      }
    }
  };

  const handleCheck = async () => {
    const newStatus = !status;
    await store.changeStationStatus(name, newStatus);
  };

  return (
    <div className={styles.stationCard}>
      <span className={styles.stationName}>{name}</span>
      <p className={styles.stationPriority}>{generateStars(priority)}</p>
      <MdDelete
        className={styles.deleteIcon}
        title="Delete station"
        onClick={() => deleteStation(name)}
      />
      <input
        type="checkbox"
        className={styles.inputCheckbox}
        checked={status}
        onChange={() => handleCheck()}
      />
    </div>
  );
};

export default observer(SingleStation);
