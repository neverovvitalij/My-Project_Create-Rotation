import { observer } from 'mobx-react-lite';
import {
  useContext,
  useState,
  useEffect,
  useRef,
  FormEvent,
  ChangeEvent,
  FC,
} from 'react';
import { Context } from '../index';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/LoginForm.module.css';

const LoginForm: FC = () => {
  const { store } = useContext(Context);
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    storeRef.current.setAuthMsg('');
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await store.login(email, password);
    } catch (error) {
      store.setAuthMsg('Incorrect data');
      console.error('Login failed:', error);
    } finally {
      setSubmitting(false);
      setEmail('');
      setPassword('');
    }
  };

  const goRegister = () => navigate('/registration');
  const goReset = () => navigate('/reset-password');

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Welcome back</h2>
        <p className={styles.subtitle}>Sign in to your account</p>

        <div className={styles.field}>
          <input
            id="email"
            placeholder=" "
            value={email}
            type="email"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            className={styles.input}
            autoComplete="email"
            required
          />
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
        </div>

        <div className={styles.field}>
          <input
            id="password"
            placeholder=" "
            value={password}
            type={showPw ? 'text' : 'password'}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
            className={styles.input}
            autoComplete="current-password"
            required
          />
          <label htmlFor="password" className={styles.label}>
            Password
          </label>
          <button
            type="button"
            className={styles.eye}
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>

        {store.authMsg && <p className={styles.error}>{store.authMsg}</p>}

        <button
          type="submit"
          className={styles.submit}
          disabled={submitting || !email || !password}
        >
          {submitting ? <span className={styles.spinner} /> : 'Login'}
        </button>

        <div className={styles.actions}>
          <button type="button" className={styles.linkBtn} onClick={goReset}>
            Forgot password?
          </button>
          <span className={styles.dot} />
          <button type="button" className={styles.linkBtn} onClick={goRegister}>
            Create account
          </button>
        </div>
      </form>
    </div>
  );
};

export default observer(LoginForm);
