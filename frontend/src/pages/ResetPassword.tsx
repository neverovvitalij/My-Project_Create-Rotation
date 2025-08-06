import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useContext,
  useState,
  useEffect,
  useRef,
  FC,
  FormEvent,
  ChangeEvent,
} from 'react';
import { Context } from '../index';
import styles from '../styles/ResetPassword.module.css';

const ResetPassword: FC = () => {
  const { store } = useContext(Context);
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!token) {
      storeRef.current.setAuthMsg('Invalid or missing token.');
    }
  }, [token]);

  const handleSubmitResetPassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!token) return;

    store.setAuthMsg('');
    setSuccessMsg('');

    if (password !== newPassword) {
      store.setAuthMsg('Passwords do not match.');
      return;
    }

    const response = await store.resetPassword(token, newPassword);

    if (response.success) {
      setSuccessMsg('Your password has been changed successfully!');
      setTimeout(() => navigate('/'), 3000);
    } else {
      store.setAuthMsg(response.message || 'Error changing password.');
    }
  };

  return (
    <form className={styles.container} onSubmit={handleSubmitResetPassword}>
      <h2 className={styles.title}>Enter new password</h2>
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setPassword(e.target.value)
        }
        className={styles.input}
      />
      <input
        type="password"
        placeholder="Confirm password"
        value={newPassword}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setNewPassword(e.target.value)
        }
        className={styles.input}
      />
      {store.authMsg && <p className={styles.error}>{store.authMsg}</p>}
      {successMsg && <p className={styles.success}>{successMsg}</p>}
      <button type="submit" className={styles.button}>
        Change password
      </button>
    </form>
  );
};

export default observer(ResetPassword);
