'use client';

import {
  PostComment,
  withProvider,
} from '@gitroom/frontend/components/new-launch/providers/high.order.provider';
import {
  FacebookDto,
  FACEBOOK_PRESETS,
} from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/facebook.dto';
import { getPresetBackground } from '@gitroom/frontend/components/new-launch/providers/facebook/facebook.background';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { FacebookPreview } from '@gitroom/frontend/components/new-launch/providers/facebook/facebook.preview';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useEffect } from 'react';

const postType = [
  {
    value: 'post',
    key: 'facebook_post_type_post',
    label: 'Bài viết',
  },
  {
    value: 'story',
    key: 'facebook_post_type_story',
    label: 'Tin (Story)',
  },
];

const FACEBOOK_PRESET_NAMES_VI: Record<string, string> = {
  '106018623298955': 'Tím trơn',
  '365653833956649': 'Cây nhiệt đới hồng',
  '618093735238824': 'Họa tiết nâu',
  '191761991491375': 'Trái tim 3D',
  '2193627793985415': 'Emoji mắt trái tim 3D',
  '200521337465306': 'Emoji ngọn lửa 3D',
  '1821844087883360': 'Hình vẽ vàng năng động',
  '177465482945164': 'Khối lập phương 3D tím nhạt',
  '160419724814650': 'Cam họa tiết hồng',
  '248623902401250': 'Emoji cười 3D',
  '240401816771706': 'Emoji hoa hồng 3D',
  '1868855943417360': 'Emoji cười ra nước mắt 3D',
  '255989551804163': 'Họa tiết mắt hồng',
  '1792915444087912': 'Hình minh họa',
  '1654916007940525': 'Họa tiết xám nhạt',
  '1679248482160767': 'Họa tiết xanh lam nhạt',
  '518948401838663': 'Trái tim hồng trên nền hồng',
  '423339708139719': 'Hình minh họa',
  '204187940028597': 'Đỏ trơn',
  '621731364695726': 'Đỏ trơn',
  '518596398537417': 'Họa tiết đỏ',
  '134273813910336': 'Họa tiết cây đỏ',
  '217321755510854': 'Trái tim hồng tím',
  '323371698179784': 'Hoàng hôn đỏ rực',
  '901751159967576': 'Chuyển màu cam đỏ đậm',
  '552118025129095': 'Họa tiết nâu',
  '263789377694911': 'Họa tiết quả táo đỏ',
  '606643333067842': 'Hoa tulip cam nhạt',
  '458988134561491': 'Mèo cam đậm',
  '548109108916650': 'Kỳ lân đỏ',
  '175493843120364': 'Chuyển màu hồng vàng',
  '338976169966519': 'Cầu thang màu be',
  '206513879997925': 'Xoắn ốc màu be',
  '168373304017982': 'Khối lập phương màu be',
  '1271157196337260': 'Đỏ trơn',
  '174496469882866': 'Họa tiết quả chanh vàng',
  '862667370603267': 'Trứng vàng nhạt',
  '127541261450947': 'Quả bóng xanh lá',
  '218067308976029': 'Họa tiết xám nhạt',
  '688479024672716': 'Chuyển màu xanh ngọc - xanh nhạt',
  '238863426886624': 'Mèo xanh lam nhạt',
  '301029513638534': 'Xanh ngọc trơn',
  '154977255088164': 'Xanh ngọc trơn',
  '1941912679424590': 'Chuyển màu xám khói',
  '396343990807392': 'Hoa xanh ngọc',
  '143093446467972': 'Mây xanh trên nền lam đậm',
  '161409924510923': 'Tên lửa vẽ trái tim',
  '145893972683590': 'Tím sẫm trơn',
  '217761075370932': 'Xanh dương trơn',
  '931584293685988': 'Sóng biển xanh dương',
  '148862695775447': 'Trái tim hồng tím trên nền tím',
  '100114277230063': 'Đại dương sâu thẳm',
  '558836317844129': 'Xoắn ốc tím',
  '172497526576609': 'Dưa hấu tím nhạt',
  '433967226963128': 'Tím trơn',
  '197865920864520': 'Bánh donut tím nhạt',
  '643122496026756': 'Họa tiết hồng',
  '762009070855346': 'Bóng bay xám nhạt',
  '228164237768720': 'Trái tim xám trên nền đen',
  '146487026137131': 'Cơn mưa đen',
  '221828835275596': 'Kính mắt xám nhạt',
  '1903718606535395': 'Đỏ trơn',
  '1881421442117417': 'Đen tuyền',
  '249307305544279': 'Chuyển màu đỏ xanh',
  '1777259169190672': 'Chuyển màu tím hồng cánh sen',
  '303063890126415': 'Chuyển màu vàng cam hồng',
  '122708641613922': 'Chuyển màu xám đen',
  '319468561816672': 'Họa tiết xanh đậm',
  '121945541697934': 'Họa tiết hồng',
  '288211338285858': 'Họa tiết xanh',
  '446330032368780': 'Chuyển màu đỏ',
  '219266485227663': 'Hồng cánh sen trơn',
  '1289741387813798': 'Đỏ thẫm trơn',
  '1365883126823705': 'Xanh dương trơn',
};

