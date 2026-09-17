'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Input } from '@gitroom/react/form/input';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';

export const ApiModal: FC<{
  identifier: string;
  title: string;
  update: () => void;
}> = (props) => {
  const { title, identifier, update } = props;
  const fetch = useFetch();
  const router = useRouter();
  const modal = useModals();
  const toaster = useToaster();
  const [loading, setLoading] = useState(false);
  const closePopup = useCallback(() => {
    modal.closeAll();
  }, []);

  const methods = useForm({
    mode: 'onChange',
  });

  const close = useCallback(() => {
    if (closePopup) {
      return closePopup();
    }
    modal.closeAll();
  }, []);

  const submit = useCallback(
    async (data: FieldValues) => {
      setLoading(true);
      const add = await fetch(`/third-party/${identifier}`, {
        method: 'POST',
        body: JSON.stringify({
          api: data.api,
        }),
      });

      if (add.ok) {
        toaster.show(t('integration_added_successfully', 'Integration added successfully'), 'success');
        if (closePopup) {
          closePopup();
        } else {
          modal.closeAll();
        }
        router.refresh();
        if (update) update();
        return;
      }

      const { message } = await add.json();

      methods.setError('api', {
        message,
      });

      setLoading(false);
    },
    [props]
  );

  const t = useT();

  return (
    <div className="relative">
      <FormProvider {...methods}>
        <form
          className="gap-[8px] flex flex-col"
          onSubmit={methods.handleSubmit(submit)}
        >
          <div className="pt-[10px]">
            <Input label="API Key" name="api" />
          </div>
          <div>
            <Button loading={loading} type="submit">
              {t('add_integration', 'Add Integration')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};

export const ThirdPartyListComponent: FC<{ reload: () => void }> = (props) => {
  const fetch = useFetch();
  const modals = useModals();
  const t = useT();
  const { reload } = props;

  const integrationsList = useCallback(async () => {
    try {
      const res = await fetch('/third-party/list');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) return json;
      }
    } catch (e) {}
    return [
      {
        identifier: 'heygen',
        title: 'HeyGen',
        description: t('heygen_desc', 'Create realistic AI avatar videos from your script.'),
        fields: [],
      },
    ];
  }, []);

  const { data } = useSWR('third-party-list', integrationsList, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [
      {
        identifier: 'heygen',
        title: 'HeyGen',
        description: t('heygen_desc', 'Create realistic AI avatar videos from your script.'),
        fields: [],
      },
    ],
  });

  const list = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const addApiKey = useCallback(
    (title: string, identifier: string) => () => {
      modals.openModal({
        title: `${t('add_api_key_for', 'Add API key for')} ${title}`,
        withCloseButton: false,
        children: (
          <ApiModal identifier={identifier} title={title} update={reload} />
        ),
      });
    },
    [t, reload]
  );

  const getDesc = (identifier: string, desc: string) => {
    if (identifier === 'heygen') return t('heygen_desc', 'Create realistic AI avatar videos from your script.');
    if (identifier === 'reelfarm' || identifier === 'reel_farm') return t('reelfarm_desc', 'Automatically generate engaging short videos for social media.');
    return desc;
  };

  return (
    <div className="grid grid-cols-4 gap-[10px] justify-items-center justify-center">
      {list.map((p: any) => (
        <div
          onClick={addApiKey(p.title, p.identifier)}
          key={p.identifier}
          className="w-full h-full p-[20px] min-h-[100px] text-[14px] bg-newTableHeader hover:bg-newTableBorder rounded-[8px] transition-all text-textColor relative flex flex-col gap-[15px] cursor-pointer"
        >
          <div>
            <img
              className="w-[32px] h-[32px]"
              src={`/icons/third-party/${p.identifier}.png`}
            />
          </div>
          <div className="whitespace-pre-wrap text-left text-lg">{p.title}</div>
          <div className="whitespace-pre-wrap text-left">{getDesc(p.identifier, p.description)}</div>
          <div className="w-full flex">
            <Button className="w-full">{t('add', 'Add')}</Button>
          </div>
        </div>
      ))}
    </div>
  );
};
