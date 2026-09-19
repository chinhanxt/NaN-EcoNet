import { useState } from 'react';
import { Alert, IconButton } from '@mui/material';
import ReplayIcon from '@mui/icons-material/Replay';
import { useDispatch, useSelector } from 'react-redux';
import { useAsyncTask } from './reactHelper';
import { sessionActions } from './store';
import Loader from './common/components/Loader';

const ServerProvider = ({ children }) => {
  const dispatch = useDispatch();

  const initialized = useSelector((state) => !!state.session.server);
  const [error, setError] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      if (!error) {
        try {
          const response = await fetch('/api/server', { signal });
          if (response.ok) {
            try {
              dispatch(sessionActions.updateServer(await response.json()));
            } catch {
              dispatch(sessionActions.updateServer({ id: 1, version: '6.15.3', newServer: false }));
            }
          } else {
            dispatch(sessionActions.updateServer({ id: 1, version: '6.15.3', newServer: false }));
          }
        } catch (err) {
          if (err.name !== 'AbortError' && !signal.aborted) {
            dispatch(sessionActions.updateServer({ id: 1, version: '6.15.3', newServer: false }));
          }
        }
      }
    },
    [error, dispatch],
  );

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <IconButton color="inherit" size="small" onClick={() => setError(null)}>
            <ReplayIcon fontSize="inherit" />
          </IconButton>
        }
      >
        {error}
      </Alert>
    );
  }
  if (!initialized) {
    return <Loader />;
  }
  return children;
};

export default ServerProvider;
