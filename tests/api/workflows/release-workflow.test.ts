import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const workflowPath = resolve(
  import.meta.dirname,
  "../../../.github/workflows/release.yml",
);

const workflow = parse(readFileSync(workflowPath, "utf-8"));

describe("release workflow", () => {
  it("should have the correct job structure", () => {
    expect(workflow.name).toBe("Create Release");
    expect(workflow.on).toEqual({
      workflow_dispatch: {
        inputs: {
          version: {
            description:
              "Version to release (leave empty for automatic versioning)",
            required: false,
            type: "string",
          },
        },
      },
    });
  });

  it("should have a release job with correct permissions", () => {
    const job = workflow.jobs.release;
    expect(job["runs-on"]).toBe("ubuntu-latest");
    expect(job.permissions).toEqual({
      contents: "write",
      "pull-requests": "write",
      actions: "write",
    });
  });

  describe("tag steps", () => {
    const steps = workflow.jobs.release.steps;

    it("should create the patch release tag", () => {
      const step = steps.find(
        (s: { name?: string; run?: string }) =>
          s.name === "Create Release Commit",
      );
      expect(step).toBeDefined();
      expect(step.run).toContain(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GHA expression
        'git tag "v${{ steps.new_version.outputs.version }}"',
      );
    });

    it("should extract version parts", () => {
      const step = steps.find(
        (s: { name?: string }) => s.name === "Extract version parts",
      );
      expect(step).toBeDefined();
      expect(step.run).toContain('MAJOR=$(echo "$FULL_VERSION" | cut -d. -f1)');
      expect(step.run).toContain(
        'MINOR=$(echo "$FULL_VERSION" | cut -d. -f1,2)',
      );
      expect(step.run).toContain('echo "major=$MAJOR" >> $GITHUB_OUTPUT');
      expect(step.run).toContain('echo "minor=$MINOR" >> $GITHUB_OUTPUT');
    });

    it("should create/update the major version tag", () => {
      const step = steps.find(
        (s: { name?: string }) => s.name === "Create/update major version tag",
      );
      expect(step).toBeDefined();
      expect(step.run).toContain(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GHA expression
        'git tag -f "v${{ steps.version_parts.outputs.major }}"',
      );
    });

    it("should create/update the minor version tag", () => {
      const step = steps.find(
        (s: { name?: string }) => s.name === "Create/update minor version tag",
      );
      expect(step).toBeDefined();
      expect(step.run).toContain(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GHA expression
        'git tag -f "v${{ steps.version_parts.outputs.minor }}"',
      );
    });

    it("should push commit normally and force-push tags", () => {
      const pushStep = steps.find(
        (s: { name?: string }) => s.name === "Push changes",
      );
      expect(pushStep).toBeDefined();
      // biome-ignore lint/suspicious/noTemplateCurlyInString: GHA expression
      expect(pushStep.run).toContain("git push origin HEAD:${{ github.ref }}");
      expect(pushStep.run).toContain("git push origin --tags --force");
    });
  });
});
