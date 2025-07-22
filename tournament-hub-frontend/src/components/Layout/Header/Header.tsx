import { useNavigate } from 'react-router-dom';
import { Button, MxLink } from 'components';
import { environment } from 'config';
import { getAccountProvider, useGetIsLoggedIn, useGetAccountInfo, useGetNetworkConfig, DECIMALS, DIGITS, FormatAmountController } from 'lib';
import { RouteNamesEnum } from 'localConstants';
import { NotificationsButton } from './components/NotificationsButton';

export const Header = () => {
  const isLoggedIn = useGetIsLoggedIn();
  const { address, account } = useGetAccountInfo();
  const { network } = useGetNetworkConfig();
  const navigate = useNavigate();
  const provider = getAccountProvider();

  const handleLogout = async () => {
    await provider.logout();
    navigate(RouteNamesEnum.home);
  };

  const { isValid, valueDecimal, valueInteger, label } =
    FormatAmountController.getData({
      digits: DIGITS,
      decimals: DECIMALS,
      egldLabel: network.egldLabel,
      input: account.balance
    });

  return (
    <header className='flex flex-row align-center justify-between pl-6 pr-6 pt-6'>
      <MxLink
        className='flex items-center justify-between'
        to={RouteNamesEnum.home}
      >
        <span className='text-2xl font-bold text-blue-700'>Tournament Hub</span>
      </MxLink>

      <nav className='h-full w-full text-sm sm:relative sm:left-auto sm:top-auto sm:flex sm:w-auto sm:flex-row sm:justify-end sm:bg-transparent'>
        <div className='flex justify-end container mx-auto items-center gap-2'>
          <div className='flex gap-1 items-center'>
            <div className='w-2 h-2 rounded-full bg-green-500' />
            <p className='text-gray-600'>{environment}</p>
          </div>

          {isLoggedIn && (
            <>
              <span className='text-gray-700 font-mono text-xs bg-gray-100 rounded px-2 py-1'>{address}</span>
              <span className='text-gray-700 font-mono text-xs bg-gray-100 rounded px-2 py-1'>
                Balance: {isValid ? `${valueInteger}.${valueDecimal} ${label}` : '...'}
              </span>
              <NotificationsButton />
              <Button
                onClick={handleLogout}
                className='inline-block rounded-lg px-3 py-2 text-center hover:no-underline my-0 text-gray-600 hover:bg-slate-100 mx-0'
              >
                Logout
              </Button>
            </>
          )}

          {!isLoggedIn && (
            <Button
              onClick={() => {
                navigate(RouteNamesEnum.unlock);
              }}
            >
              Connect
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};
