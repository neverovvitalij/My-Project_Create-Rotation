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

    const res = await store.requestResetPassword(email);

    if (res.success) {
      setEmail('');
      setSuccessMsg('An email has been sent. Please check your mailbox.');
    } else {
      store.setAuthMsg(res.message || 'Unknown error');
    }
    setServerResponse(false);
  };

  return (
    <div className={styles.wrapper}>
      <form className={styles.card} onSubmit={handleSubmitReqChangePass}>
        <h2 className={styles.title}>Change Password</h2>
        <p className={styles.subtitle}>Request a password reset link</p>

        <div className={styles.field}>
          <input
            id="email"
            value={email}
            type="email"
            placeholder=" "
            autoComplete="email"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            className={styles.input}
            required
          />
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
        </div>

        <button
          type="submit"
          disabled={serverResponse}
          className={styles.submit}
        >
          {serverResponse ? 'Sending…' : 'Send Email'}
        </button>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => navigate('/')}
            className={styles.linkBtn}
          >
            Home
          </button>
          {serverResponse && <Spinner className={styles.spinner} />}
        </div>

        {store.authMsg && <p className={styles.error}>{store.authMsg}</p>}
        {successMsg && <p className={styles.success}>{successMsg}</p>}
      </form>
    </div>
  );
};

export default observer(ReqResPassword);
