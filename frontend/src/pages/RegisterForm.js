import { observer } from 'mobx-react-lite';
import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Context } from '../index';
import styles from '../styles/RegisterForm.module.css';

const RegisterForm = () => {
  const { store } = useContext(Context);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [shift, setShift] = useState('');
  const [plant, setPlant] = useState('');
  const [msgType, setMsgType] = useState('');
  const navigate = useNavigate();
  const storeRef = useRef(store);

  const handleGoToLogin = () => {
    navigate('/login');
  };

  useEffect(() => {
    storeRef.current.setAuthMsg('');
  }, []);

  const handleChangeSubmit = async (event) => {
    event.preventDefault();
    try {
      await store.registration(email, password, role, costCenter, shift, plant);
      setMsgType('success');
      store.setAuthMsg('Please check your spam folder.');
    } catch (error) {
      setMsgType('error');
      console.error(error.message);
    }
    setEmail('');
    setPassword('');
  };

  return (
    <>
      <form className={styles.container} onSubmit={handleChangeSubmit}>
        <h2 className={styles.title}>Register</h2>
        <fieldset disabled={msgType} style={{ border: 'none', padding: 0 }}>
          <input
            placeholder="Email"
            className={styles.input}
            value={email}
            type="text"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            placeholder="Password"
            className={styles.input}
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <select
            placeholder="Role"
            className={styles.input}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="" disabled>
              Select role
            </option>
            <option value="GV">GV</option>
            <option value="MEISTER">Meister</option>
            <option></option>
          </select>

          <select
            placeholder="Werk"
            className={styles.input}
            value={plant}
            onChange={(e) => setPlant(e.target.value)}
            required
          >
            <option value="" disabled>
              Werk
            </option>
            <option value="054">054</option>
          </select>

          <select
            placeholder="CostCenter"
            className={styles.input}
            value={costCenter}
            onChange={(e) => setCostCenter(e.target.value)}
            required
          >
            <option value="" disabled>
              Kostenstelle
            </option>
            <option value="395.5">395.5</option>
            <option value="385.5">385.5</option>
            <option value="311.5">311.5</option>
          </select>

          <select
            placeholder="Schicht"
            className={styles.input}
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            required
          >
            <option value="" disabled>
              Schicht
            </option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </select>
        </fieldset>

        <div className={styles.buttonContainer}>
          <button
            type="submit"
            className={`${styles.baseButton} ${styles.primaryButton}`}
          >
            Register
          </button>
          <button
            type="button"
            className={`${styles.baseButton} ${styles.secondaryButton}`}
            onClick={handleGoToLogin}
          >
            Go to Login
          </button>
        </div>
        {store.authMsg && (
          <p className={`${msgType ? styles.success : styles.error}`}>
            {store.authMsg}
          </p>
        )}
      </form>
    </>
  );
};

export default observer(RegisterForm);
