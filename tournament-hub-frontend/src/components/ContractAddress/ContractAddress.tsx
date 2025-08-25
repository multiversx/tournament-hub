import { Label } from 'components';
import { getContractAddress } from '../../config/contract';
import {
  ACCOUNTS_ENDPOINT,
  getExplorerLink,
  MvxExplorerLink,
  useGetNetworkConfig
} from 'lib';

export const ContractAddress = () => {
  const { network } = useGetNetworkConfig();
  const explorerAddress = network.explorerAddress;
  const explorerLink = getExplorerLink({
    to: `/${ACCOUNTS_ENDPOINT}/${getContractAddress()}`,
    explorerAddress
  });
  return (
    <p>
      <Label>Contract: </Label>
      <MvxExplorerLink
        link={explorerLink}
        className='border-b border-dotted border-gray-500 hover:border-solid hover:border-gray-800'
      >
        {getContractAddress()}
      </MvxExplorerLink>
    </p>
  );
};
