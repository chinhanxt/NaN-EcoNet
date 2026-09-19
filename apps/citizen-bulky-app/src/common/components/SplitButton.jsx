import { useRef, useState } from 'react';
import { Button, ButtonGroup, Menu, MenuItem, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

const SplitButton = ({
  fullWidth,
  variant = 'contained',
  color = 'primary',
  disabled,
  onClick,
  options,
  selected,
  setSelected,
}) => {
  const anchorRef = useRef();
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  return (
    <>
      <ButtonGroup
        fullWidth={fullWidth}
        variant={variant}
        color={color}
        ref={anchorRef}
        sx={{
          borderRadius: '8px',
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          height: '40px',
          '& .MuiButton-root': {
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          },
          '& .MuiButton-containedPrimary': {
            backgroundColor: '#1d4ed8',
            '&:hover': {
              backgroundColor: '#1e40af',
            },
          },
        }}
      >
        <Button disabled={disabled} onClick={() => onClick(selected)}>
          <Typography variant="button" noWrap sx={{ textTransform: 'none', fontWeight: 600 }}>
            {options[selected]}
          </Typography>
        </Button>
        <Button
          fullWidth={false}
          size="small"
          disabled={disabled}
          onClick={() => setMenuAnchorEl(anchorRef.current)}
          sx={{ px: 0.75 }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Menu
        open={!!menuAnchorEl}
        anchorEl={menuAnchorEl}
        onClose={() => setMenuAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              padding: '4px',
              minWidth: '140px',
            },
          },
        }}
      >
        {Object.entries(options).map(([key, value]) => (
          <MenuItem
            key={key}
            selected={key === selected}
            onClick={() => {
              setSelected(key);
              setMenuAnchorEl(null);
            }}
            sx={{
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: 500,
              my: 0.25,
              '&.Mui-selected': {
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 600,
              },
            }}
          >
            {value}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default SplitButton;
