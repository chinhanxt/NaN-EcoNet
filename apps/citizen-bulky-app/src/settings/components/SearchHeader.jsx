import { useState, useEffect, useRef } from 'react';
import { TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from '../../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  header: {
    position: 'sticky',
    left: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: theme.spacing(2, 2, 1.5),
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    zIndex: 1,
  },
}));

const SearchHeader = ({ keyword, setKeyword }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const [input, setInput] = useState(keyword);
  const timerRef = useRef();

  useEffect(() => {
    timerRef.current = setTimeout(() => setKeyword(input), 500);
    return () => clearTimeout(timerRef.current);
  }, [input, setKeyword]);

  return (
    <div className={classes.header}>
      <TextField
        variant="outlined"
        size="small"
        placeholder={t('sharedSearch')}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
            </InputAdornment>
          ),
          sx: {
            borderRadius: '8px',
            backgroundColor: '#f8fafc',
            fontSize: '0.875rem',
            '& fieldset': {
              borderColor: '#e2e8f0',
            },
            '&:hover fieldset': {
              borderColor: '#cbd5e1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1d4ed8',
            },
          },
        }}
      />
    </div>
  );
};

export default SearchHeader;
