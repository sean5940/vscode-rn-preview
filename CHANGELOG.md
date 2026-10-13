# Changelog

## 0.4.0

First public release.

- Works with any project layout. Which directory holds previewable sources is set with `sourceRoot` in
  `rn-preview.config.json` and defaults to the project root, so RN CLI and Expo projects open without configuration.
- `▶ Open preview` appears on any `.tsx` in the project, outside `node_modules`.
- Projects without React Query, React Navigation, `react-native-safe-area-context` or Reanimated render too.
- tsconfig aliases follow `extends` and `baseUrl`.
