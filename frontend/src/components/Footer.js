import { NavLink } from 'react-router-dom';
import styles from '../styles/Footer.module.css';

const Footer = () => {
  return (
    <div className={styles.container}>
      <NavLink to="mailto:rotationplanservice@gmail.com">Contact</NavLink>
      {/* <NavLink>FAQ</NavLink> */}
      <p>© Rotationplan Service 2025</p>
    </div>
  );
};

export default Footer;
