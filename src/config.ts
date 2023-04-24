import zod from 'zod';

const BobConfigModel = zod.optional(
  zod.union(
    [
      zod.literal(false),
      zod.object({
        commonjs: zod.optional(zod.literal(false), {
          description: 'Omit CommonJS output.',
        }),
        build: zod.union(
          [
            zod.literal(false),
            zod.optional(
              zod.object({
                copy: zod.optional(zod.array(zod.string()), {
                  description:
                    'Specify a list of files that should be copied the the output directory.',
                }),
              }),
            ),
          ],
          {
            description:
              'Build configuration. Set to false for skipping the build of this package.',
          },
        ),
        check: zod.optional(
          zod.union([
            zod.literal(false),
            zod.object({
              skip: zod.optional(zod.array(zod.string()), {
                description:
                  'Skip certain files from being checked. E.g. modules with side-effects.',
              }),
            }),
          ]),
          {
            description:
              'Check whether the built packages comply with the standards. (ESM & CJS compatible and loadable and Node.js engines specified)',
          },
        ),
      }),
    ],
    {
      description:
        'Bob configuration. Set this value to false in order to disable running bob on this package.',
    },
  ),
);

export type BobConfig = zod.TypeOf<typeof BobConfigModel>;

export function getBobConfig(packageJson: Record<string, unknown>) {
  return BobConfigModel.parse(packageJson.bob ?? {});
}
