import PageContainer from '@/components/layout/page-container';
import SheetFormDemo from '@/features/forms/components/sheet-form-demo';

export const metadata = {
  title: 'Dashboard: Sheet Form'
};

export default function Page() {
  return (
    <PageContainer
      pageTitle='Sheet & Dialog Forms'
      pageDescription='Form patterns inside sheets and dialogs with external submit buttons.'
    >
      <SheetFormDemo />
    </PageContainer>
  );
}
