import { Outlet, Link } from 'react-router-dom';
import { PageWrapper } from 'wrappers';
import { TransactionsTable } from 'components/TransactionsTable/TransactionsTable';
// import { Transaction } from './Transaction'; // Remove for now, or replace with stats

export const Home = () => {
  return (
    <PageWrapper>
      <div className='flex flex-col-reverse sm:flex-row items-center h-full w-full'>
        <div className='flex items-start sm:items-center h-full sm:w-1/2 sm:bg-center'>
          <div className='flex flex-col gap-2 max-w-[70sch] text-center sm:text-left text-xl font-medium md:text-2xl lg:text-3xl'>
            <div>
              <h1>Tournament Hub</h1>
              <p className='text-gray-400'>
                Join competitive tournaments, compete with players worldwide, and win prizes on the MultiversX blockchain.<br />
                <span className='text-base text-gray-500'>Connect your wallet to get started.</span>
              </p>
            </div>
            <div className='flex flex-row gap-6 justify-center sm:justify-start mt-6'>
              <div className='flex flex-col items-center'>
                <span className='text-3xl font-bold'>6</span>
                <span className='text-base text-gray-500'>Total Tournaments</span>
              </div>
              <div className='flex flex-col items-center'>
                <span className='text-3xl font-bold'>1</span>
                <span className='text-base text-gray-500'>Active Tournaments</span>
              </div>
              <div className='flex flex-col items-center'>
                <span className='text-3xl font-bold'>5</span>
                <span className='text-base text-gray-500'>Upcoming Tournaments</span>
              </div>
            </div>
            <div className='flex flex-row gap-4 justify-center sm:justify-start mt-8'>
              <Link to='/tournaments' className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>View Tournaments</Link>
              <Link to='/tournaments/create' className='px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600'>Create Tournament</Link>
            </div>
          </div>
        </div>
        <div className='h-4/6 bg-mvx-white bg-contain bg-no-repeat w-1/2 bg-center' />
        <Outlet />
      </div>
      <div className='mt-12'>
        <TransactionsTable />
      </div>
    </PageWrapper>
  );
};
