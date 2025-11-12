import { observer } from 'mobx-react-lite';
import {
  ChangeEvent,
  FC,
  FormEvent,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Context } from '../index';
import Loader from '../UI/Loader';
import styles from '../styles/RegisterForm.module.css';

const RegisterForm: FC = () => {
  const { store } = useContext(Context);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [role, setRole] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [shift, setShift] = useState('');
  const [plant, setPlant] = useState('');

  const [msgType, setMsgType] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current.setAuthMsg('');
  }, []);

  const handleGoToLogin = () => navigate('/login');

  const handleChangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await store.registration(email, password, role, costCenter, shift, plant);
      setMsgType(true);
      store.setAuthMsg('Please check your spam folder.');
      setEmail('');
      setPassword('');
    } catch (error) {
      setMsgType(false);
      console.error('Register failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleChangeSubmit}>
        <h2 className={styles.title}>Create account</h2>
        <p className={styles.subtitle}>Sign up to start planning rotations</p>
        {store.authMsg && (
          <p className={msgType ? styles.success : styles.error}>
            {store.authMsg}
          </p>
        )}
        <fieldset className={styles.fields} disabled={submitting || msgType}>
          {/* Email */}
          <div className={styles.field}>
            <input
              id="email"
              className={styles.input}
              placeholder=" "
              value={email}
              type="email"
              autoComplete="email"
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
            />
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
          </div>

          {/* Password */}
          <div className={styles.field}>
            <input
              id="password"
              className={styles.input}
              placeholder=" "
              value={password}
              type="password"
              autoComplete="new-password"
              required
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
            />
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
          </div>

          <div className={styles.field}>
            <select
              className={styles.select}
              value={role}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setRole(e.target.value)
              }
              required
            >
              <option value="" disabled>
                Role
              </option>
              <option value="GV">GV</option>
              <option value="MEISTER">Meister</option>
            </select>
          </div>

          <div className={styles.field}>
            <select
              className={styles.select}
              value={plant}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setPlant(e.target.value)
              }
              required
            >
              <option value="" disabled>
                Werk
              </option>
              <option value="054">054</option>
            </select>
          </div>

          <div className={styles.field}>
            <select
              className={styles.select}
              value={costCenter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setCostCenter(e.target.value)
              }
              required
            >
              <option value="" disabled>
                Kostenstelle
              </option>
              <option value="395.5">395.5</option>
              <option value="385.5">385.5</option>
              <option value="368.5">368.5</option>
              <option value="311.5">311.5</option>
            </select>
          </div>

          <div className={styles.field}>
            <select
              className={styles.select}
              value={shift}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setShift(e.target.value)
              }
              required
            >
              <option value="" disabled>
                Schicht
              </option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>

          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Registering…' : 'Register'}
          </button>
          {submitting && <Loader compact label="Lade Daten…" />}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={handleGoToLogin}
            >
              Go to Login
            </button>
            <span className={styles.dot} />
            <span className={styles.hint}>Have an account already?</span>
          </div>
        </fieldset>
      </form>
    </div>
  );
};

export default observer(RegisterForm);
