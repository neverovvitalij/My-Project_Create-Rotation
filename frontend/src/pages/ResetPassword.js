import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { useContext, useState, useEffect, useRef } from 'react';
import { Context } from '../index';
import styles from '../styles/ResetPassword.module.css';

const ResetPassword = () => {
  const { store } = useContext(Context);
  const { token } = useParams();
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!token) {
      storeRef.current.setAuthErrorMsg('Invalid or missing token.');
    }
  }, [token]);

  const handleSubmitResetPassword = async (event) => {
    event.preventDefault();
    store.setAuthErrorMsg('');
    setSuccessMsg('');

    if (password !== newPassword) {
      store.setAuthErrorMsg('Passwords do not match.');
      return;
    }

    const response = await store.resetPassword(token, newPassword);

    if (response.success) {
      setSuccessMsg('Your password has been changed successfully!');
      setTimeout(() => navigate('/'), 3000);
    } else {
      store.setAuthErrorMsg(response.message || 'Error changing password.');
    }
  };

  return (
    <div className={styles.container}>
      {store.authErrorMsg ? (
        <p className={styles.error}>{store.authErrorMsg}</p>
      ) : (
        <form
          className={styles.passwordChangeForm}
          onSubmit={handleSubmitResetPassword}
        >
          <h2 className={styles.title}>Enter new password</h2>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={styles.input}
          />
          {store.authErrorMsg && (
            <p className={styles.error}>{store.authErrorMsg}</p>
          )}
          {successMsg && <p className={styles.success}>{successMsg}</p>}
          <button type="submit" className={styles.button}>
            Change password
          </button>
        </form>
      )}
    </div>
  );
};

export default observer(ResetPassword);
