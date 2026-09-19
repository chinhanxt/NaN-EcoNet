const validatedColor = (color) => (/^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : null);

export default (server, darkMode) => ({
  mode: darkMode ? 'dark' : 'light',
  background: {
    default: darkMode ? '#0f172a' : '#f8fafc',
    paper: darkMode ? '#1e293b' : '#ffffff',
  },
  primary: {
    main: validatedColor(server?.attributes?.colorPrimary) || (darkMode ? '#60a5fa' : '#1d4ed8'),
    contrastText: '#ffffff',
  },
  secondary: {
    main: validatedColor(server?.attributes?.colorSecondary) || (darkMode ? '#94a3b8' : '#64748b'),
    contrastText: '#ffffff',
  },
  text: {
    primary: darkMode ? '#f8fafc' : '#020817',
    secondary: darkMode ? '#94a3b8' : '#64748b',
  },
  divider: darkMode ? '#334155' : '#e2e8f0',
  action: {
    hover: darkMode ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
    selected: darkMode ? 'rgba(29, 78, 216, 0.16)' : '#eff6ff',
    disabledBackground: darkMode ? '#334155' : '#e2e8f0',
  },
  success: {
    main: '#22c55e',
    light: '#4ade80',
    dark: '#16a34a',
    contrastText: '#ffffff',
  },
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    contrastText: '#ffffff',
  },
  warning: {
    main: '#eab308',
    light: '#fde047',
    dark: '#ca8a04',
    contrastText: '#ffffff',
  },
  neutral: {
    main: darkMode ? '#94a3b8' : '#64748b',
  },
  geometry: {
    main: '#3bb2d0',
  },
  alwaysDark: {
    main: '#020817',
  },
});
