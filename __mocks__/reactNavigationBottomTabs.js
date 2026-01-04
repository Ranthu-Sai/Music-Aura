const React = require('react');

const Navigator = ({ children, tabBar }) => React.createElement(React.Fragment, null, children);
const Screen = () => React.createElement(React.Fragment, null);

module.exports = {
  createBottomTabNavigator: () => ({ Navigator, Screen }),
};
