'use client';

import {
  PlugSettings,
  PlugsInterface,
  usePlugs,
} from '@gitroom/frontend/components/plugs/plugs.context';
import { Button } from '@gitroom/react/form/button';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR, { mutate } from 'swr';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { TopTitle } from '@gitroom/frontend/components/launches/helpers/top.title.component';
import {
  FormProvider,
  SubmitHandler,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { Input } from '@gitroom/react/form/input';
import { CopilotTextarea } from '@copilotkit/react-textarea';
import clsx from 'clsx';
import { string, object } from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Slider } from '@gitroom/react/form/slider';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';
export function convertBackRegex(s: string) {
  const matches = s.match(/\/(.*)\/([a-z]*)/);
  const pattern = matches?.[1] || '';
  const flags = matches?.[2] || '';
  return new RegExp(pattern, flags);
}
export const TextArea: FC<{
  name: string;
  placeHolder: string;
}> = (props) => {
  const form = useFormContext();
  const { onChange, onBlur, ...all } = form.register(props.name);
  const value = form.watch(props.name);
  return (
    <>
      <textarea className="hidden" {...all}></textarea>
      <CopilotTextarea
        disableBranding={true}
        placeholder={props.placeHolder}
        value={value}
        className={clsx(
          '!min-h-40 !max-h-80 p-[24px] overflow-hidden bg-customColor2 outline-none rounded-[4px] border-fifth border'
        )}
        onChange={(e) => {
          onChange({
            target: {
              name: props.name,
              value: e.target.value,
            },
          });
        }}
        autosuggestionsConfig={{
          textareaPurpose: `Assist me in writing social media posts.`,
          chatApiConfigs: {},
        }}
      />
      <div className="text-red-400 text-[12px]">
        {form?.formState?.errors?.[props.name]?.message as string}
      </div>
    </>
  );
};
export const translatePlugTitle = (t: any, title: string) => {
  if (title === 'Auto Repost Posts') return t('auto_repost_posts', 'Auto Repost Posts');
  if (title === 'Auto plug post') return t('auto_plug_post', 'Auto plug post');
  return t(title?.toLowerCase().replace(/\s+/g, '_') || '', title);
};

export const translatePlugDesc = (t: any, desc: string) => {
  if (!desc) return '';
  if (desc.includes('repost it to increase engagement')) {
    return t(
      'auto_repost_desc',
      t('auto_repost_desc', 'When a post reaches a certain engagement, automatically repost it to boost reach (posts from 1 week ago).')
    );
  }
  if (desc.includes('add another post to it')) {
    return t(
      'auto_plug_desc',
      t('auto_plug_desc', 'When a post reaches a certain engagement, automatically attach an additional post/comment to notify your followers.')
    );
  }
  return t(desc, desc);
};

