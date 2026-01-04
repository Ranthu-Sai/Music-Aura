const React = require('react');

const Navigator = ({ children }) => React.createElement(React.Fragment, null, children);
const Screen = () => React.createElement(React.Fragment, null);

module.exports = {
  createNativeStackNavigator: () => ({ Navigator, Screen }),
};
