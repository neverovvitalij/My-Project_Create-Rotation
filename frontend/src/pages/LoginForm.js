import { observer } from 'mobx-react-lite';
import { useContext, useState, useEffect, useRef } from 'react';
import { Context } from '../index';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/LoginForm.module.css';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { store } = useContext(Context);
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const handleGoToRegister = () => {
    navigate('/registration');
  };

  useEffect(() => {
    storeRef.current.setAuthErrorMsg('');
  }, []);

  const handleChangeSubmit = async (event) => {
    event.preventDefault();

    try {
      await store.login(email, password);
    } catch (error) {
      store.setAuthErrorMsg('Incorrect data');
      console.error('Login failed:', error);
    } finally {
      setEmail('');
      setPassword('');
    }
  };

  const handleRequestResetPassword = () => {
    navigate('/reset-password');
  };

  return (
    <>
      <form className={styles.container} onSubmit={handleChangeSubmit}>
        <h2 className={styles.title}>Login</h2>
        <input
          placeholder="Email"
          value={email}
          type="text"
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />
        <input
          placeholder="Password"
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
        />
        <div className={styles.buttonContainer}>
          <button
            type="submit"
            className={`${styles.baseButton} ${styles.primaryButton}`}
          >
            Login
          </button>
        </div>
        {store.authErrorMsg && (
          <p className={styles.error}>{store.authErrorMsg}</p>
        )}
        <button
          type="button"
          className={`${styles.baseButton} ${styles.secondaryButton}`}
          onClick={handleRequestResetPassword}
        >
          Forgot password?
        </button>
        <button
          type="button"
          className={`${styles.baseButton} ${styles.secondaryButton}`}
          onClick={handleGoToRegister}
        >
          Go to registration
        </button>
      </form>
    </>
  );
};

export default observer(LoginForm);
