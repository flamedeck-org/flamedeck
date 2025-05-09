import ReactNativeContent from '../docs/react-native.mdx';
import DocsContent from '@/components/docs/DocsContent';
import DocsPageSEO from '@/components/docs/DocsPageSEO';

export default function DocsReactNativePage() {
  return (
    <>
      <DocsPageSEO
        title="React Native Profiling"
        description="Learn how to capture and upload React Native performance profiles to Flamedeck using react-native-release-profiler and @flamedeck/upload."
        path="/docs/react-native"
      />
      <DocsContent>
        <ReactNativeContent />
      </DocsContent>
    </>
  );
}