export const FacebookSettings = () => {
  const t = useT();
  const { register, watch, setValue } = useSettings();
  const { value } = useIntegration();
  const postCurrentType = watch('post_type');
  const preset = watch('text_format_preset_id');

  // Facebook background presets only render on text-only Page posts (no media).
  const hasMedia = !!value?.some((p) => !!p.image?.length);
  const presetAvailable = postCurrentType !== 'story' && !hasMedia;
  const selectedBg = getPresetBackground(preset);

  // Clear any selected background when it can no longer apply (story / media),
  // so a stray combination never reaches the provider.
  useEffect(() => {
    if (!presetAvailable && preset) {
      setValue('text_format_preset_id', '');
    }
  }, [presetAvailable, preset, setValue]);

  return (
    <>
      <div className="pt-[20px]">
        <Select
          label={t('facebook_post_type', 'Loại bài đăng')}
          {...register('post_type', {
            value: 'post',
          })}
        >
          <option value="">
            {t('select_post_type', 'Chọn loại bài đăng...')}
          </option>
          {postType.map((item) => (
            <option key={item.value} value={item.value}>
              {t(item.key, item.label)}
            </option>
          ))}
        </Select>
      </div>

      {postCurrentType !== 'story' && (
        <Input
          label={t(
            'embedded_url_label',
            'Đường dẫn liên kết nhúng (chỉ cho bài viết văn bản)'
          )}
          {...register('url')}
        />
      )}

      {presetAvailable && (
        <>
          <Select
            label={t(
              'facebook_background_label',
              'Hình nền (áp dụng cho bài viết chỉ có văn bản dưới 130 ký tự)'
            )}
            hideErrors
            {...register('text_format_preset_id')}
            style={
              selectedBg
                ? { background: selectedBg.background, color: selectedBg.text }
                : undefined
            }
          >
            <option value="" style={{ background: '#ffffff', color: '#1c1e21' }}>
              {t('facebook_background_none', 'Không (chỉ văn bản)')}
            </option>
            {FACEBOOK_PRESETS.map((item) => {
              const bg = getPresetBackground(item.id);
              const displayName = t(
                `facebook_preset_${item.id}`,
                FACEBOOK_PRESET_NAMES_VI[item.id] || item.name
              );
              return (
                <option
                  key={item.id}
                  value={item.id}
                  style={
                    bg ? { background: bg.background, color: bg.text } : undefined
                  }
                >
                  {displayName}
                </option>
              );
            })}
          </Select>
          <div className="text-[12px] opacity-70 mt-[8px]">
            {t(
              'facebook_background_note',
              'Danh sách không chính thức: màu hiển thị là xấp xỉ, hình nền không được hỗ trợ sẽ bị bỏ qua (xuất bản dưới dạng văn bản thường)'
            )}
          </div>
        </>
      )}
    </>
  );
};

export default withProvider<FacebookDto>({
  postComment: PostComment.COMMENT,
  minimumCharacters: [],
  SettingsComponent: FacebookSettings,
  CustomPreviewComponent: FacebookPreview,
  dto: FacebookDto,
  maximumCharacters: 63206,
});
