export default {
  MuiUseMediaQuery: {
    defaultProps: {
      noSsr: true,
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: '8px',
        textTransform: 'none',
        fontWeight: 600,
        boxShadow: 'none',
        transition: 'all 0.15s ease-in-out',
        '&:hover': {
          boxShadow: 'none',
        },
      },
      sizeMedium: {
        height: '40px',
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: '8px',
        backgroundColor: '#ffffff',
        borderColor: '#e2e8f0',
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: '#e2e8f0',
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
          borderColor: '#1d4ed8',
        },
      },
      notchedOutline: {
        borderRadius: '8px',
        borderColor: '#e2e8f0',
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        backgroundImage: 'none',
      },
      rounded: {
        borderRadius: '12px',
      },
    },
  },
  MuiDialog: {
    defaultProps: {
      PaperProps: {
        sx: {
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        },
      },
    },
    styleOverrides: {
      paper: {
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: '9999px',
      },
    },
  },
  MuiFormControl: {
    defaultProps: {
      size: 'small',
    },
  },
  MuiSnackbar: {
    defaultProps: {
      anchorOrigin: {
        vertical: 'bottom',
        horizontal: 'center',
      },
    },
  },
  MuiTooltip: {
    defaultProps: {
      enterDelay: 500,
      enterNextDelay: 500,
    },
  },
  MuiTableCell: {
    styleOverrides: {
      root: ({ theme }) => ({
        '@media print': {
          color: theme.palette.alwaysDark.main,
        },
      }),
      head: {
        fontWeight: 600,
        fontSize: '0.75rem',
        color: '#64748b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 16px',
      },
      body: {
        fontSize: '0.875rem',
        color: '#020817',
        borderBottom: '1px solid #f1f5f9',
        padding: '12px 16px',
      },
    },
  },
  MuiAccordion: {
    defaultProps: {
      disableGutters: true,
      elevation: 0,
    },
    styleOverrides: {
      root: {
        borderRadius: '12px !important',
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.04)',
        marginBottom: '14px !important',
        overflow: 'hidden',
        '&:before': {
          display: 'none',
        },
        '&.Mui-expanded': {
          marginBottom: '16px !important',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        },
      },
    },
  },
  MuiAccordionSummary: {
    styleOverrides: {
      root: {
        padding: '0 20px',
        minHeight: '52px !important',
        backgroundColor: '#ffffff',
        transition: 'background-color 0.15s ease',
        '&:hover': {
          backgroundColor: '#f8fafc',
        },
        '&.Mui-expanded': {
          borderBottom: '1px solid #e2e8f0',
          minHeight: '52px !important',
        },
      },
      content: {
        margin: '14px 0 !important',
        '& .MuiTypography-root': {
          fontWeight: 600,
          fontSize: '0.9375rem',
          color: '#020817',
        },
      },
      expandIconWrapper: {
        color: '#64748b',
      },
    },
  },
  MuiAccordionDetails: {
    styleOverrides: {
      root: {
        padding: '24px 20px',
        backgroundColor: '#ffffff',
      },
    },
  },
  MuiTableHead: {
    styleOverrides: {
      root: {
        backgroundColor: '#f8fafc',
      },
    },
  },
  MuiTableBody: {
    styleOverrides: {
      root: {
        '& .MuiTableRow-root': {
          transition: 'background-color 0.12s ease',
          '&:hover': {
            backgroundColor: '#f8fafc',
          },
        },
      },
    },
  },
};
