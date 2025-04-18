import { observer } from 'mobx-react-lite';
import { useContext, useState, useRef, useEffect } from 'react';
import { FaSpinner } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Context } from '../index';
import styles from '../styles/ReqResPassword.module.css';

const ReqResPassword = () => {
  const { store } = useContext(Context);
  const [email, setEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [serverResponse, setServerResponse] = useState(false);
  const navigate = useNavigate();
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current.setAuthErrorMsg('');
  }, []);

  const handleSubmitReqChangePass = async (event) => {
    event.preventDefault();
    setSuccessMsg('');
    store.setAuthErrorMsg('');
    setServerResponse(true);

    const response = await store.requestResetPassword(email);

    if (response.success) {
      setEmail('');
      setSuccessMsg('An email has been sent. Please check your mailbox.');
    } else {
      store.setAuthErrorMsg(response.message || 'Unknown error');
    }
    setServerResponse(false);
  };

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return (
    <form className={styles.container} onSubmit={handleSubmitReqChangePass}>
      <h2 className={styles.title}>Change Password</h2>
      <input
        value={email}
        type="email"
        onChange={(e) => setEmail(e.target.value)}
        className={styles.input}
      />
      <div className={styles.buttonContainer}>
        <button
          type="submit"
          disabled={serverResponse}
          className={`${styles.baseButton} ${styles.primaryButton}`}
        >
          Send Email
        </button>
      </div>
      <button
        type="button"
        onClick={handleGoToDashboard}
        className={`${styles.baseButton} ${styles.secondaryButton}`}
      >
        Home
      </button>
      {serverResponse && <FaSpinner className={styles.spinner} />}
      {store.authErrorMsg && (
        <p className={styles.error}>{store.authErrorMsg}</p>
      )}
      {successMsg && <p className={styles.success}>{successMsg}</p>}
    </form>
  );
};

export default observer(ReqResPassword);
