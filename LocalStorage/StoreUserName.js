import AsyncStorage from "@react-native-async-storage/async-storage";

async function GetUserNameValue(){
  try {
    const value = await AsyncStorage.getItem('Name');
    if (value !== null) {
      return value
    } else {
      return ''
    }
  } catch (e) {
    // error reading value
  }
}

async function SetUserNameValue(name){
  try {
    await AsyncStorage.setItem('Name', name);
  } catch (e) {
    // Error saving user name
  }
}


export {GetUserNameValue, SetUserNameValue}
