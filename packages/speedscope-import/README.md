# @flamedeck/speedscope-import

This package is responsible for importing various performance profile formats and converting them into the common Speedscope profile format.

## Development

### Generating Protobuf Code

This package includes importers for pprof (protobuf) formatted profiles. The TypeScript code for handling these protobuf definitions is generated from a `.proto` schema file.

If you modify `packages/speedscope-import/src/speedscope-import/profile.proto`, you will need to regenerate the corresponding TypeScript file (`profile.proto.ts`) using the following command from the workspace root:

```bash
npx pbjs --ts packages/speedscope-import/src/speedscope-import/profile.proto.ts packages/speedscope-import/src/speedscope-import/profile.proto
```

This command uses `pbjs` (from `protobufjs-cli`) to convert the `.proto` file directly into a TypeScript module that includes both the runtime logic and type definitions for the protobuf messages.

**Prerequisites:**

- Ensure `protobufjs-cli` is available. You can install it globally (`npm install -g protobufjs-cli`) or add it as a dev dependency to the workspace root and run via `npx pbjs ...`.
