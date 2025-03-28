import { observer } from 'mobx-react-lite';
import { FaSpinner } from 'react-icons/fa';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { useContext, useEffect, useRef } from 'react';
import { Context } from './index';
import MainLayout from './components/MainLayout';
import StationsListe from './pages/StationsList';
import WorkersListe from './pages/WorkersList';
import RotationPlan from './pages/RotationPlan';
import UserAria from './components/UserAria';
import LoginForm from './pages/LoginForm';
import RegisterForm from './pages/RegisterForm';
import ReqResPassword from './pages/ReqResPassword';
import ResetPassword from './pages/ResetPassword';
import styles from './App.module.css';

function AuthGuard({ children }) {
  const { store } = useContext(Context);
  const location = useLocation();

  if (store.isInitializing) {
    return (
      <div className={styles.App}>
        <FaSpinner className={styles.spinner} />
      </div>
    );
  }
  if (!store.isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function App() {
  const { store } = useContext(Context);
  const storeRef = useRef(store);

  useEffect(() => {
    if (localStorage.getItem('token')) {
      storeRef.current.checkAuth();
    }
    store.setIsInitializing(false);
  }, [store]);

  useEffect(() => {
    if (store.isAuth && store.user.isActivated) {
      storeRef.current.loadData();
    }
  }, [store.isAuth, store.user.isActivated]);

  if (store.isInitializing) {
    return (
      <div className={styles.App}>
        <FaSpinner className={styles.spinner} />
      </div>
    );
  }

  if (store.isLoading) {
    return (
      <div className={styles.App}>
        <FaSpinner className={styles.spinner} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className={styles.App}>
        <h1 className={styles.header}>Rotationsplan leicht erstellen!</h1>
        {store.isAuth && <UserAria />}
        <Routes>
          <Route
            path="/login"
            element={
              store.isAuth ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginForm />
              )
            }
          />
          <Route
            path="/register"
            element={
              store.isAuth ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <RegisterForm />
              )
            }
          />
          <Route path="/reset-password" element={<ReqResPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* SaveRoute */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <MainLayout />
              </AuthGuard>
            }
          >
            <Route index element={<StationsListe />} />
            <Route path="workersliste" element={<WorkersListe />} />
            <Route path="rotationpla" element={<RotationPlan />} />
          </Route>

          <Route
            path="/"
            element={
              <AuthGuard>
                <MainLayout />
              </AuthGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default observer(App);
