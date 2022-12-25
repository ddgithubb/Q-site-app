import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { store } from './store/store';
import { Provider } from 'react-redux';
import { isMobile } from 'react-device-detect';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();


if (isMobile) {
  let vh = window.innerHeight * 0.01;
  document.body.style.setProperty('--vh', `${vh}px`);
  
  window.addEventListener('resize', () => {
      // We execute the same script as before
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
  });
}

let rootEl = document.getElementById('root');
if (rootEl) {
  rootEl.style.height = isMobile ? "calc(var(--vh, 1vh) * 100)" : "100vh";
  rootEl.style.width = "100vw";
}