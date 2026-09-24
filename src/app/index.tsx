import { Redirect } from 'expo-router';
import { useUser } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  const role = user.role || (user.unsafeMetadata?.role as string);

  if (role === 'lecturer') {
    return <Redirect href="/(lecturer)" />;
  } else if (role === 'student') {
    return <Redirect href="/(student)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
