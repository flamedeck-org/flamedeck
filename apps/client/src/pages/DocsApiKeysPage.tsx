import ApiKeysContent from '../docs/api-keys.mdx';
import DocsContent from '@/components/docs/DocsContent';
import DocsPageSEO from '@/components/docs/DocsPageSEO';

export default function DocsApiKeysPage() {
  return (
    <>
      <DocsPageSEO
        title="API Keys"
        description="Learn how to get an API key and understand the necessary scopes for interacting with the FlameDeck API."
        path="/docs/api-keys"
      />
      <DocsContent>
        <ApiKeysContent />
      </DocsContent>
    </>
  );
}
