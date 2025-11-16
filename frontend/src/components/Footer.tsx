import styles from '../styles/Footer.module.css';

const Footer = () => {
  return (
    <div className={styles.footer}>
      <div className={styles.inner}>
        <a className={styles.link} href="mailto:rotationplanservice@gmail.com">
          Contact
        </a>
        <span className={styles.copy}>© Rotationplan Service 2025</span>
      </div>
    </div>
  );
};

export default Footer;
