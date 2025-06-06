import { NavLink } from 'react-router-dom';
import styles from '../styles/Menu.module.css';

const Menu = () => {
  return (
    <nav className={styles.container}>
      <NavLink
        to="/dashboard"
        end
        className={({ isActive }) =>
          isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
        }
      >
        Stationenliste
      </NavLink>
      <NavLink
        to="/dashboard/workersliste"
        className={({ isActive }) =>
          isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
        }
      >
        Mitarbeiterliste
      </NavLink>
      <NavLink
        to="/dashboard/rotationplan"
        className={({ isActive }) =>
          isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
        }
      >
        Rotationsplan
      </NavLink>
    </nav>
  );
};

export default Menu;
