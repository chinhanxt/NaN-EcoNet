import { useState } from 'react';
import {
  AppBar,
  Breadcrumbs,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from './LocalizationProvider';
import BackIcon from './BackIcon';

const useStyles = makeStyles()((theme, { miniVariant }) => ({
  root: {
    height: '100%',
    display: 'flex',
    backgroundColor: '#f8fafc',
    [theme.breakpoints.down('md')]: {
      flexDirection: 'column',
    },
  },
  desktopDrawer: {
    width: miniVariant ? '56px' : '250px',
    overflowX: 'hidden',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    boxShadow: 'none',
    transition: 'width 0.15s ease',
    ...(miniVariant && {
      '& .MuiListItemButton-root': {
        minHeight: 38,
        justifyContent: 'center',
        padding: '6px 0',
        margin: '2px 6px',
      },
      '& .MuiListItemIcon-root': {
        minWidth: 'auto',
      },
      '& .MuiListItemText-root': {
        display: 'none',
      },
      '& .MuiListSubheader-root': {
        display: 'none',
      },
      '& hr': {
        display: 'none',
      },
    }),
    '@media print': {
      display: 'none',
    },
  },
  drawerToolbar: {
    minHeight: '52px !important',
    height: '52px',
    padding: '0 12px !important',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: miniVariant ? 'center' : 'space-between',
  },
  navButton: {
    borderRadius: '8px',
    color: '#64748b',
    padding: '6px',
    transition: 'background-color 0.12s ease, color 0.12s ease',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#020817',
    },
  },
  mobileDrawer: {
    width: '270px',
    backgroundColor: '#ffffff',
    '@media print': {
      display: 'none',
    },
  },
  mobileToolbar: {
    zIndex: 1,
    minHeight: '52px !important',
    height: '52px',
    backgroundColor: '#ffffff !important',
    color: '#020817 !important',
    borderBottom: '1px solid #e2e8f0',
    boxShadow: 'none !important',
    '@media print': {
      display: 'none',
    },
  },
  content: {
    flexGrow: 1,
    alignItems: 'stretch',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    backgroundColor: '#f8fafc',
  },
}));

const PageTitle = ({ breadcrumbs }) => {
  const theme = useTheme();
  const t = useTranslation();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  if (desktop) {
    return (
      <Typography
        variant="subtitle1"
        noWrap
        sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#020817' }}
      >
        {t(breadcrumbs[0])}
      </Typography>
    );
  }
  return (
    <Breadcrumbs sx={{ fontSize: '0.875rem' }}>
      {breadcrumbs.slice(0, -1).map((breadcrumb) => (
        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }} key={breadcrumb}>
          {t(breadcrumb)}
        </Typography>
      ))}
      <Typography variant="body2" sx={{ color: '#020817', fontWeight: 600 }}>
        {t(breadcrumbs[breadcrumbs.length - 1])}
      </Typography>
    </Breadcrumbs>
  );
};

const PageLayout = ({ menu, breadcrumbs, children }) => {
  const [miniVariant, setMiniVariant] = useState(false);
  const { classes } = useStyles({ miniVariant });
  const theme = useTheme();
  const navigate = useNavigate();

  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  const [searchParams] = useSearchParams();

  const [openDrawer, setOpenDrawer] = useState(!desktop && searchParams.has('menu'));

  const toggleDrawer = () => setMiniVariant(!miniVariant);

  return (
    <div className={classes.root}>
      {desktop ? (
        <Drawer
          variant="permanent"
          className={classes.desktopDrawer}
          slotProps={{ paper: { className: classes.desktopDrawer } }}
        >
          <div className={classes.drawerToolbar}>
            {!miniVariant && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <IconButton
                  className={classes.navButton}
                  edge="start"
                  onClick={() => navigate('/')}
                >
                  <BackIcon />
                </IconButton>
                <PageTitle breadcrumbs={breadcrumbs} />
              </div>
            )}
            <IconButton
              className={classes.navButton}
              onClick={toggleDrawer}
            >
              {miniVariant !== (theme.direction === 'rtl') ? (
                <ChevronRightIcon fontSize="small" />
              ) : (
                <ChevronLeftIcon fontSize="small" />
              )}
            </IconButton>
          </div>
          {menu}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={openDrawer}
          onClose={() => setOpenDrawer(false)}
          slotProps={{ paper: { className: classes.mobileDrawer } }}
        >
          {menu}
        </Drawer>
      )}
      {!desktop && (
        <AppBar className={classes.mobileToolbar} position="static" color="inherit">
          <Toolbar sx={{ minHeight: '52px !important', height: '52px', px: '12px !important' }}>
            <IconButton
              className={classes.navButton}
              edge="start"
              sx={{ mr: 1.5 }}
              onClick={() => setOpenDrawer(true)}
            >
              <MenuIcon />
            </IconButton>
            <PageTitle breadcrumbs={breadcrumbs} />
          </Toolbar>
        </AppBar>
      )}
      <div className={classes.content}>{children}</div>
    </div>
  );
};

export default PageLayout;
