import { useEffect, useRef, useState } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  Button,
  TextField,
  Link,
  Snackbar,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CountryFlag from 'react-country-flag';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { sessionActions } from '../store';
import { useLocalization, useTranslation } from '../common/components/LocalizationProvider';
import LoginLayout from './LoginLayout';
import usePersistedState from '../common/util/usePersistedState';
import {
  generateLoginToken,
  handleLoginTokenListeners,
  nativeEnvironment,
  nativePostMessage,
} from '../common/components/NativeInterface';
import { useCatch } from '../reactHelper';
import PasswordField from '../common/components/PasswordField';

const useStyles = makeStyles()((theme) => ({
  options: {
    position: 'fixed',
    top: theme.spacing(2.5),
    right: theme.spacing(2.5),
    display: 'flex',
    flexDirection: 'row',
    gap: theme.spacing(1.5),
    alignItems: 'center',
    zIndex: 10,
  },
  languageSelect: {
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    fontSize: '0.8125rem',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#e2e8f0',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#cbd5e1',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1d4ed8',
    },
  },
  flag: {
    marginRight: theme.spacing(1),
    display: 'inline-flex',
    alignItems: 'center',
  },
  serverButton: {
    color: '#64748b',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '6px',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#1d4ed8',
    },
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    width: '100%',
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: theme.spacing(1),
  },
  brandIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: '12px',
    backgroundColor: '#eff6ff',
    border: '1px solid #dbeafe',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1.5),
  },
  brandLogoImage: {
    maxHeight: 56,
    maxWidth: 200,
    width: 'auto',
    height: 'auto',
    marginBottom: theme.spacing(1.5),
    objectFit: 'contain',
  },
  brandTitle: {
    color: '#004b93',
    fontWeight: 700,
    fontSize: '1.5rem',
    lineHeight: 1.25,
    letterSpacing: '-0.025em',
  },
  brandTagline: {
    color: '#64748b',
    fontSize: '0.875rem',
    marginTop: theme.spacing(0.75),
    fontWeight: 400,
    lineHeight: 1.4,
  },
  inputField: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      '& fieldset': {
        borderColor: '#e2e8f0',
      },
      '&:hover fieldset': {
        borderColor: '#cbd5e1',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#1d4ed8',
        borderWidth: '1.5px',
      },
      '&.Mui-focused': {
        boxShadow: '0 0 0 3px rgba(29, 78, 216, 0.15)',
      },
      '&.Mui-error fieldset': {
        borderColor: '#ef4444',
      },
    },
    '& .MuiInputLabel-root': {
      color: '#64748b',
      fontSize: '0.875rem',
      '&.Mui-focused': {
        color: '#1d4ed8',
      },
      '&.Mui-error': {
        color: '#ef4444',
      },
    },
    '& .MuiFormHelperText-root': {
      marginTop: '4px',
      fontSize: '0.75rem',
    },
  },
  submitButton: {
    borderRadius: '8px',
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    fontWeight: 600,
    fontSize: '0.875rem',
    textTransform: 'none',
    padding: '10px 16px',
    height: '42px',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    transition: 'background-color 0.15s ease, box-shadow 0.15s ease',
    '&:hover': {
      backgroundColor: '#1e40af',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    },
    '&:disabled': {
      backgroundColor: '#93c5fd',
      color: '#ffffff',
      cursor: 'not-allowed',
      opacity: 0.7,
    },
  },
  openIdButton: {
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontWeight: 600,
    fontSize: '0.875rem',
    textTransform: 'none',
    padding: '10px 16px',
    height: '42px',
    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    '&:hover': {
      backgroundColor: '#f8fafc',
      borderColor: '#cbd5e1',
    },
  },
  extraContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(3),
    marginTop: theme.spacing(0.5),
  },
  link: {
    cursor: 'pointer',
    color: '#1d4ed8',
    fontWeight: 500,
    fontSize: '0.875rem',
    textDecoration: 'none',
    transition: 'color 0.15s ease',
    '&:hover': {
      color: '#1e40af',
      textDecoration: 'underline',
    },
  },
}));

