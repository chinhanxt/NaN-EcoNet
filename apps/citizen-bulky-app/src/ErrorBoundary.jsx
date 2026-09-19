import React from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
          <Alert severity="error" sx={{ width: '100%', maxWidth: 500 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Đã xảy ra lỗi ứng dụng:
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {error?.message || String(error)}
            </Typography>
          </Alert>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" color="primary" onClick={() => window.location.reload()}>
              Tải lại trang (Reload)
            </Button>
          </Box>
        </Box>
      );
    }
    const { children } = this.props;
    return children;
  }
}

export default ErrorBoundary;
