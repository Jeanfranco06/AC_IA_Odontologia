import { createBrowserRouter, Navigate } from 'react-router-dom';
import BuyerPage from '@/modules/buyer/pages/BuyerPage';
import NewBuyerPage from '@/modules/buyer/pages/NewBuyerPage';
import BuyerDetailPage from '@/modules/buyer/pages/BuyerDetailPage';
import BuyerRequestInfoPage from '@/modules/buyer/pages/BuyerRequestInfoPage';
import ActivateAccountPage from '@/modules/buyer/pages/ActivateAccountPage';
import PreReservationPage from '@/modules/lead/pages/PreReservationPage';
import LeadPage from '@/modules/lead/pages/LeadPage';
import LeadDetailPage from '@/modules/lead/pages/LeadDetailPage';
import LeadNegotiationPage from '@/modules/lead/pages/LeadNegotiationPage';
import PayerPage from '@/modules/payer/pages/PayerPage';
import PayerDetailPage from '@/modules/payer/pages/PayerDetailPage';
import CustomerPage from '@/modules/customer/pages/CustomerPage';
import CustomerDetailPage from '@/modules/customer/pages/CustomerDetailPage';
import TurnedPage from '@/modules/turned/pages/TurnedPage';
import TurnedDetailPage from '@/modules/turned/pages/TurnedDetailPage';
import ReportsPage from '@/modules/reports/pages/ReportsPage';
import CohortsAnalyticsPage from '@/modules/reports/pages/CohortsAnalyticsPage';
import ClinicalPerformancePage from '@/modules/reports/pages/ClinicalPerformancePage';
import ClinicalPatientsPage from '@/modules/clinical/pages/ClinicalPatientsPage';
import ClinicalAppointmentsPage from '@/modules/clinical/pages/ClinicalAppointmentsPage';
import ClinicalOdontogramPage from '@/modules/clinical/pages/ClinicalOdontogramPage';
import ConfigPage from '@/modules/config/pages/ConfigPage';
import AppLayout from '@/app/layouts/AppLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <BuyerRequestInfoPage />,
  },
  {
    path: '/solicitar-informacion',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/activar-cuenta',
    element: <ActivateAccountPage />,
  },
  {
    path: '/pre-reserva/:id',
    element: <PreReservationPage />,
  },
  {
    element: <AppLayout />,
    children: [
      {
        path: 'clinica/pacientes',
        element: <ClinicalPatientsPage />,
      },
      {
        path: 'clinica/citas',
        element: <ClinicalAppointmentsPage />,
      },
      {
        path: 'clinica/odontogramas',
        element: <ClinicalOdontogramPage />,
      },
      {
        path: 'buyer',
        element: <BuyerPage />,
      },
      {
        path: 'buyer/nuevo',
        element: <NewBuyerPage />,
      },
      {
        path: 'buyer/new',
        element: <NewBuyerPage />,
      },
      {
        path: 'buyer/:id',
        element: <BuyerDetailPage />,
      },
      {
        path: 'lead',
        element: <LeadPage />,
      },
      {
        path: 'lead/:id',
        element: <LeadDetailPage />,
      },
      {
        path: 'lead/:id/negotiation',
        element: <LeadNegotiationPage />,
      },
      {
        path: 'payer',
        element: <PayerPage />,
      },
      {
        path: 'payer/:id',
        element: <PayerDetailPage />,
      },
      {
        path: 'customer',
        element: <CustomerPage />,
      },
      {
        path: 'customer/:id',
        element: <CustomerDetailPage />,
      },
      {
        path: 'turned',
        element: <TurnedPage />,
      },
      {
        path: 'turned/:id',
        element: <TurnedDetailPage />,
      },
      {
        path: 'reportes',
        element: <ReportsPage />,
      },
      {
        path: 'analitica/cohortes',
        element: <CohortsAnalyticsPage />,
      },
      {
        path: 'analitica/rendimiento',
        element: <ClinicalPerformancePage />,
      },
      {
        path: 'configuracion',
        element: <ConfigPage />,
      },
    ],
  },
]);
