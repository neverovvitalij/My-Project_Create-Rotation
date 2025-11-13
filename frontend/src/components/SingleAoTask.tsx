import { MdDelete } from 'react-icons/md';
import type { IconBaseProps } from 'react-icons';
import { observer } from 'mobx-react-lite';
import { FC, useContext } from 'react';
import { Context } from '../index';
import styles from '../styles/SingleStation.module.css';
import { IStore, IAo } from '../store/types';

type SingleStationProps = {
  aoTask: IAo;
};

const SingleStation: FC<SingleStationProps> = ({ aoTask }) => {
  const { store } = useContext(Context) as { store: IStore };
  const { name, status, group } = aoTask;
  const Delete = MdDelete as React.FC<IconBaseProps>;

  const deleteAoTask = async (name: string) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the AO "${name}"?`
    );
    if (confirmDelete) {
      try {
        await store.deleteAo(name, group);
      } catch (error) {
        console.error('Error deleting the AO:', error);
        alert('Could not delete the AO.');
      }
    }
  };

  const handleCheck = async () => {
    const newStatus = !status;
    await store.changeStatusAoTask(name, newStatus, group);
  };

  return (
    <div className={styles.stationCard}>
      <span className={styles.stationName}>{name}</span>
      <Delete
        className={styles.deleteIcon}
        title="Delete station"
        onClick={() => deleteAoTask(name)}
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
