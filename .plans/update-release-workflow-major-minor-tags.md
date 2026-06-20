# Update Release Workflow: Create Major & Minor Tags

## Problem

The release workflow currently creates only full three-part tags (`v2.3.1`). Docker users who want to reference `kaneo:2.3` (minor) or `kaneo:2` (major) cannot do so because those tags don't exist. They must specify the full version like `kaneo:2.3.1`.

## Solution

After creating the patch tag (`v2.3.1`), also create and push major (`v2`) and minor (`v2.3`) tags. These tags should be **moving tags** — they get updated/overwritten on each new release within that major/minor series.

## Changes

### File: `.github/workflows/release.yml`

Add new steps after the `Create Release Commit` step (before `Push changes`):

1. **Create/update major tag** — extract major version from `${{ steps.new_version.outputs.version }}` (e.g., `2.3.1` → `2`), tag as `v2`, using `git tag -f` to move the tag.
2. **Create/update minor tag** — extract major.minor (e.g., `2.3.1` → `2.3`), tag as `v2.3`, using `git tag -f` to move the tag.
3. **Push with --force for tags** — the existing `git push` step needs `--follow-tags` or explicit tag pushes. Since we use `-f` for moving tags, we need a separate push with `--force` for the major/minor tags, or push all tags with force.

### Consideration: Force-pushing tags

Force-pushing tags is generally safe here because:
- These are "moving" tags by design (they always point to the latest release in that series).
- The full three-part tags (`v2.3.1`) remain immutable.
- Anyone fetching `v2` or `v2.3` expects them to move.

However, we should be explicit about which tags are force-pushed to avoid accidentally force-pushing the immutable patch tag.

## Implementation

Add the following steps after `Create Release Commit` (line 79):

```yaml
      - name: Extract version parts
        id: version_parts
        run: |
          FULL_VERSION="${{ steps.new_version.outputs.version }}"
          MAJOR=$(echo "$FULL_VERSION" | cut -d. -f1)
          MINOR=$(echo "$FULL_VERSION" | cut -d. -f1,2)
          echo "major=$MAJOR" >> $GITHUB_OUTPUT
          echo "minor=$MINOR" >> $GITHUB_OUTPUT

      - name: Create/update major version tag
        run: |
          git tag -f "v${{ steps.version_parts.outputs.major }}"

      - name: Create/update minor version tag
        run: |
          git tag -f "v${{ steps.version_parts.outputs.minor }}"
```

Modify the `Push changes` step to push all tags (including the force-updated moving tags):

```yaml
      - name: Push changes
        run: |
          git push origin HEAD:${{ github.ref }}
          git push origin --tags --force
```

This pushes the commit normally, then force-pushes all tags (moving the major/minor tags while the patch tag remains identical, which is harmless).

## Edge Cases

- **First release in a major series** (e.g., `v3.0.0`): The `v3` and `v3.0` tags are created for the first time (no prior tag to overwrite). `git tag -f` works fine here too.
- **Prerelease versions** (e.g., `v2.4.0-alpha.1`): `cut -d. -f1,2` produces `2.4`, same as a stable release. The minor tag would point to the prerelease. This is acceptable — if needed, the stable release will overwrite it. (No action needed unless we want special handling.)
- **Manual version input**: The manual version input follows the same semver format, so version parts extraction works identically.
