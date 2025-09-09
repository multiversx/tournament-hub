import { PropsWithChildren } from 'react';
import { Box } from '@chakra-ui/react';
import { AuthRedirectWrapper } from 'wrappers';
import { Footer } from './Footer';
import { Header } from './Header';

export const Layout = ({ children }: PropsWithChildren) => {
  return (
    <Box display="flex" h="100vh" flexDirection="column" bg="gray.900" overflow="hidden">
      <Header />
      <Box as="main" flex="1" display="flex" alignItems="stretch" justifyContent="center" p={2} overflow="hidden">
        <AuthRedirectWrapper>{children}</AuthRedirectWrapper>
      </Box>
      <Footer />
    </Box>
  );
};
