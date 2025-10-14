import React, { useId, useState } from 'react';
import styles from '../styles/InfoTip.module.css';

type Props = {
  label?: string;
  children: React.ReactNode;
};

export default function InfoTip({ label = 'Help', children }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((v) => !v);

  return (
    <span className={styles.wrapper}>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={toggle}
      >
        i
      </button>

      <div
        id={id}
        role="tooltip"
        className={`${styles.tooltip} ${open ? styles.show : ''}`}
      >
        {children}
        <span className={styles.arrow} aria-hidden />
      </div>
    </span>
  );
}
