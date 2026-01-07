import {useEffect, useState, useCallback} from 'react';
import {GetUserNameValue} from '../LocalStorage/StoreUserName';

export const useGetUserName = () => {
  const [userNameValue, setUserName] = useState('');
  const getUserNameLocalStorage = useCallback(async () => {
    const name = await GetUserNameValue();
    setUserName(FormatName(name));
  }, []);
  function FormatName(name) {
    const nameArray = name.split(' ');
    name = nameArray[0];
    if (name.length >= 10) {
      return name.slice(0, 9) + '..';
    } else {
      return name;
    }
  }

  useEffect(() => {
    getUserNameLocalStorage();
  }, [getUserNameLocalStorage]);
  return userNameValue;
};
