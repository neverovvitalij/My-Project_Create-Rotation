import { MdDelete } from 'react-icons/md';
import type { IconBaseProps } from 'react-icons';
import { observer } from 'mobx-react-lite';
import { FC, useContext } from 'react';
import { Context } from '../index';
import styles from '../styles/SingleStation.module.css';
import { IStore, IStation } from '../store/types';

type SingleStationProps = {
  station: IStation;
};

const SingleStation: FC<SingleStationProps> = ({ station }) => {
  const { store } = useContext(Context) as { store: IStore };
  const { name, priority, status } = station;
  const Delete = MdDelete as React.FC<IconBaseProps>;

  const generateStars = (count: number) => '★'.repeat(count);

  const deleteStation = async (name: string) => {
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
      <Delete
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
