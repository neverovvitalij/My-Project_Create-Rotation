import { observer } from 'mobx-react-lite';
import {
  AiOutlineDownSquare,
  AiOutlineExclamationCircle,
} from 'react-icons/ai';
import { useContext } from 'react';
import { Context } from '../index';
import Menu from './Menu';
import styles from '../styles/UserAria.module.css';

const UserAria = () => {
  const { store } = useContext(Context);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          {store.isAuth && store.user.isActivated ? (
            <h3>
              You are logged in as {store.user.email}{' '}
              <AiOutlineDownSquare
                title="Email confirmed"
                className={styles.greenicon}
              />{' '}
              authorized
            </h3>
          ) : (
            <h3>
              You are logged in as {store.user.email}{' '}
              <AiOutlineExclamationCircle
                title="Please confirm your email!"
                className={styles.redicon}
              />{' '}
              authorized (please confirm your email)
            </h3>
          )}
          <button
            className={styles.logoutButton}
            onClick={() => store.logout()}
          >
            Logout
          </button>
        </div>
        <Menu />
      </div>
    </div>
  );
};

export default observer(UserAria);
