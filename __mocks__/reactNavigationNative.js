const React = require('react');

module.exports = {
  NavigationContainer: ({children}) =>
    React.createElement(React.Fragment, null, children),
  DefaultTheme: {colors: {primary: '#000', background: '#000', text: '#000'}},
  useTheme: () => ({
    colors: {
      primary: '#6CC04A',
      text: '#F4F5FC',
      textSecondary: '#CCCCCC',
      white: 'white',
      spacing: 10,
      headingSize: 24,
      fontSize: 14,
      disabled: 'rgb(131,131,131)',
      background: '#101010',
    },
  }),
};
