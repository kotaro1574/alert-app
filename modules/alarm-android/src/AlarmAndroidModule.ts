import { NativeModule, requireNativeModule } from 'expo';

declare class AlarmAndroidModule extends NativeModule<{}> {}

export default requireNativeModule<AlarmAndroidModule>('AlarmAndroid');
