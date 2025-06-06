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
              Sie sind eingeloggt als {store.user.email}{' '}
              <AiOutlineDownSquare
                title="Email confirmed"
                className={styles.greenicon}
              />{' '}
              autorisiert
            </h3>
          ) : (
            <h3>
              Sie sind eingeloggt als {store.user.email}{' '}
              <AiOutlineExclamationCircle
                title="Bitte bestätige deine E-Mail-Adresse"
                className={styles.redicon}
              />{' '}
              Nicht autorisiert (Bitte bestätige deine E-Mail-Adresse)
            </h3>
          )}
          <button
            className={styles.logoutButton}
            onClick={() => store.logout()}
          >
            Abmelden
          </button>
        </div>
        <Menu />
      </div>
    </div>
  );
};

export default observer(UserAria);
