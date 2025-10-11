export default {
	extends: ["@commitlint/config-conventional"],
	rules: {
		"type-enum": [
			2,
			"always",
			[
				"feat",
				"fix",
				"docs",
				"style",
				"refactor",
				"perf",
				"test",
				"chore",
				"ci",
				"build",
			],
		],
		"subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
		"subject-empty": [2, "never"],
		"subject-full-stop": [2, "never", "."],
		"header-max-length": [2, "always", 100],
	},
};
