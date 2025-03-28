import { observer } from 'mobx-react-lite';
import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Context } from '../index';
import styles from '../styles/RegisterForm.module.css';

const RegisterForm = () => {
  const { store } = useContext(Context);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const handleGoToLogin = () => {
    navigate('/login');
  };

  useEffect(() => {
    storeRef.current.setAuthErrorMsg('');
  }, []);

  const handleChangeSubmit = (event) => {
    event.preventDefault();
    store.registartion(email, password);
    setEmail('');
    setPassword('');
  };

  return (
    <>
      <form className={styles.authForm} onSubmit={handleChangeSubmit}>
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
        <div className={styles.buttonContainer}>
          <button
            type="submit"
            className={`${styles.baseButton} ${styles.promaryButton}`}
          >
            Register
          </button>
          <button className={`${styles.baseButton} ${styles.secondaryButton}`}>
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
