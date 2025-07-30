import { observer } from 'mobx-react-lite';
import {
  useContext,
  useState,
  useEffect,
  useRef,
  FormEvent,
  FC,
  ChangeEvent,
} from 'react';
import { Context } from '../index';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/LoginForm.module.css';

const LoginForm: FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { store } = useContext(Context);
  const navigate = useNavigate();
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current.setAuthMsg('');
  }, []);

  const handleChangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await store.login(email, password);
    } catch (error) {
      store.setAuthMsg('Incorrect data');
      console.error('Login failed:', error);
    } finally {
      setEmail('');
      setPassword('');
    }
  };

  const handleGoToRegister = () => {
    navigate('/registration');
  };

  const handleRequestResetPassword = () => {
    navigate('/reset-password');
  };

  return (
    <form className={styles.container} onSubmit={handleChangeSubmit}>
      <h2 className={styles.title}>Login</h2>
      <input
        placeholder="Email"
        value={email}
        type="text"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setEmail(e.target.value)
        }
        className={styles.input}
      />
      <input
        placeholder="Password"
        value={password}
        type="password"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setPassword(e.target.value)
        }
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
      {store.authMsg && <p className={styles.error}>{store.authMsg}</p>}
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
  );
};

export default observer(LoginForm);
