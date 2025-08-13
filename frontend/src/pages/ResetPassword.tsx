import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { useContext, useState, useEffect, useRef, FC, FormEvent } from 'react';
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
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmitResetPassword}>
        <h2 className={styles.title}>Enter new password</h2>
        <p className={styles.subtitle}>
          Set a strong password you won’t forget
        </p>

        <div className={styles.field}>
          <input
            id="newpass"
            type="password"
            placeholder=" "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            required
          />
          <label htmlFor="newpass" className={styles.label}>
            New password
          </label>
        </div>

        <div className={styles.field}>
          <input
            id="confirm"
            type="password"
            placeholder=" "
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={styles.input}
            required
          />
          <label htmlFor="confirm" className={styles.label}>
            Confirm password
          </label>
        </div>

        <button type="submit" className={styles.submit}>
          Change password
        </button>

        {store.authMsg && <p className={styles.error}>{store.authMsg}</p>}
        {successMsg && <p className={styles.success}>{successMsg}</p>}
      </form>
    </div>
  );
};

export default observer(ResetPassword);
