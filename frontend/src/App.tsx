import { observer } from 'mobx-react-lite';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { FC, ReactNode, useContext, useEffect, useRef } from 'react';
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
import Footer from './components/Footer';

import styles from './App.module.css';

const Loader: FC = () => (
  <div className={styles.loaderWrap}>
    <span className={styles.spinner} />
  </div>
);

const AuthGuard: FC<{ children: ReactNode }> = ({ children }) => {
  const { store } = useContext(Context);
  const location = useLocation();

  if (store.isInitializing) return <Loader />;

  if (!store.isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
};

const App: FC = () => {
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

  if (store.isInitializing || store.isLoading) return <Loader />;

  return (
    <BrowserRouter>
      <div className={styles.app}>
        <header className={styles.headerBar}>
          <h1 className={styles.title}>Rotationsplan einfach erstellen!</h1>
          {store.isAuth && <UserAria />}
        </header>

        <main className={styles.main}>
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
              path="/registration"
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
              <Route path="rotationplan" element={<RotationPlan />} />
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
        </main>
        <footer className={styles.footerBar}>
          <Footer />
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default observer(App);
