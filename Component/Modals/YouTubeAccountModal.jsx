/**
 * YouTubeAccountModal - Bottom sheet modal for YouTube account management
 * Similar to the reference app's YouTube account modal
 */

import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import {
  Modal,
  Portal,
  Text,
  Avatar,
  Divider,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '@react-navigation/native';

const YouTubeAccountModal = ({
  visible,
  onDismiss,
  user,
  onLogout,
  onLogin,
  onGuest,
  onRefresh,
  onEditName,
}) => {
  const theme = useTheme();
  const { colors } = theme;

  const isLoggedIn = !!user;
  const userName = user?.name || 'YouTube User';
  const userHandle = user?.handle || '';
  const avatarUrl = user?.avatarUrl;

  const handleEditName = () => {
    onDismiss();
    if (onEditName) {
      // Prompt for new name
      Alert.prompt(
        'Edit Display Name',
        'Enter your YouTube display name:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (name) => {
              if (name && name.trim()) {
                onEditName(name.trim());
              }
            },
          },
        ],
        'plain-text',
        userName !== 'YouTube User' ? userName : ''
      );
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: colors.card },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            YouTube Account
          </Text>
          <View style={styles.placeholder} />
        </View>

        <Divider style={{ backgroundColor: colors.border, opacity: 0.3 }} />

        {/* User Info Section */}
        {isLoggedIn && (
          <TouchableOpacity
            style={styles.userSection}
            activeOpacity={0.7}
            onPress={handleEditName}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <Avatar.Icon
                size={48}
                icon="account"
                style={{ backgroundColor: colors.primary }}
              />
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {userName}
              </Text>
              <Text
                style={[
                  styles.userHandle,
                  { color: colors.primary, fontSize: 12 },
                ]}
              >
                {userHandle || 'Tap to edit name'}
              </Text>
            </View>
            <View style={styles.signedInBadge}>
              <Text style={[styles.signedInText, { color: colors.text }]}>
                Signed in
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Guest Option */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            onDismiss();
            if (onGuest) {
              onGuest();
            }
          }}
          activeOpacity={0.7}
        >
          <Icon
            name="account-multiple"
            size={24}
            color={colors.text}
            style={styles.optionIcon}
          />
          <Text style={[styles.optionText, { color: colors.text }]}>Guest</Text>
        </TouchableOpacity>

        {/* Logout Option */}
        {isLoggedIn && (
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => {
              onDismiss();
              if (onLogout) {
                onLogout();
              }
            }}
            activeOpacity={0.7}
          >
            <Icon
              name="close"
              size={24}
              color={colors.text}
              style={styles.optionIcon}
            />
            <Text style={[styles.optionText, { color: colors.text }]}>
              Log out from YouTube
            </Text>
          </TouchableOpacity>
        )}

        {/* Add Account / Login Option */}
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => {
            onDismiss();
            if (onLogin) {
              onLogin();
            }
          }}
          activeOpacity={0.7}
        >
          <Icon
            name="playlist-plus"
            size={24}
            color={colors.text}
            style={styles.optionIcon}
          />
          <Text style={[styles.optionText, { color: colors.text }]}>
            {isLoggedIn ? 'Add an account' : 'Login to YouTube'}
          </Text>
        </TouchableOpacity>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    marginTop: 'auto',
    marginBottom: 0,
    marginHorizontal: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 32,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userHandle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  signedInBadge: {
    paddingHorizontal: 8,
  },
  signedInText: {
    fontSize: 12,
    opacity: 0.7,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionIcon: {
    marginRight: 16,
    opacity: 0.8,
  },
  optionText: {
    fontSize: 15,
  },
});

export default YouTubeAccountModal;




