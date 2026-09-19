import { makeStyles } from 'tss-react/mui';

export default makeStyles()((theme) => ({
  table: {
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.04)',
    overflow: 'hidden',
    marginBottom: theme.spacing(8),
  },
  columnAction: {
    width: '1%',
    paddingRight: theme.spacing(1),
  },
  container: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(6),
    maxWidth: '860px !important',
    paddingLeft: theme.spacing(3),
    paddingRight: theme.spacing(3),
  },
  buttons: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(4),
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing(1.5),
    '& > *': {
      minWidth: '120px',
      borderRadius: '8px',
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    paddingBottom: theme.spacing(1),
  },
  verticalActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
}));
