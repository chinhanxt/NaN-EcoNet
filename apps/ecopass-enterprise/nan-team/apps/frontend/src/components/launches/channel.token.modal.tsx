'use client';

import React, { FC, useEffect, useState } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';
import copy from 'copy-to-clipboard';

export const ChannelTokenModal: FC<{
  integration: any;
  onClose: () => void;
}> = ({ integration = {}, onClose }) => {
  const modal = useModals();
  const toast = useToaster();
  const t = useT();

  const channelId = integration?.id || '';
  const channelIdentifier = integration?.identifier || 'facebook';

  const [tokenValue, setTokenValue] = useState<string>('');
  const [initialToken, setInitialToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [validation, setValidation] = useState<{
    isValid?: boolean;
    error?: string;
    expiresAt?: number;
    name?: string;
    picture?: string;
    channelId?: string;
  } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (!channelId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/direct-channel/token?id=${channelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.success) {
          const t = data.integration?.token || '';
          setTokenValue(t);
          setInitialToken(t);
          if (data.validation) setValidation(data.validation);
        } else {
          setValidation({ isValid: false, error: data?.error || t('token_load_error', 'Error loading token') });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setValidation({ isValid: false, error: err.message });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [channelId]);

  const handleCopy = () => {
    if (!tokenValue) {
      toast.show(t('no_token', 'No token'), 'warning');
      return;
    }
    copy(tokenValue);
    setCopied(true);
    toast.show(t('token_copied', 'Token copied!'), 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTest = async () => {
    if (!tokenValue.trim()) {
      toast.show(t('please_enter_token', 'Please enter token'), 'warning');
      return;
    }
    setTesting(true);
    try {
      const res = await fetch('/direct-channel/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: channelIdentifier,
          token: tokenValue.trim(),
        }),
      });
      const data = await res.json();
      if (data?.valid) {
        if (data.normalizedToken && data.normalizedToken !== tokenValue) {
          setTokenValue(data.normalizedToken);
        }
        setValidation({
          isValid: true,
          name: data.name,
          picture: data.picture,
          channelId: data.pageId || data.channelId,
          expiresAt: data.expiresAt,
        });
        toast.show(
          channelIdentifier === 'tiktok'
            ? t('tiktok_session_valid', 'TikTok Session / Cookies are valid!')
            : channelIdentifier === 'youtube'
            ? t('youtube_cookies_valid', 'YouTube Cookies are valid!')
            : channelIdentifier === 'facebook'
            ? t('facebook_cookies_valid', 'Facebook Cookies are valid!')
            : t('token_valid', 'Token is valid!'),
          'success'
        );
      } else {
        setValidation({
          isValid: false,
          error:
            data?.error ||
            (channelIdentifier === 'tiktok'
              ? t('tiktok_invalid_hint', '⚠ TikTok Session ID / Cookies are invalid or expired.')
              : channelIdentifier === 'youtube'
              ? t('youtube_cookies_invalid_hint', '⚠ YouTube Cookies are invalid or expired.')
              : channelIdentifier === 'facebook'
              ? t('facebook_cookies_invalid_hint', '⚠ Facebook Cookies are invalid or expired.')
              : t('token_invalid', 'Token is invalid')),
        });
        toast.show(
          channelIdentifier === 'tiktok'
            ? t('tiktok_cookies_invalid', 'TikTok Session / Cookies are invalid')
            : channelIdentifier === 'youtube'
            ? t('youtube_cookies_invalid', 'YouTube Cookies are invalid')
            : channelIdentifier === 'facebook'
            ? t('facebook_cookies_invalid', 'Facebook Cookies are invalid')
            : t('token_invalid', 'Token is invalid'),
          'warning'
        );
      }
    } catch (e: any) {
      setValidation({ isValid: false, error: e.message });
      toast.show(t('check_error', 'Check error'), 'warning');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!tokenValue.trim()) {
      toast.show(t('token_cannot_be_empty', 'Token cannot be empty'), 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/direct-channel/token', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: channelId,
          token: tokenValue.trim(),
          name: validation?.name || undefined,
          picture: validation?.picture || undefined,
          internalId: validation?.channelId || undefined,
        }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.show(
          channelIdentifier === 'tiktok'
            ? t('tiktok_session_saved', 'TikTok Cookies saved successfully!')
            : channelIdentifier === 'youtube'
            ? t('youtube_cookies_saved', 'YouTube Cookies saved successfully!')
            : channelIdentifier === 'facebook'
            ? t('facebook_cookies_saved', 'Facebook Cookies saved successfully!')
            : t('token_updated', 'Token updated!'),
          'success'
        );
        modal.closeAll();
        onClose();
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        toast.show(data?.error || t('token_update_error', 'Error updating token'), 'warning');
      }
    } catch (e: any) {
      toast.show(e.message || t('token_save_error', 'Error saving token'), 'warning');
    } finally {
      setSaving(false);
    }
  };


  const displayName = validation?.name || integration?.name || (channelIdentifier === 'youtube' ? t('youtube_channel', 'YouTube Channel') : t('fanpage_channel', 'Fanpage Channel'));
  const displayPicture = validation?.picture || integration?.picture || `/icons/platforms/${channelIdentifier}.png`;
  const displayId = validation?.channelId || integration?.internalId || '';

  return (
    <div className="flex flex-col gap-[14px] w-full text-[13px] text-neutral-800 dark:text-neutral-200">
      {/* Compact Header */}
      <div className="flex items-center justify-between p-[8px_12px] bg-neutral-100 dark:bg-neutral-800/80 rounded-[8px]">
        <div className="flex items-center gap-[10px] min-w-0">
          <img
            src={displayPicture}
            alt={displayName}
            className="w-[32px] h-[32px] rounded-full object-cover border border-neutral-300 dark:border-neutral-700 bg-neutral-200 shrink-0"
            onError={(e) => {
              (e.target as any).src = '/no-picture.jpg';
            }}
          />
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-semibold truncate text-[13px]">
              {displayName}
            </span>
            <span className="text-[11px] text-neutral-500 font-mono truncate">
              ID: {displayId}
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          {loading ? (
            <span className="text-[11px] text-neutral-500">{t('checking', 'Checking...')}</span>
          ) : validation?.isValid ? (
            <span className="inline-flex items-center gap-[4px] px-[8px] py-[2px] rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="w-[5px] h-[5px] rounded-full bg-emerald-500" />
              {t('active', 'Active')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-[4px] px-[8px] py-[2px] rounded-full text-[11px] font-medium bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <span className="w-[5px] h-[5px] rounded-full bg-rose-500" />
              {t('expired', 'Expired')}
            </span>
          )}
        </div>
      </div>

      {/* Input token */}
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            {channelIdentifier === 'tiktok'
              ? t('tiktok_cookies_label', 'TikTok Cookies / Session ID')
              : channelIdentifier === 'youtube'
              ? t('youtube_cookies_label', 'YouTube Cookies (LOGIN_INFO, SID...)')
              : channelIdentifier === 'facebook'
              ? t('facebook_cookies_label', 'Facebook Cookies (c_user, xs)')
              : t('access_token', 'Access Token')}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-[11px] font-medium cursor-pointer"
          >
            {copied ? ('✓ ' + t('copied', 'Copied')) : t('copy', 'Copy')}
          </button>
        </div>
        <textarea
          rows={channelIdentifier === 'youtube' ? 6 : 4}
          value={tokenValue}
          onChange={(e) => setTokenValue(e.target.value)}
          placeholder={
            channelIdentifier === 'tiktok'
              ? t('tiktok_cookies_placeholder', 'Paste TikTok Cookies (sessionid=...;) or Session ID or JSON here')
              : channelIdentifier === 'youtube'
              ? t('youtube_cookies_placeholder', 'Paste YouTube Cookies (LOGIN_INFO=...; SID=...) or JSON cookies here')
              : channelIdentifier === 'facebook'
              ? t('facebook_cookies_placeholder', 'Paste Facebook Cookies (c_user=...; xs=...) or JSON cookies here')
              : t('access_token_placeholder', 'Paste Access Token (EAAP...) here')
          }
          className="w-full p-[10px] text-[12px] font-mono break-all overflow-y-auto rounded-[8px] bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 focus:outline-none focus:border-blue-500 resize-y min-h-[100px] max-h-[350px] leading-relaxed select-all"
        />
        {validation && !validation.isValid && !loading && (
          <span className="text-[11px] text-rose-600 dark:text-rose-400">
            {channelIdentifier === 'tiktok'
              ? t('tiktok_invalid_hint', '⚠ TikTok Session ID / Cookies are invalid or expired. Please paste fresh cookies and click Save.')
              : channelIdentifier === 'youtube'
              ? t('youtube_cookies_invalid_hint', '⚠ YouTube Cookies are invalid or expired. Please paste fresh cookies and click Save.')
              : channelIdentifier === 'facebook'
              ? t('facebook_cookies_invalid_hint', '⚠ Facebook Cookies are invalid or expired. Please paste fresh cookies and click Save.')
              : t('token_expired_hint', '⚠ Token has expired. Please update with a valid token.')}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-[8px] pt-[2px]">
        <div className="flex items-center gap-[6px]">
          {channelIdentifier === 'youtube' ? (
            <a
              href="https://studio.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[4px] text-[12px] text-red-600 hover:text-red-700 dark:text-red-400 font-medium hover:underline cursor-pointer"
            >
              <span>YouTube Studio ↗</span>
            </a>
          ) : channelIdentifier === 'tiktok' ? (
            <a
              href="https://www.tiktok.com/tiktokstudio/upload"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[4px] text-[12px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer"
            >
              <span>TikTok Studio ↗</span>
            </a>
          ) : channelIdentifier === 'facebook' ? (
            <a
              href="https://business.facebook.com/latest/composer"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-[4px] text-[12px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium hover:underline cursor-pointer"
            >
              <span>Meta Business Suite ↗</span>
            </a>
          ) : null}
        </div>

        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            disabled={testing || !tokenValue.trim()}
            onClick={handleTest}
            className="h-[32px] px-[12px] text-[12px] font-medium rounded-[6px] border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer disabled:opacity-50"
          >
            {testing ? t('testing', 'Testing...') : t('test', 'Test')}
          </button>
          <button
            type="button"
            disabled={saving || !tokenValue.trim()}
            onClick={handleSave}
            className="h-[32px] px-[16px] text-[12px] font-semibold rounded-[6px] bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            {saving
              ? t('saving', 'Saving...')
              : channelIdentifier === 'facebook' || channelIdentifier === 'youtube' || channelIdentifier === 'tiktok'
              ? t('save_cookies', 'Save Cookies')
              : t('save_token', 'Save Token')}
          </button>
        </div>
      </div>
    </div>
  );
};
