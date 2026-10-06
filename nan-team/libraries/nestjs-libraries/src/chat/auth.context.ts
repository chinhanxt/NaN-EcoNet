import { getAuth } from '@gitroom/nestjs-libraries/chat/async.storage';

export const checkAuth = (
  inputData: any,
  context: any
) => {
  const auth = getAuth();
  const authInfo = context?.mcp?.extra?.authInfo || auth;
  if (authInfo && context?.requestContext) {
    (context.requestContext as any).set(
      'organization',
      JSON.stringify(authInfo)
    );
    (context.requestContext as any).set('ui', 'false');
  }
};

export const requireOrganization = (inputData: any, context: any) => {
  checkAuth(inputData, context);
  const organization = JSON.parse(context?.requestContext?.get('organization') || '{}');
  if (!organization.id) throw new Error('An authenticated organization is required');
  return organization;
};
