import {
  dag,
  Container,
  Directory,
  object,
  func,
  argument,
} from "@dagger.io/dagger"

@object()
export class Ci {
  private base(source: Directory, nodeVersion: string): Container {
    let ctr = dag
      .container()
      .from(`node:${nodeVersion}-slim`)
      .withExec(["apt-get", "update"])
      .withExec([
        "apt-get",
        "install",
        "-y",
        "--no-install-recommends",
        "python3",
        "make",
        "g++",
        "git",
      ])
      .withMountedDirectory("/app", source)
      .withWorkdir("/app")
      // Dagger context directories exclude .git dirs but may include
      // a .git worktree file pointing to a host path. Remove it and
      // init a fresh repo so integration tests pass.
      .withExec(["rm", "-rf", ".git"])
      .withExec(["git", "init"])
      .withExec(["git", "config", "user.email", "ci@dagger"])
      .withExec(["git", "config", "user.name", "CI"])
      .withExec(["git", "add", "."])
      .withExec(["git", "commit", "-m", "init", "--allow-empty"])

    if (nodeVersion.startsWith("24")) {
      ctr = ctr.withEnvVariable("CXXFLAGS", "-std=c++20")
    }

    return ctr.withExec(["npm", "ci"])
  }

  @func()
  check(
    @argument({ defaultPath: "/" }) source: Directory,
    nodeVersion: string = "22",
  ): Container {
    return this.base(source, nodeVersion)
      .withExec(["npm", "run", "type-check"])
      .withExec(["npm", "run", "build"])
  }

  @func()
  async test(
    @argument({ defaultPath: "/" }) source: Directory,
    nodeVersion: string = "22",
  ): Promise<Directory> {
    return this.check(source, nodeVersion)
      .withExec(["npm", "run", "test:coverage"])
      .withExec(["npm", "run", "test:providers"])
      .directory("/app/coverage")
  }

  @func()
  async testAll(
    @argument({ defaultPath: "/" }) source: Directory,
  ): Promise<string> {
    const versions = ["22", "24"]
    await Promise.all(versions.map((v) => this.test(source, v)))
    return `All tests passed on Node ${versions.join(", ")}`
  }
}
