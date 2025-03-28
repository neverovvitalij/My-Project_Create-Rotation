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
        StationsListe
      </NavLink>
      <NavLink
        to="/dashboard/workersliste"
        className={({ isActive }) =>
          isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
        }
      >
        WorkersListe
      </NavLink>
      <NavLink
        to="/dashboard/rotationplan"
        className={({ isActive }) =>
          isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
        }
      >
        RotationPlan
      </NavLink>
    </nav>
  );
};

export default Menu;
