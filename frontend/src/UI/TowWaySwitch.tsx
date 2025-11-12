import { useId } from 'react';
import { FC } from 'react';
import cn from 'clsx';
import styles from '../styles/TowWaySwitch.module.css';

type Side = 'left' | 'right';

type TwoWaySwitchProps = {
  left: string;
  right: string;
  value: Side;
  onChange: (next: Side) => void;
  name?: string;
  className?: string;
};

const TowWaySwitch = ({
  left,
  right,
  value,
  onChange,
  name,
  className,
}: TwoWaySwitchProps) => {
  const gid = useId();
  const nameSafe = name ?? gid;

  return (
    <div
      className={cn(styles.segmented, className)}
      role="radiogroup"
      aria-label={`${left} / ${right}`}
      data-value={value}
    >
      <div className={styles.thumb} aria-hidden={true} />

      <input
        className={styles.srOnly}
        type="radio"
        id={`${gid}-left`}
        name={nameSafe}
        checked={value === 'left'}
        onChange={() => onChange('left')}
      />
      <label
        htmlFor={`${gid}-left`}
        className={cn(styles.segment, value === 'left' && styles.active)}
      >
        {left}
      </label>

      <input
        className={styles.srOnly}
        type="radio"
        id={`${gid}-right`}
        name={nameSafe}
        checked={value === 'right'}
        onChange={() => onChange('right')}
      />
      <label
        htmlFor={`${gid}-right`}
        className={cn(styles.segment, value === 'right' && styles.active)}
      >
        {right}
      </label>
    </div>
  );
};

export default TowWaySwitch;
