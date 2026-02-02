import React from 'react';
import {View, Text} from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  componentDidCatch(error, info) {
    // Log for debugging
    console.error(`ErrorBoundary (${this.props.name || 'component'}):`, error, info);
    this.setState({hasError: true, error});
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{padding: 20}}>
          <Text style={{color: '#fff'}}>Something went wrong while rendering this section.</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
