import { cosmiconfig } from "cosmiconfig";
import { isAbsolute, resolve } from "path";

type CommandTuple = [string, string[]];

type Command = {
  track?: string[];
  run(affected: {
    names: string[];
    paths: string[];
  }): CommandTuple | Promise<CommandTuple>;
};

export interface BobConfig {
  scope: string;
  ignore?: string[];
  track?: string[];
  base?: string;
  commands?: {
    [cmdName: string]: Command;
  };
  dists?: {
    distDir: string;
    distPath?: string;
  }[]
}

interface UseConfigOptions {
  config?: string;
}

export async function useConfig(
  options?: UseConfigOptions
): Promise<BobConfig | never> {
  const cosmi = cosmiconfig("bob", {
    cache: true,
    searchPlaces: ["bob.config.js"],
  });

  const config = await (options?.config
    ? cosmi.load(
        isAbsolute(options.config)
          ? options.config
          : resolve(process.cwd(), options.config)
      )
    : cosmi.search());

  if (!config) {
    throw new Error("Config not found.");
  }

  if (config.isEmpty) {
    throw new Error("Config is empty.");
  }

  return config.config;
}
