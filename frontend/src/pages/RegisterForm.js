import { observer } from 'mobx-react-lite';
import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Context } from '../index';
import styles from '../styles/RegisterForm.module.css';

const RegisterForm = () => {
  const { store } = useContext(Context);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const handleGoToLogin = () => {
    navigate('/login');
  };

  useEffect(() => {
    storeRef.current.setAuthErrorMsg('');
  }, []);

  const handleChangeSubmit = async (event) => {
    event.preventDefault();
    await store.registration(email, password, role, costCenter);
    setEmail('');
    setPassword('');
  };

  return (
    <>
      <form className={styles.container} onSubmit={handleChangeSubmit}>
        <h2 className={styles.title}>Register</h2>
        <input
          placeholder="Email"
          className={styles.input}
          value={email}
          type="text"
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          className={styles.input}
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <select
          placeholder="Role"
          className={styles.input}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="" disabled>
            Select role
          </option>
          <option value="GV">GV</option>
          <option value="MEISTER">Meister</option>
          <option></option>
        </select>
        <select
          placeholder="CostCenter"
          className={styles.input}
          value={costCenter}
          onChange={(e) => setCostCenter(e.target.value)}
          required
        >
          <option value="" disabled>
            Select CostCenter
          </option>
          <option value="395.5">395.5</option>
          <option value="385.5">385.5</option>
          <option value="311.5">311.5</option>
        </select>

        <div className={styles.buttonContainer}>
          <button
            type="submit"
            className={`${styles.baseButton} ${styles.primaryButton}`}
          >
            Register
          </button>
          <button
            type="button"
            className={`${styles.baseButton} ${styles.secondaryButton}`}
            onClick={handleGoToLogin}
          >
            Go to Login
          </button>
        </div>
        {store.authErrorMsg && (
          <p className={styles.error}>{store.authErrorMsg}</p>
        )}
      </form>
    </>
  );
};

export default observer(RegisterForm);
