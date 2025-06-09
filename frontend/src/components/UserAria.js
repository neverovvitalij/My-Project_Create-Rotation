import { MdDarkMode, MdLightMode } from 'react-icons/md';
import { observer } from 'mobx-react-lite';
import {
  AiOutlineDownSquare,
  AiOutlineExclamationCircle,
} from 'react-icons/ai';
import { useContext, useEffect, useState } from 'react';
import { Context } from '../index';
import Menu from './Menu';
import styles from '../styles/UserAria.module.css';

const UserAria = () => {
  const { store } = useContext(Context);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Menu />
        <div className={styles.userInfo}>
          {store.isAuth && store.user.isActivated ? (
            <h3>
              {store.user.email}{' '}
              <AiOutlineDownSquare
                title="Email confirmed"
                className={styles.greenicon}
              />{' '}
            </h3>
          ) : (
            <h3>
              {store.user.email}{' '}
              <AiOutlineExclamationCircle
                title="Bitte bestätige deine E-Mail-Adresse"
                className={styles.redicon}
              />{' '}
              bestätige deine E-Mail
            </h3>
          )}
          <button
            className={styles.logoutButton}
            onClick={() => store.logout()}
          >
            Abmelden
          </button>
          <button className={styles.themeToggle} onClick={toggleTheme}>
            {theme === 'dark' ? <MdLightMode /> : <MdDarkMode />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default observer(UserAria);
