import { observer } from 'mobx-react-lite';
import {
  useContext,
  useState,
  useRef,
  useEffect,
  FC,
  FormEvent,
  ChangeEvent,
} from 'react';
import { FaSpinner } from 'react-icons/fa';
import type { IconBaseProps } from 'react-icons';
import { useNavigate } from 'react-router-dom';
import { Context } from '../index';
import styles from '../styles/ReqResPassword.module.css';

const ReqResPassword: FC = () => {
  const { store } = useContext(Context);
  const [email, setEmail] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [serverResponse, setServerResponse] = useState(false);
  const navigate = useNavigate();
  const storeRef = useRef(store);
  const Spinner = FaSpinner as React.FC<IconBaseProps>;

  useEffect(() => {
    storeRef.current.setAuthMsg('');
  }, []);

  const handleSubmitReqChangePass = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    setSuccessMsg('');
    store.setAuthMsg('');
    setServerResponse(true);

    const response = await store.requestResetPassword(email);

    if (response.success) {
      setEmail('');
      setSuccessMsg('An email has been sent. Please check your mailbox.');
    } else {
      store.setAuthMsg(response.message || 'Unknown error');
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
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setEmail(e.target.value)
        }
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
      {serverResponse && <Spinner className={styles.spinner} />}
      {store.authMsg && <p className={styles.error}>{store.authMsg}</p>}
      {successMsg && <p className={styles.success}>{successMsg}</p>}
    </form>
  );
};

export default observer(ReqResPassword);