const LoginPage = () => {
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const { languages, language, setLocalLanguage } = useLocalization();
  const languageList = Object.entries(languages).map((values) => ({
    code: values[0],
    country: values[1].country,
    name: values[1].name,
  }));

  const [failed, setFailed] = useState(false);

  const [email, setEmail] = usePersistedState('loginEmail', '');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showServerTooltip, setShowServerTooltip] = useState(false);

  const serverLogo = useSelector((state) => state.session.server.attributes?.logo);
  const registrationEnabled = useSelector((state) => state.session.server.registration);
  const languageEnabled = useSelector((state) => {
    const attributes = state.session.server.attributes;
    return !attributes.language && !attributes['ui.disableLoginLanguage'];
  });
  const changeEnabled = useSelector((state) => !state.session.server.attributes.disableChange);
  const emailEnabled = useSelector((state) => state.session.server.emailEnabled);
  const openIdEnabled = useSelector((state) => state.session.server.openIdEnabled);
  const openIdForced = useSelector(
    (state) => state.session.server.openIdEnabled && state.session.server.openIdForce,
  );
  const [codeEnabled, setCodeEnabled] = useState(false);

  const [announcementShown, setAnnouncementShown] = useState(false);
  const announcement = useSelector((state) => state.session.server.announcement);

  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setFailed(false);
    try {
      const query = `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
      const response = await fetch('/api/session', {
        method: 'POST',
        body: new URLSearchParams(code.length ? `${query}&code=${code}` : query),
      });
      if (response.ok) {
        const user = await response.json();
        generateLoginToken();
        dispatch(sessionActions.updateUser(user));
        const target = window.sessionStorage.getItem('postLogin') || '/';
        window.sessionStorage.removeItem('postLogin');
        navigate(target, { replace: true });
      } else if (response.status === 401 && response.headers.get('WWW-Authenticate') === 'TOTP') {
        setCodeEnabled(true);
      } else {
        throw Error(await response.text());
      }
    } catch {
      setFailed(true);
      setPassword('');
    }
  };

  const handleTokenLogin = useCatch(async (token) => {
    const response = await fetch(`/api/session?token=${encodeURIComponent(token)}`);
    if (response.ok) {
      const user = await response.json();
      dispatch(sessionActions.updateUser(user));
      navigate('/');
    } else if (response.status === 401) {
      nativePostMessage('logout');
    }
  });

  const handleTokenLoginRef = useRef(handleTokenLogin);
  handleTokenLoginRef.current = handleTokenLogin;

  const handleOpenIdLogin = () => {
    document.location = '/api/session/openid/auth';
  };

  useEffect(() => nativePostMessage('authentication'), []);

  useEffect(() => {
    const listener = (token) => handleTokenLoginRef.current(token);
    handleLoginTokenListeners.add(listener);
    return () => handleLoginTokenListeners.delete(listener);
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem('hostname') !== window.location.hostname) {
      window.localStorage.setItem('hostname', window.location.hostname);
      setShowServerTooltip(true);
    }
  }, []);

  return (
    <LoginLayout>
      <div className={classes.options}>
        {nativeEnvironment && changeEnabled && (
          <IconButton className={classes.serverButton} onClick={() => navigate('/change-server')}>
            <Tooltip
              title={`${t('settingsServer')}: ${window.location.hostname}`}
              open={showServerTooltip}
              arrow
            >
              <VpnLockIcon fontSize="small" />
            </Tooltip>
          </IconButton>
        )}
        {languageEnabled && (
          <FormControl size="small">
            <Select
              className={classes.languageSelect}
              value={language}
              onChange={(e) => setLocalLanguage(e.target.value)}
            >
              {languageList.map((it) => (
                <MenuItem key={it.code} value={it.code}>
                  <span className={classes.flag}>
                    <CountryFlag countryCode={it.country} svg />
                  </span>
                  {it.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </div>
      <div className={classes.container}>
        <div className={classes.brandHeader}>
          {serverLogo ? (
            <img className={classes.brandLogoImage} src={serverLogo} alt="Smartbin IoT" />
          ) : (
            <div className={classes.brandIconWrapper}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#004b93"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </div>
          )}
          <Typography className={classes.brandTitle}>Smartbin IoT</Typography>
          <Typography className={classes.brandTagline}>
            Nền tảng quản lý thùng rác thông minh
          </Typography>
        </div>
        {!openIdForced && (
          <>
            <TextField
              className={classes.inputField}
              required
              error={failed}
              label={t('userEmail')}
              name="email"
              value={email}
              autoComplete="email"
              autoFocus={!email}
              onChange={(e) => setEmail(e.target.value)}
              helperText={failed && 'Invalid username or password'}
            />
            <PasswordField
              className={classes.inputField}
              required
              error={failed}
              label={t('userPassword')}
              name="password"
              value={password}
              autoComplete="current-password"
              autoFocus={!!email}
              onChange={(e) => setPassword(e.target.value)}
            />
            {codeEnabled && (
              <TextField
                className={classes.inputField}
                required
                error={failed}
                label={t('loginTotpCode')}
                name="code"
                value={code}
                type="number"
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            <Button
              className={classes.submitButton}
              onClick={handlePasswordLogin}
              type="submit"
              variant="contained"
              disabled={!email || !password || (codeEnabled && !code)}
              fullWidth
            >
              {t('loginLogin')}
            </Button>
          </>
        )}
        {openIdEnabled && (
          <Button
            className={classes.openIdButton}
            onClick={() => handleOpenIdLogin()}
            variant="outlined"
            fullWidth
          >
            {t('loginOpenId')}
          </Button>
        )}
        {!openIdForced && (
          <div className={classes.extraContainer}>
            {registrationEnabled && (
              <Link onClick={() => navigate('/register')} className={classes.link} underline="none">
                {t('loginRegister')}
              </Link>
            )}
            {emailEnabled && (
              <Link
                onClick={() => navigate('/reset-password')}
                className={classes.link}
                underline="none"
              >
                {t('loginReset')}
              </Link>
            )}
          </div>
        )}
      </div>
      <Snackbar
        open={!!announcement && !announcementShown}
        message={announcement}
        action={
          <IconButton size="small" color="inherit" onClick={() => setAnnouncementShown(true)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      />
    </LoginLayout>
  );
};

export default LoginPage;
