## Description

<!-- Concise technical summary of the changes in this pull request. -->

## Changes

<!-- List specific files, modules, or configurations modified. -->
-

## Type of Change

- [ ] `feat`: New user-facing capability
- [ ] `fix`: Bug fix
- [ ] `docs`: Documentation updates
- [ ] `refactor`: Internal restructuring without behavior changes
- [ ] `test`: New or updated tests
- [ ] `chore`: Build, CI, or dependency updates

## Verification

```bash
make verify
```

## Checklist

- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- [ ] `make verify` passes locally (`check-version`, `typecheck`, `test`, `build`).
- [ ] `public/manifest.json` preserves minimum MV3 permissions without `<all_urls>`.
- [ ] `exportBomAsJson` output remains strictly compliant with the 10-field `bom-sourcing` schema.
- [ ] Documentation is updated to match code changes.
