import { useState } from 'react';
import styles from '../styles/Dropdown.module.css';

const Dropdown = ({ options, onSelect, label }) => {
  const [selected, setSelected] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (option) => {
    setSelected(option);
    setIsOpen(false);

    if (onSelect) {
      onSelect(option);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setIsOpen(!isOpen)}>
        {selected || label}
      </div>
      {isOpen && (
        <ul className={styles.dropdownList}>
          {options.map((option, indx) => (
            <li
              key={indx}
              className={styles.dropdownItem}
              onClick={() => handleSelect(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
