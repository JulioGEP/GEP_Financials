import { Route, Routes } from 'react-router-dom';
import { useFinancialData } from './hooks/useFinancialData';
import { Layout } from './components/Layout';
import { Overview } from './components/pages/Overview';
import { Ventas } from './components/pages/Ventas';
import { Gastos } from './components/pages/Gastos';
import { CashFlow } from './components/pages/CashFlow';
import { Alertas } from './components/pages/Alertas';

export default function App() {
  const { data, loading, isRefreshing, refresh } = useFinancialData();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            title="Resumen Financiero"
            subtitle="Visión general del estado financiero"
            data={data}
            isRefreshing={isRefreshing}
            onRefresh={() => void refresh()}
          >
            <Overview data={data} loading={loading} />
          </Layout>
        }
      />
      <Route
        path="/ingresos"
        element={
          <Layout
            title="Ingresos"
            subtitle="Análisis detallado de ventas y cobros"
            data={data}
            isRefreshing={isRefreshing}
            onRefresh={() => void refresh()}
          >
            <Ventas data={data} loading={loading} />
          </Layout>
        }
      />
      <Route
        path="/gastos"
        element={
          <Layout
            title="Gastos"
            subtitle="Análisis detallado de gastos y pagos"
            data={data}
            isRefreshing={isRefreshing}
            onRefresh={() => void refresh()}
          >
            <Gastos data={data} loading={loading} />
          </Layout>
        }
      />
      <Route
        path="/cashflow"
        element={
          <Layout
            title="Flujo de Caja"
            subtitle="Proyección y análisis de tesorería"
            data={data}
            isRefreshing={isRefreshing}
            onRefresh={() => void refresh()}
          >
            <CashFlow data={data} loading={loading} />
          </Layout>
        }
      />
      <Route
        path="/alertas"
        element={
          <Layout
            title="Alertas y Riesgos"
            subtitle="Alertas activas y recomendaciones"
            data={data}
            isRefreshing={isRefreshing}
            onRefresh={() => void refresh()}
          >
            <Alertas data={data} loading={loading} />
          </Layout>
        }
      />
    </Routes>
  );
}
