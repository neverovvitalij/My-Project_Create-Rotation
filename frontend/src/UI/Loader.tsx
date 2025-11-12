import { FC } from 'react';
import styles from '../styles/Loader.module.css';

type LoaderProps = {
  fullscreen?: boolean;
  label?: string;
  compact?: boolean;
};

const Loader: FC<LoaderProps> = ({
  fullscreen = false,
  label = 'Loading…',
  compact = false,
}) => {
  return (
    <div
      className={fullscreen ? styles.backdrop : styles.inline}
      aria-live="polite"
    >
      <div
        className={`${styles.loader} ${compact ? styles.compact : ''}`}
        role="status"
        aria-label={label}
      >
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      {fullscreen && <p className={styles.text}>{label}</p>}
    </div>
  );
};

export default Loader;
