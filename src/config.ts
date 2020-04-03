import { cosmiconfig } from "cosmiconfig";
import { isAbsolute, resolve } from "path";

export interface BobConfig {
  scope: string;
  track?: string[];
  against?: string;
  run?: {
    [cmdName: string]: (affected: {
      names: string[];
      paths: string[];
    }) => [string, string[]];
  };
}

interface UseConfigOptions {
  config?: string;
}

export async function useConfig(
  options?: UseConfigOptions
): Promise<BobConfig | never> {
  const cosmi = cosmiconfig("bob", {
    cache: true,
    searchPlaces: ["bob.config.js"]
  });

  const config = await (options?.config
    ? cosmi.load(
        isAbsolute(options.config)
          ? options.config
          : resolve(process.cwd(), options.config)
      )
    : cosmi.search());

  if (!config) {
    throw new Error("Config not found");
  }

  if (config.isEmpty) {
    throw new Error("Config is empty");
  }

  return config.config;
}
