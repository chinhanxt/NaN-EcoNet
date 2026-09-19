import { makeStyles } from 'tss-react/mui';

export default makeStyles()((theme) => ({
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
  },
  containerMap: {
    flexBasis: 'var(--report-map-height, 40%)',
    flexShrink: 0,
  },
  containerMain: {
    overflow: 'auto',
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  header: {
    position: 'sticky',
    top: 0,
    left: 0,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    backgroundColor: '#ffffff',
  },
  columnAction: {
    width: '1%',
    paddingLeft: theme.spacing(1),
    '@media print': {
      display: 'none',
    },
  },
  columnActionContainer: {
    display: 'flex',
  },
  filter: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.04)',
    '@media print': {
      display: 'none !important',
    },
  },
  filterItem: {
    minWidth: '140px',
    flex: '1 1 auto',
  },
  filterButtons: {
    display: 'flex',
    gap: theme.spacing(1),
    flex: '0 0 auto',
  },
  filterButton: {
    borderRadius: '8px',
    fontWeight: 600,
    textTransform: 'none',
    height: '40px',
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    '&:hover': {
      backgroundColor: '#1e40af',
    },
  },
  chart: {
    flexGrow: 1,
    overflow: 'hidden',
    padding: theme.spacing(2),
  },
  actionCellPadding: {
    '&.MuiTableCell-body': {
      paddingTop: 0,
      paddingBottom: 0,
    },
  },
}));
