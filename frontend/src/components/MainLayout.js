import { Outlet } from 'react-router-dom';
import styles from '../styles/MainLayout.module.css';

const MainLayout = () => {
  return (
    <div className={styles.mainContainer}>
      <Outlet />
    </div>
  );
};

export default MainLayout;
