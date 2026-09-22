'use client';

import { EventEmitter } from 'events';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const MediaBox = dynamic(
  () => import('@gitroom/frontend/components/media/media.component').then((module) => module.MediaBox),
  { ssr: false }
);
const showModalEmitter = new EventEmitter();

export const ShowMediaBoxModal = (): null => {
  const { openModal } = useModals();
  const t = useT();

  useEffect(() => {
    const open = (callback: (media: { id: string; path: string }) => void) => {
      openModal({
        title: t('media_library', 'Media Library'),
        askClose: false,
        closeOnEscape: true,
        fullScreen: true,
        size: 'calc(100% - 80px)',
        height: 'calc(100% - 80px)',
        children: (close) => (
          <MediaBox setMedia={(media) => callback(media[0])} closeModal={close} />
        ),
      });
    };
    showModalEmitter.on('show-modal', open);
    return () => {
      showModalEmitter.off('show-modal', open);
    };
  }, [openModal, t]);

  return null;
};

export const showMediaBox = (
  callback: (media: { id: string; path: string }) => void
) => {
  showModalEmitter.emit('show-modal', callback);
};
