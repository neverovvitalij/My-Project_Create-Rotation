import { MdDarkMode, MdLightMode } from 'react-icons/md';
import type { IconBaseProps } from 'react-icons';
import { observer } from 'mobx-react-lite';
import {
  AiOutlineDownSquare,
  AiOutlineExclamationCircle,
} from 'react-icons/ai';
import { FC, useContext, useEffect, useState } from 'react';
import { Context } from '../index';
import Menu from './Menu';
import styles from '../styles/UserAria.module.css';
import { IStore } from '../store/types';

const UserAria: FC = () => {
  const { store } = useContext(Context) as { store: IStore };
  const [theme, setTheme] = useState<string>('dark');
  const DarkMode = MdDarkMode as React.FC<IconBaseProps>;
  const LightMode = MdLightMode as React.FC<IconBaseProps>;
  const OkIcon = AiOutlineDownSquare as React.FC<IconBaseProps>;
  const WarnIcon = AiOutlineExclamationCircle as React.FC<IconBaseProps>;

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
              <OkIcon title="Email confirmed" className={styles.greenicon} />{' '}
            </h3>
          ) : (
            <h3>
              {store.user.email}{' '}
              <WarnIcon
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
            {theme === 'dark' ? <LightMode /> : <DarkMode />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default observer(UserAria);
