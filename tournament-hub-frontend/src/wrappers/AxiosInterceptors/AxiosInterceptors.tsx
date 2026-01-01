import { PropsWithChildren, useEffect } from 'react';
// sampleAuthenticatedDomains is not needed for tournament hub - using empty array
const sampleAuthenticatedDomains: string[] = [];
import { setAxiosInterceptors, useGetLoginInfo } from 'lib';

export const AxiosInterceptors = ({ children }: PropsWithChildren) => {
  const { tokenLogin } = useGetLoginInfo();

  useEffect(() => {
    setAxiosInterceptors({
      authenticatedDomains: sampleAuthenticatedDomains,
      bearerToken: tokenLogin?.nativeAuthToken
    });
  }, [tokenLogin?.nativeAuthToken]);

  return <>{children}</>;
};
