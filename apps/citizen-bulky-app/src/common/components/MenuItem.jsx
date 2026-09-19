import React from 'react';
import { makeStyles } from 'tss-react/mui';
import { ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { Link } from 'react-router-dom';

const useStyles = makeStyles()(() => ({
  itemButton: {
    margin: '2px 8px',
    borderRadius: '8px',
    padding: '6px 10px',
    minHeight: '36px',
    transition: 'background-color 0.12s ease, color 0.12s ease',
    color: '#334155',
    '&:hover': {
      backgroundColor: '#f1f5f9',
      color: '#020817',
      '& .MuiListItemIcon-root': {
        color: '#020817',
      },
    },
    '&.Mui-selected': {
      backgroundColor: '#eff6ff',
      color: '#1d4ed8',
      fontWeight: 600,
      '&:hover': {
        backgroundColor: '#dbeafe',
      },
      '& .MuiListItemIcon-root': {
        color: '#1d4ed8',
      },
      '& .MuiListItemText-primary': {
        fontWeight: 600,
        color: '#1d4ed8',
      },
    },
  },
  itemIcon: {
    minWidth: '30px',
    color: '#64748b',
    transition: 'color 0.12s ease',
    '& .MuiSvgIcon-root': {
      fontSize: '19px',
    },
  },
  itemText: {
    '& .MuiListItemText-primary': {
      fontSize: '0.8125rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
}));

const MenuItem = ({ title, link, icon, selected }) => {
  const { classes } = useStyles();
  return (
    <ListItemButton
      key={link}
      component={Link}
      to={link}
      selected={selected}
      className={classes.itemButton}
      disableRipple
    >
      <ListItemIcon className={classes.itemIcon}>{icon}</ListItemIcon>
      <ListItemText primary={title} className={classes.itemText} />
    </ListItemButton>
  );
};

export default React.memo(MenuItem);
