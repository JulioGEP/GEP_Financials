// Runtime configuration
export const config = {
  apiBase: '/api',
  refreshIntervalMs: 60 * 60 * 1000, // 60 minutes
  refreshWindow: {
    timezone: 'Europe/Madrid',
    startHour: 7,
    endHour: 22,
  },
  brand: {
    name: 'GEP Financials',
    colors: {
      red: '#e4032d',
      dark: '#333333',
      gray: '#dadada',
    },
  },
};
