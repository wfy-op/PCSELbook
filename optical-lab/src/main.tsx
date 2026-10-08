import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OpticalLab, opticalLabPage } from '../app/optics/OpticalLab';
import './base.css';
createRoot(document.getElementById('root')!).render(<StrictMode><OpticalLab page={opticalLabPage(window.location.pathname) ?? 'tutorial'} /></StrictMode>);
