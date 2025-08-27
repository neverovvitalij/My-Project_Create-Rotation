import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Context, store } from './context';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container (#root) not found');
}

const root = ReactDOM.createRoot(container);
root.render(
  <Context.Provider value={{ store }}>
    <App />
  </Context.Provider>
);
