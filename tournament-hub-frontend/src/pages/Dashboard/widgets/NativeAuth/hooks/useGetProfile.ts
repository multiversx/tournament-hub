import axios from 'axios';
import { useState } from 'react';
import { useGetNetworkConfig } from 'lib';
import { ProfileType } from 'types';

export const useGetProfile = () => {
  const { network } = useGetNetworkConfig();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getProfile = async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get('/account', {
        baseURL: network.apiAddress
      });

      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unable to fetch profile');
    } finally {
      setIsLoading(false);
    }
  };

  return { profile, getProfile, isLoading };
};