export const PlugPop: FC<{
  plug: PlugsInterface;
  settings: PlugSettings;
  data?: {
    activated: boolean;
    data: string;
    id: string;
    integrationId: string;
    organizationId: string;
    plugFunction: string;
  };
}> = (props) => {
  const { plug, settings, data } = props;
  const { closeAll } = useModals();
  const fetch = useFetch();
  const toaster = useToaster();
  const t = useT();
  const values = useMemo(() => {
    if (!data?.data) {
      return {};
    }
    return JSON.parse(data.data).reduce((acc: any, current: any) => {
      return {
        ...acc,
        [current.name]: current.value,
      };
    }, {} as any);
  }, []);
  const yupSchema = useMemo(() => {
    return object(
      plug.fields.reduce((acc, field) => {
        return {
          ...acc,
          [field.name]: field.validation
            ? string().matches(convertBackRegex(field.validation), {
                message: t('invalid_value', 'Invalid value'),
              })
            : null,
        };
      }, {})
    );
  }, [t]);
  const form = useForm({
    resolver: yupResolver(yupSchema),
    values,
    mode: 'all',
  });
  const submit: SubmitHandler<any> = useCallback(async (data) => {
    await fetch(`/integrations/${settings.providerId}/plugs`, {
      method: 'POST',
      body: JSON.stringify({
        func: plug.methodName,
        fields: Object.keys(data).map((key) => ({
          name: key,
          value: data[key],
        })),
      }),
    });
    toaster.show(t('plug_updated', 'Plug updated successfully'), 'success');
    closeAll();
  }, [t]);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(submit)}>
        <div className="relative mx-auto">
          <div className="my-[20px] text-[14px] leading-relaxed">
            {translatePlugDesc(t, plug.description)}
          </div>
          <div>
            {plug.fields.map((field) => (
              <div key={field.name}>
                {field.type === 'richtext' ? (
                  <TextArea name={field.name} placeHolder={field.placeholder} />
                ) : (
                  <Input
                    name={field.name}
                    label={field.description}
                    className="w-full mt-[8px] p-[8px] border border-tableBorder rounded-md text-black"
                    placeholder={field.placeholder}
                    type={field.type}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-[20px]">
            <Button type="submit">{t('activate', 'Activate')}</Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
};
export const PlugItem: FC<{
  plug: PlugsInterface;
  addPlug: (data: any) => void;
  data?: {
    activated: boolean;
    data: string;
    id: string;
    integrationId: string;
    organizationId: string;
    plugFunction: string;
  };
}> = (props) => {
  const { plug, addPlug, data } = props;
  const [activated, setActivated] = useState(!!data?.activated);
  const t = useT();
  useEffect(() => {
    setActivated(!!data?.activated);
  }, [data?.activated]);
  const fetch = useFetch();
  const changeActivated = useCallback(
    async (status: 'on' | 'off') => {
      await fetch(`/integrations/plugs/${data?.id}/activate`, {
        body: JSON.stringify({
          status: status === 'on',
        }),
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      setActivated(status === 'on');
    },
    [activated]
  );
  return (
    <div
      onClick={() => addPlug(data)}
      key={plug.title}
      className="w-full min-h-[290px] rounded-[14px] bg-newTableHeader hover:bg-newTableBorder border border-newBorder/40 transition-all p-[20px] flex flex-col justify-between cursor-pointer"
    >
      <div className="flex flex-col gap-[10px] flex-1">
        <div className="flex items-center justify-between">
          <div className="text-[19px] font-[700] text-newTextColor flex-1">
            {translatePlugTitle(t, plug.title)}
          </div>
          {!!data && (
            <div onClick={(e) => e.stopPropagation()}>
              <Slider
                value={activated ? 'on' : 'off'}
                onChange={changeActivated}
                fill={true}
              />
            </div>
          )}
        </div>
        <div className="flex-1 text-[14px] text-newTableText leading-relaxed">
          {translatePlugDesc(t, plug.description)}
        </div>
      </div>
      <div className="pt-[16px]">
        <Button className="w-full">
          {!data ? t('set_plug', 'Set plug') : t('edit_plug', 'Edit plug')}
        </Button>
      </div>
    </div>
  );
};
export const Plug = () => {
  const plug = usePlugs();
  const modals = useModals();
  const fetch = useFetch();
  const t = useT();
  const load = useCallback(async () => {
    if (!plug?.providerId) {
      return [];
    }
    try {
      const res = await fetch(`/integrations/${plug.providerId}/plugs`);
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    } catch (e) {
      return [];
    }
  }, [plug?.providerId]);
  const { data: rawData, isLoading, mutate } = useSWR(
    plug?.providerId ? `plugs-${plug.providerId}` : null,
    load,
    {
      fallbackData: [],
    }
  );
  const data = Array.isArray(rawData) ? rawData : [];
  const addEditPlug = useCallback(
    (p: PlugsInterface) =>
      (data?: {
        activated: boolean;
        data: string;
        id: string;
        integrationId: string;
        organizationId: string;
        plugFunction: string;
      }) => {
        modals.openModal({
          withCloseButton: true,
          onClose() {
            mutate();
          },
          size: '500px',
          title: `${t('auto_plug', 'Auto Plug')}: ${translatePlugTitle(t, p.title)}`,
          children: (
            <PlugPop
              plug={p}
              data={data}
              settings={{
                identifier: plug.identifier,
                providerId: plug.providerId,
                name: plug.name,
              }}
            />
          ),
        });
      },
    [data, t, plug]
  );
  if (isLoading) {
    return null;
  }
  if (!plug || !plug.plugs?.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-[40px] text-center text-newTableText">
        <div className="text-[18px] font-semibold text-newTextColor mb-2">
          {t('no_plugs_for_channel', 'This channel currently has no promotional plugs')}
        </div>
        <div className="text-[14px]">
          {t(
            'no_plugs_for_channel_desc',
            t('plugs_support_desc', 'Currently auto repost and auto plug features support X, Facebook, LinkedIn Page, Threads, and Bluesky.')
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-[30px]">
      {(plug.plugs || []).map((p) => (
        <PlugItem
          key={p.title + '-' + plug.providerId}
          addPlug={addEditPlug(p)}
          plug={p}
          data={data.find((a: any) => a.plugFunction === p.methodName)}
        />
      ))}
    </div>
  );
};
