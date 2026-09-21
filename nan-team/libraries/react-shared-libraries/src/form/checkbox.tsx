'use client';

import { forwardRef, useCallback } from 'react';
import clsx from 'clsx';
import { useFormContext } from 'react-hook-form';

export const Checkbox = forwardRef<
  HTMLDivElement,
  {
    checked?: boolean;
    disabled?: boolean;
    disableForm?: boolean;
    name?: string;
    className?: string;
    label?: string;
    onChange?: (event: {
      target: {
        name?: string;
        value: boolean;
      };
    }) => void;
    variant?: 'default' | 'hollow';
  }
>((props, ref) => {
  const { checked, className, label, disableForm, disabled } = props;
  const form = useFormContext();
  const hasForm = !disableForm && !!form && !!props.name;
  const register = hasForm ? form.register(props.name!) : null;
  const watch = hasForm ? form.watch(props.name!) : false;
  const val = typeof checked === 'boolean' ? checked : !!watch;

  const changeStatus = useCallback(() => {
    if (disabled) return;
    const nextVal = !val;
    props?.onChange?.({
      target: {
        name: props.name,
        value: nextVal,
      },
    });
    if (hasForm && form && props.name) {
      form.setValue(props.name, nextVal, {
        shouldValidate: true,
        shouldDirty: true,
      });
      // @ts-ignore
      register?.onChange?.({
        target: {
          name: props.name,
          value: nextVal,
        },
      });
    }
  }, [val, disabled, hasForm, props.name, form, register]);

  return (
    <div
      className={clsx(
        'flex gap-[10px] items-center select-none group',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      )}
      onClick={changeStatus}
    >
      <div
        ref={ref}
        tabIndex={disabled ? -1 : 0}
        role="checkbox"
        aria-checked={!!val}
        aria-disabled={!!disabled}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            changeStatus();
          }
        }}
        className={clsx(
          'w-[22px] h-[22px] rounded-[5px] justify-center items-center flex transition-all duration-150 shrink-0 outline-none',
          val
            ? 'bg-forth border-2 border-forth text-white shadow-sm'
            : 'border-2 border-customColor1 bg-customColor2 group-hover:border-forth',
          'focus-visible:ring-2 focus-visible:ring-forth focus-visible:ring-offset-2',
          className
        )}
      >
        {val && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      {!!label && (
        <div className="text-[14px] leading-tight text-textColor select-none">
          {label}
        </div>
      )}
    </div>
  );
});

