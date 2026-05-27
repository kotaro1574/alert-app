import { registerWebModule, NativeModule } from 'expo';

// AlarmAndroidModule is not available on the web platform.
class AlarmAndroidModule extends NativeModule<{}> {}

export default registerWebModule(AlarmAndroidModule, 'AlarmAndroidModule');
