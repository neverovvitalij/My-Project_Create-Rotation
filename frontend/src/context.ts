import { createContext } from 'react';
import Store from './store/store';
import { IStore } from './store/types';

export const store = new Store();

export const Context = createContext<{ store: IStore }>({
  store,
});
