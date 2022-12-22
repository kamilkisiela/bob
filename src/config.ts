import zod from 'zod';

const BobConfigModel = zod.optional(
  zod.union([
    zod.literal(false),
    zod.object({
      commonjs: zod.optional(zod.literal(false), {
        description: 'Omit CommonJS output.',
      }),
      build: zod.union([
        zod.literal(false),
        zod.optional(
          zod.object({
            copy: zod.optional(zod.array(zod.string())),
          }),
        ),
      ]),
      check: zod.optional(
        zod.union([
          zod.literal(false),
          zod.object({
            skip: zod.optional(zod.array(zod.string())),
          }),
        ]),
      ),
    }),
  ]),
);

export type BobConfig = zod.TypeOf<typeof BobConfigModel>;

export function getBobConfig(packageJson: Record<string, unknown>) {
  return BobConfigModel.parse(packageJson.bob ?? {});
}
